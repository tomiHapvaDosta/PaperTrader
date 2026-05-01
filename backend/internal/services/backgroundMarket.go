// market.go contains the market data service for PaperTrader.
//
// Market API choice: Finnhub is selected because its free tier covers
// stocks, ETFs, crypto, forex, and commodities; provides real-time quotes,
// OHLCV candle data, and symbol search; and requires no credit card to begin.
// Rate limits on the free plan are 60 requests per minute.
package services

import (
	"net/url"
	"os"
)

const MarketAPIBaseURL = "https://finnhub.io/api/v1"

func BuildMarketURL(path string, params map[string]string) (string, error) {
	baseURL := os.Getenv("MARKET_API_BASE_URL")
	if baseURL == "" {
		baseURL = MarketAPIBaseURL
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}
	u.Path = u.Path + path
	query := u.Query()
	for key, value := range params {
		query.Set(key, value)
	}
	query.Set("token", os.Getenv("MARKET_API_KEY"))
	u.RawQuery = query.Encode()
	return u.String(), nil
}

func CheckPendingOrders(db interface{}) error {
	// Placeholder implementation. The real version will execute pending limit
	// and stop-loss orders against live market prices every 30 seconds.
	return nil
}

func SavePortfolioSnapshots(db interface{}) error {
	// Placeholder implementation. The real version will snapshot user portfolio
	// values once per hour for historical performance charts.
	return nil
}
