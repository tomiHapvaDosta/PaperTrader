// internal/handlers/positions.go
// Purpose: HTTP handler for open positions route.
// Depends on: internal/db/db.go, internal/auth/jwt.go

package handlers

import (
	"database/sql"
	"net/http"
	"time"
)

type PositionsHandler struct {
	db *sql.DB
}

func NewPositionsHandler(db *sql.DB) *PositionsHandler {
	return &PositionsHandler{db: db}
}

// GET /api/v1/positions
func (h *PositionsHandler) GetPositionsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	rows, err := h.db.Query(`
		SELECT ticker, asset_type, quantity, avg_buy_price, created_at, updated_at
		FROM positions WHERE user_id = ?
		ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}
	defer rows.Close()

	type positionRow struct {
		Ticker      string    `json:"ticker"`
		AssetType   string    `json:"asset_type"`
		Quantity    float64   `json:"quantity"`
		AvgBuyPrice float64   `json:"avg_buy_price"`
		CreatedAt   time.Time `json:"created_at"`
		UpdatedAt   time.Time `json:"updated_at"`
	}

	positions := make([]positionRow, 0)
	for rows.Next() {
		var p positionRow
		if err := rows.Scan(&p.Ticker, &p.AssetType, &p.Quantity, &p.AvgBuyPrice, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		positions = append(positions, p)
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: positions})
}
