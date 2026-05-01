// order.go defines the Order model and request payloads for PaperTrader.
package models

import "time"

type Order struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	Ticker     string    `json:"ticker"`
	AssetType  string    `json:"asset_type"`
	OrderType  string    `json:"order_type"`
	Side       string    `json:"side"`
	Quantity   float64   `json:"quantity"`
	Price      float64   `json:"price"`
	LimitPrice float64   `json:"limit_price,omitempty"`
	StopPrice  float64   `json:"stop_price,omitempty"`
	Status     string    `json:"status"`
	Fee        float64   `json:"fee"`
	ExecutedAt time.Time `json:"executed_at,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type OrderRequest struct {
	Ticker     string  `json:"ticker"`
	AssetType  string  `json:"asset_type"`
	OrderType  string  `json:"order_type"`
	Side       string  `json:"side"`
	Quantity   float64 `json:"quantity"`
	AmountUSD  float64 `json:"amount_usd"`
	LimitPrice float64 `json:"limit_price"`
	StopPrice  float64 `json:"stop_price"`
}
