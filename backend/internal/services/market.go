// internal/services/market.go
// Purpose: Fetches live market data from Finnhub and caches results.
// Architecture: two-layer cache —
//   1. In-memory cache (15s TTL) — avoids duplicate HTTP calls within same minute
//   2. SQLite price_cache — persists last known price across restarts, shown instantly on page load
//   3. SQLite asset_metadata — stores static profile data (name, exchange, currency etc.) forever
//
// Finnhub free tier: 60 API calls/minute.
// Docs: https://finnhub.io/docs/api

package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"sync"
	"time"
)

// ─── Structs ──────────────────────────────────────────────────────────────────

type CacheEntry struct {
	data      interface{}
	expiresAt time.Time
}

type MarketService struct {
	db         *sql.DB
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
	Stale         bool      `json:"stale,omitempty"` // true if from DB cache, not live
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

// ─── Constructor ──────────────────────────────────────────────────────────────

func NewMarketService(db *sql.DB) *MarketService {
	key := os.Getenv("MARKET_API_KEY")

	log.Printf("API key loaded: '%s'", key)

	return &MarketService{
		db:         db,
		apiKey:     os.Getenv("MARKET_API_KEY"),
		baseURL:    "https://finnhub.io/api/v1",
		httpClient: &http.Client{Timeout: 10 * time.Second},
		cache:      make(map[string]CacheEntry),
	}
}

// ─── In-memory cache helpers ──────────────────────────────────────────────────

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

// ─── HTTP helper ──────────────────────────────────────────────────────────────

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

// ─── DB price cache ───────────────────────────────────────────────────────────

func (m *MarketService) getPriceFromDB(ticker string) (*Quote, error) {
	var q Quote
	var fetchedAt time.Time
	err := m.db.QueryRow(`
		SELECT ticker, price, change, change_percent, high, low, open,
		       previous_close, volume, asset_type, fetched_at
		FROM price_cache WHERE ticker = ?`, ticker,
	).Scan(
		&q.Ticker, &q.Price, &q.Change, &q.ChangePercent,
		&q.High, &q.Low, &q.Open, &q.PreviousClose,
		&q.Volume, &q.AssetType, &fetchedAt,
	)
	if err != nil {
		return nil, err
	}
	q.UpdatedAt = fetchedAt
	q.Stale = true
	return &q, nil
}

func (m *MarketService) savePriceToDB(q *Quote) {
	_, _ = m.db.Exec(`
		INSERT INTO price_cache
		  (ticker, price, change, change_percent, high, low, open,
		   previous_close, volume, asset_type, fetched_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(ticker) DO UPDATE SET
		  price          = excluded.price,
		  change         = excluded.change,
		  change_percent = excluded.change_percent,
		  high           = excluded.high,
		  low            = excluded.low,
		  open           = excluded.open,
		  previous_close = excluded.previous_close,
		  volume         = excluded.volume,
		  asset_type     = excluded.asset_type,
		  fetched_at     = excluded.fetched_at`,
		q.Ticker, q.Price, q.Change, q.ChangePercent,
		q.High, q.Low, q.Open, q.PreviousClose,
		q.Volume, q.AssetType, q.UpdatedAt,
	)
}

// ─── DB metadata cache ────────────────────────────────────────────────────────

func (m *MarketService) getProfileFromDB(ticker string) (*AssetProfile, error) {
	var p AssetProfile
	err := m.db.QueryRow(`
		SELECT ticker, name, asset_type, exchange, currency, logo, description
		FROM asset_metadata WHERE ticker = ?`, ticker,
	).Scan(&p.Ticker, &p.Name, &p.AssetType, &p.Exchange, &p.Currency, &p.Logo, &p.Description)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (m *MarketService) saveProfileToDB(p *AssetProfile) {
	_, _ = m.db.Exec(`
		INSERT INTO asset_metadata
		  (ticker, name, asset_type, exchange, currency, logo, description, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(ticker) DO UPDATE SET
		  name        = excluded.name,
		  asset_type  = excluded.asset_type,
		  exchange    = excluded.exchange,
		  currency    = excluded.currency,
		  logo        = excluded.logo,
		  description = excluded.description,
		  updated_at  = excluded.updated_at`,
		p.Ticker, p.Name, p.AssetType, p.Exchange,
		p.Currency, p.Logo, p.Description, time.Now().UTC(),
	)
}

// ─── GetAllCachedPrices ───────────────────────────────────────────────────────
// Returns all prices stored in DB — used by markets page for instant load.

func (m *MarketService) GetAllCachedPrices() ([]Quote, error) {
	rows, err := m.db.Query(`
		SELECT ticker, price, change, change_percent, high, low, open,
		       previous_close, volume, asset_type, fetched_at
		FROM price_cache ORDER BY ticker ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var quotes []Quote
	for rows.Next() {
		var q Quote
		var fetchedAt time.Time
		if err := rows.Scan(
			&q.Ticker, &q.Price, &q.Change, &q.ChangePercent,
			&q.High, &q.Low, &q.Open, &q.PreviousClose,
			&q.Volume, &q.AssetType, &fetchedAt,
		); err != nil {
			continue
		}
		q.UpdatedAt = fetchedAt
		q.Stale = true
		quotes = append(quotes, q)
	}
	return quotes, nil
}

// ─── GetQuote ─────────────────────────────────────────────────────────────────
// Order: in-memory cache → Finnhub live → DB stale fallback

func (m *MarketService) GetQuote(ticker string, assetType string) (*Quote, error) {
	cacheKey := "quote:" + ticker

	// 1. In-memory cache (15s)
	if cached, ok := m.getCache(cacheKey); ok {
		q := cached.(Quote)
		return &q, nil
	}

	// 2. Try Finnhub live
	url := fmt.Sprintf("%s/quote?symbol=%s", m.baseURL, ticker)
	var raw struct {
		C  float64 `json:"c"`
		D  float64 `json:"d"`
		Dp float64 `json:"dp"`
		H  float64 `json:"h"`
		L  float64 `json:"l"`
		O  float64 `json:"o"`
		Pc float64 `json:"pc"`
		V  float64 `json:"v"`
	}

	liveErr := m.get(url, &raw)
	if liveErr != nil {
		log.Printf("finnhub error for %s: %v", ticker, liveErr)
	}
	if liveErr == nil && raw.C > 0 {
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
			Stale:         false,
		}
		m.setCache(cacheKey, quote, 15*time.Second)
		m.savePriceToDB(&quote) // persist to DB
		return &quote, nil
	}

	// 3. Fallback: return stale DB value if live fetch failed
	if dbQuote, err := m.getPriceFromDB(ticker); err == nil {
		return dbQuote, nil
	}

	return nil, fmt.Errorf("ticker not found: %s", ticker)
}

// ─── GetCandles ───────────────────────────────────────────────────────────────

func (m *MarketService) GetCandles(ticker, assetType string, from, to int64, resolution string) ([]Candle, error) {
	cacheKey := fmt.Sprintf("candles:%s:%s:%d:%d:%s", ticker, assetType, from, to, resolution)

	if cached, ok := m.getCache(cacheKey); ok {
		return cached.([]Candle), nil
	}

	// Map resolution to Yahoo Finance interval and range
	var interval string
	switch resolution {
	case "5":
		interval = "5m"
	case "60":
		interval = "1h"
	case "D":
		interval = "1d"
	case "W":
		interval = "1wk"
	case "M":
		interval = "1mo"
	default:
		interval = "1d"
	}

	url := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=%s&period1=%d&period2=%d",
		ticker, interval, from, to,
	)

	var raw struct {
		Chart struct {
			Result []struct {
				Timestamp  []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Open   []float64 `json:"open"`
						High   []float64 `json:"high"`
						Low    []float64 `json:"low"`
						Close  []float64 `json:"close"`
						Volume []float64 `json:"volume"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
			Error interface{} `json:"error"`
		} `json:"chart"`
	}

	if err := m.getPlain(url, &raw); err != nil {
		log.Printf("yahoo finance error for %s: %v", ticker, err)
		return nil, fmt.Errorf("candle fetch failed: %w", err)
	}

	if len(raw.Chart.Result) == 0 {
		return nil, fmt.Errorf("no candle data for %s", ticker)
	}

	result := raw.Chart.Result[0]
	if len(result.Timestamp) == 0 || len(result.Indicators.Quote) == 0 {
		return nil, fmt.Errorf("no candle data for %s", ticker)
	}

	quotes := result.Indicators.Quote[0]
	candles := make([]Candle, 0, len(result.Timestamp))

	for i, ts := range result.Timestamp {
		if i >= len(quotes.Close) || quotes.Close[i] == 0 {
			continue
		}
		candles = append(candles, Candle{
			Time:   ts,
			Open:   quotes.Open[i],
			High:   quotes.High[i],
			Low:    quotes.Low[i],
			Close:  quotes.Close[i],
			Volume: quotes.Volume[i],
		})
	}

	if len(candles) == 0 {
		return nil, fmt.Errorf("no candle data for %s", ticker)
	}

	sort.Slice(candles, func(i, j int) bool {
		return candles[i].Time < candles[j].Time
	})

	m.setCache(cacheKey, candles, 60*time.Second)
	return candles, nil
}

// parseFloat safely converts interface{} to float64
func parseFloat(v interface{}) float64 {
	s, ok := v.(string)
	if !ok {
		return 0
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// ─── SearchAssets ─────────────────────────────────────────────────────────────

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

// ─── GetProfile ───────────────────────────────────────────────────────────────
// Order: in-memory cache → DB (permanent) → Finnhub live

func (m *MarketService) GetProfile(ticker, assetType string) (*AssetProfile, error) {
	cacheKey := "profile:" + ticker

	// 1. In-memory cache (1 hour)
	if cached, ok := m.getCache(cacheKey); ok {
		p := cached.(AssetProfile)
		return &p, nil
	}

	// 2. DB cache (permanent — profile data rarely changes)
	if dbProfile, err := m.getProfileFromDB(ticker); err == nil {
		m.setCache(cacheKey, *dbProfile, time.Hour)
		return dbProfile, nil
	}

	// 3. Fetch from Finnhub and persist
	url := fmt.Sprintf("%s/stock/profile2?symbol=%s", m.baseURL, ticker)
	var raw struct {
		Name     string `json:"name"`
		Ticker   string `json:"ticker"`
		Exchange string `json:"exchange"`
		Currency string `json:"currency"`
		Logo     string `json:"logo"`
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

	m.saveProfileToDB(&profile)
	m.setCache(cacheKey, profile, time.Hour)
	return &profile, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

func (m *MarketService) getPlain(url string, target interface{}) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}

	// Required for Yahoo Finance — blocks requests without a browser User-Agent
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json")

	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("returned status %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}
