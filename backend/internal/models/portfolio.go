// portfolio.go defines portfolio models used by PaperTrader.
package models

import "time"

type Portfolio struct {
	ID              int       `json:"id"`
	UserID          int       `json:"user_id"`
	CashBalance     float64   `json:"cash_balance"`
	StartingBalance float64   `json:"starting_balance"`
	CreatedAt       time.Time `json:"created_at"`
}

type PortfolioSnapshot struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	TotalValue float64   `json:"total_value"`
	CreatedAt  time.Time `json:"created_at"`
}
