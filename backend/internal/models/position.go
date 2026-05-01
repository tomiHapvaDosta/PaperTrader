// position.go defines the Position model used by PaperTrader.
package models

import "time"

type Position struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	Ticker      string    `json:"ticker"`
	AssetType   string    `json:"asset_type"`
	Quantity    float64   `json:"quantity"`
	AvgBuyPrice float64   `json:"avg_buy_price"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
