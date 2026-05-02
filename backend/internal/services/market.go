// internal/services/market.go
// Purpose: Fetches live market data from Finnhub and caches results.
// Finnhub free tier: 60 API calls/minute, no credit card required.
// Covers stocks, ETFs, crypto, forex, and commodities.
// Docs: https://finnhub.io/docs/api
// Rate limit strategy: in-memory cache with per-endpoint TTLs.

package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// ─── Structs ────────────────────────────────────────────────────────────────

type CacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

type MarketService struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	cache      map[string]CacheEntry
	cacheMu    sync.RWMutex
}

type Quote struct {
	Ticker        string    `json:"ticker"`
	Price         float64   `json:"price"`
	Change        float64   `json:"change"`
	ChangePercent float64   `json:"change_percent"`
	High          float64   `json:"high"`
	Low           float64   `json:"low"`
	Open          float64   `json:"open"`
	PreviousClose float64   `json:"previous_close"`
	Volume        float64   `json:"volume"`
	AssetType     string    `json:"asset_type"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Candle struct {
	Time   int64   `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

type AssetProfile struct {
	Ticker      string `json:"ticker"`
	Name        string `json:"name"`
	AssetType   string `json:"asset_type"`
	Exchange    string `json:"exchange"`
	Currency    string `json:"currency"`
	Description string `json:"description"`
	Logo        string `json:"logo"`
}

type SearchResult struct {
	Ticker    string `json:"ticker"`
	Name      string `json:"name"`
	AssetType string `json:"asset_type"`
	Exchange  string `json:"exchange"`
}

// ─── Constructor ────────────────────────────────────────────────────────────

func NewMarketService() *MarketService {
	key := os.Getenv("FINNHUB_API_KEY")
	log.Println("Finnhub key loaded:", key != "")
	return &MarketService{
		apiKey:     os.Getenv("FINNHUB_API_KEY"),
		baseURL:    "https://finnhub.io/api/v1",
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cache:      make(map[string]CacheEntry),
	}
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

func (m *MarketService) isExpired(entry CacheEntry) bool {
	return time.Now().After(entry.expiresAt)
}

func (m *MarketService) setCache(key string, data interface{}, ttl time.Duration) {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()
	m.cache[key] = CacheEntry{data: data, expiresAt: time.Now().Add(ttl)}
}

func (m *MarketService) getCache(key string) (interface{}, bool) {
	m.cacheMu.RLock()
	defer m.cacheMu.RUnlock()
	entry, ok := m.cache[key]
	if !ok || m.isExpired(entry) {
		return nil, false
	}
	return entry.data, true
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

func (m *MarketService) get(url string, target interface{}) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("X-Finnhub-Token", m.apiKey)

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("finnhub request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("finnhub returned status %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

// ─── GetQuote ────────────────────────────────────────────────────────────────

func (m *MarketService) GetQuote(ticker string, assetType string) (*Quote, error) {
	cacheKey := "quote:" + ticker

	if cached, ok := m.getCache(cacheKey); ok {
		q := cached.(Quote)
		return &q, nil
	}

	url := fmt.Sprintf("%s/quote?symbol=%s", m.baseURL, ticker)

	var raw struct {
		C  float64 `json:"c"`  // current price
		D  float64 `json:"d"`  // change
		Dp float64 `json:"dp"` // change percent
		H  float64 `json:"h"`  // high
		L  float64 `json:"l"`  // low
		O  float64 `json:"o"`  // open
		Pc float64 `json:"pc"` // previous close
		V  float64 `json:"v"`  // volume (not always present)
	}

	if err := m.get(url, &raw); err != nil {
		return nil, err
	}

	if raw.C == 0 {
		return nil, fmt.Errorf("ticker not found: %s", ticker)
	}

	quote := Quote{
		Ticker:        ticker,
		Price:         raw.C,
		Change:        raw.D,
		ChangePercent: raw.Dp,
		High:          raw.H,
		Low:           raw.L,
		Open:          raw.O,
		PreviousClose: raw.Pc,
		Volume:        raw.V,
		AssetType:     assetType,
		UpdatedAt:     time.Now().UTC(),
	}

	m.setCache(cacheKey, quote, 15*time.Second)
	return &quote, nil
}

// ─── GetCandles ──────────────────────────────────────────────────────────────

func (m *MarketService) GetCandles(ticker, assetType string, from, to int64, resolution string) ([]Candle, error) {
	cacheKey := fmt.Sprintf("candles:%s:%s:%d:%d:%s", ticker, assetType, from, to, resolution)

	if cached, ok := m.getCache(cacheKey); ok {
		return cached.([]Candle), nil
	}

	var url string
	switch assetType {
	case "crypto":
		url = fmt.Sprintf("%s/crypto/candle?symbol=%s&resolution=%s&from=%d&to=%d",
			m.baseURL, ticker, resolution, from, to)
	case "forex":
		url = fmt.Sprintf("%s/forex/candle?symbol=%s&resolution=%s&from=%d&to=%d",
			m.baseURL, ticker, resolution, from, to)
	default:
		// stock, etf, commodity
		url = fmt.Sprintf("%s/stock/candle?symbol=%s&resolution=%s&from=%d&to=%d",
			m.baseURL, ticker, resolution, from, to)
	}

	var raw struct {
		C []float64 `json:"c"`
		H []float64 `json:"h"`
		L []float64 `json:"l"`
		O []float64 `json:"o"`
		T []int64   `json:"t"`
		V []float64 `json:"v"`
		S string    `json:"s"` // "ok" or "no_data"
	}

	if err := m.get(url, &raw); err != nil {
		return nil, err
	}

	if raw.S != "ok" || len(raw.T) == 0 {
		return nil, fmt.Errorf("no candle data for %s", ticker)
	}

	candles := make([]Candle, len(raw.T))
	for i := range raw.T {
		candles[i] = Candle{
			Time:   raw.T[i],
			Open:   raw.O[i],
			High:   raw.H[i],
			Low:    raw.L[i],
			Close:  raw.C[i],
			Volume: raw.V[i],
		}
	}

	m.setCache(cacheKey, candles, 60*time.Second)
	return candles, nil
}

// ─── SearchAssets ────────────────────────────────────────────────────────────

func (m *MarketService) SearchAssets(query string) ([]SearchResult, error) {
	cacheKey := "search:" + query

	if cached, ok := m.getCache(cacheKey); ok {
		return cached.([]SearchResult), nil
	}

	url := fmt.Sprintf("%s/search?q=%s", m.baseURL, query)

	var raw struct {
		Result []struct {
			Symbol        string `json:"symbol"`
			Description   string `json:"description"`
			Type          string `json:"type"`
			DisplaySymbol string `json:"displaySymbol"`
		} `json:"result"`
		Count int `json:"count"`
	}

	if err := m.get(url, &raw); err != nil {
		return nil, err
	}

	limit := 20
	if len(raw.Result) < limit {
		limit = len(raw.Result)
	}

	results := make([]SearchResult, 0, limit)
	for _, r := range raw.Result[:limit] {
		results = append(results, SearchResult{
			Ticker:    r.Symbol,
			Name:      r.Description,
			AssetType: normalizeAssetType(r.Type),
			Exchange:  r.DisplaySymbol,
		})
	}

	m.setCache(cacheKey, results, 300*time.Second)
	return results, nil
}

// ─── GetProfile ──────────────────────────────────────────────────────────────

func (m *MarketService) GetProfile(ticker, assetType string) (*AssetProfile, error) {
	cacheKey := "profile:" + ticker

	if cached, ok := m.getCache(cacheKey); ok {
		p := cached.(AssetProfile)
		return &p, nil
	}

	url := fmt.Sprintf("%s/stock/profile2?symbol=%s", m.baseURL, ticker)

	var raw struct {
		Name     string `json:"name"`
		Ticker   string `json:"ticker"`
		Exchange string `json:"exchange"`
		Currency string `json:"currency"`
		Logo     string `json:"logo"`
		Ipo      string `json:"ipo"`
	}

	if err := m.get(url, &raw); err != nil {
		return nil, err
	}

	if raw.Name == "" {
		return nil, fmt.Errorf("profile not found for ticker: %s", ticker)
	}

	profile := AssetProfile{
		Ticker:    ticker,
		Name:      raw.Name,
		AssetType: assetType,
		Exchange:  raw.Exchange,
		Currency:  raw.Currency,
		Logo:      raw.Logo,
	}

	m.setCache(cacheKey, profile, 3600*time.Second)
	return &profile, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func normalizeAssetType(finnhubType string) string {
	switch finnhubType {
	case "ETP":
		return "etf"
	case "Crypto":
		return "crypto"
	case "Forex":
		return "forex"
	case "Common Stock":
		return "stock"
	default:
		return "stock"
	}
}
