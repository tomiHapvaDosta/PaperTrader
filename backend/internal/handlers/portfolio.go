// internal/handlers/portfolio.go
// Purpose: HTTP handlers for portfolio summary and snapshots.
// Depends on: internal/services/market.go, internal/db/db.go, internal/auth/jwt.go

package handlers

import (
	"database/sql"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/tomiHapvaDosta/PaperTrader/internal/auth"
	"github.com/tomiHapvaDosta/PaperTrader/internal/services"
)

type PortfolioHandler struct {
	db     *sql.DB
	market *services.MarketService
}

func NewPortfolioHandler(db *sql.DB, market *services.MarketService) *PortfolioHandler {
	return &PortfolioHandler{db: db, market: market}
}

func getUserID(r *http.Request) (int64, bool) {
	claims, ok := r.Context().Value(auth.ContextKeyClaims).(*auth.Claims)
	if !ok || claims == nil {
		return 0, false
	}
	return int64(claims.UserID), true
}

func roundMoney(v float64) float64 {
	return math.Round(v*100) / 100
}

// GET /api/v1/portfolio
func (h *PortfolioHandler) GetPortfolioHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	var cashBalance, startingBalance float64
	err := h.db.QueryRow(
		"SELECT cash_balance, starting_balance FROM portfolios WHERE user_id = ?", userID,
	).Scan(&cashBalance, &startingBalance)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}

	rows, err := h.db.Query(
		"SELECT ticker, asset_type, quantity, avg_buy_price FROM positions WHERE user_id = ?", userID,
	)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}
	defer rows.Close()

	type positionView struct {
		Ticker        string  `json:"ticker"`
		AssetType     string  `json:"asset_type"`
		Quantity      float64 `json:"quantity"`
		AvgBuyPrice   float64 `json:"avg_buy_price"`
		CurrentPrice  float64 `json:"current_price"`
		PositionValue float64 `json:"position_value"`
		PnL           float64 `json:"pnl"`
		PnLPercent    float64 `json:"pnl_percent"`
	}

	positions := make([]positionView, 0)
	totalPositionValue := 0.0

	for rows.Next() {
		var ticker, assetType string
		var quantity, avgBuyPrice float64
		if err := rows.Scan(&ticker, &assetType, &quantity, &avgBuyPrice); err != nil {
			continue
		}

		currentPrice := avgBuyPrice // fallback if quote fails
		if quote, err := h.market.GetQuote(ticker, assetType); err == nil {
			currentPrice = quote.Price
		}

		posValue := roundMoney(quantity * currentPrice)
		pnl := roundMoney((currentPrice - avgBuyPrice) * quantity)
		pnlPct := 0.0
		if avgBuyPrice > 0 {
			pnlPct = roundMoney(((currentPrice - avgBuyPrice) / avgBuyPrice) * 100)
		}

		totalPositionValue += posValue
		positions = append(positions, positionView{
			Ticker:        ticker,
			AssetType:     assetType,
			Quantity:      quantity,
			AvgBuyPrice:   avgBuyPrice,
			CurrentPrice:  currentPrice,
			PositionValue: posValue,
			PnL:           pnl,
			PnLPercent:    pnlPct,
		})
	}

	totalValue := roundMoney(cashBalance + totalPositionValue)
	totalPnL := roundMoney(totalValue - startingBalance)
	totalPnLPct := 0.0
	if startingBalance > 0 {
		totalPnLPct = roundMoney((totalPnL / startingBalance) * 100)
	}

	respondJSON(w, http.StatusOK, apiResponse{
		Success: true,
		Data: map[string]any{
			"cash_balance":      roundMoney(cashBalance),
			"starting_balance":  roundMoney(startingBalance),
			"total_value":       totalValue,
			"total_pnl":         totalPnL,
			"total_pnl_percent": totalPnLPct,
			"positions":         positions,
		},
	})
}

// GET /api/v1/portfolio/snapshots
func (h *PortfolioHandler) GetSnapshotsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil {
			days = parsed
		}
	}
	if days > 365 {
		days = 365
	}
	if days < 1 {
		days = 1
	}

	since := time.Now().UTC().AddDate(0, 0, -days)

	rows, err := h.db.Query(`
		SELECT total_value, created_at FROM portfolio_snapshots
		WHERE user_id = ? AND created_at >= ?
		ORDER BY created_at ASC`,
		userID, since,
	)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}
	defer rows.Close()

	type snapshot struct {
		TotalValue float64   `json:"total_value"`
		CreatedAt  time.Time `json:"created_at"`
	}

	snapshots := make([]snapshot, 0)
	for rows.Next() {
		var s snapshot
		if err := rows.Scan(&s.TotalValue, &s.CreatedAt); err != nil {
			continue
		}
		snapshots = append(snapshots, s)
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: snapshots})
}
