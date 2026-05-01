// internal/services/order.go
// Purpose: Core trading business logic — order execution, position management, pending order checking.
// Depends on: internal/models, internal/services/fee.go, internal/services/market.go

package services

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/tomiHapvaDosta/PaperTrader/internal/models"
)

var (
	ErrInsufficientFunds    = errors.New("order.insufficient_funds")
	ErrInsufficientPosition = errors.New("order.insufficient_position")
	ErrOrderNotFound        = errors.New("order.not_found")
	ErrOrderNotPending      = errors.New("order.not_pending")
	ErrInvalidOrder         = errors.New("order.invalid_request")
)

type OrderService struct {
	db            *sql.DB
	marketService *MarketService
}

func NewOrderService(db *sql.DB, marketService *MarketService) *OrderService {
	return &OrderService{db: db, marketService: marketService}
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// ─── PlaceOrder ──────────────────────────────────────────────────────────────

func (s *OrderService) PlaceOrder(userID int64, req models.OrderRequest) (*models.Order, error) {
	// 1. Validate request fields
	if req.Ticker == "" || req.AssetType == "" || req.OrderType == "" || req.Side == "" {
		return nil, ErrInvalidOrder
	}
	if req.Quantity <= 0 && req.AmountUSD <= 0 {
		return nil, ErrInvalidOrder
	}
	if req.Side != "buy" && req.Side != "sell" {
		return nil, ErrInvalidOrder
	}
	if req.OrderType != "market" && req.OrderType != "limit" && req.OrderType != "stop_loss" {
		return nil, ErrInvalidOrder
	}

	// 2. Fetch current price
	quote, err := s.marketService.GetQuote(req.Ticker, req.AssetType)
	if err != nil {
		return nil, fmt.Errorf("fetch quote: %w", err)
	}
	price := quote.Price

	// 3. Calculate quantity from amount_usd if provided
	quantity := req.Quantity
	if req.AmountUSD > 0 {
		quantity = round2(req.AmountUSD / price)
	}

	// 4. Calculate trade value and fee
	tradeValue := round2(quantity * price)
	fee := CalculateFee(req.AssetType, tradeValue)

	order := &models.Order{
		UserID:     int(userID),
		Ticker:     req.Ticker,
		AssetType:  req.AssetType,
		OrderType:  req.OrderType,
		Side:       req.Side,
		Quantity:   quantity,
		Price:      price,
		LimitPrice: req.LimitPrice,
		StopPrice:  req.StopPrice,
		Fee:        fee,
		Status:     "pending",
		CreatedAt:  time.Now().UTC(),
	}

	if req.Side == "buy" {
		// 5. Check sufficient funds
		var cashBalance float64
		err := s.db.QueryRow("SELECT cash_balance FROM portfolios WHERE user_id = ?", userID).Scan(&cashBalance)
		if err != nil {
			return nil, fmt.Errorf("fetch cash balance: %w", err)
		}
		if req.OrderType == "market" && cashBalance < tradeValue+fee {
			return nil, ErrInsufficientFunds
		}

		if req.OrderType == "market" {
			tx, err := s.db.Begin()
			if err != nil {
				return nil, fmt.Errorf("begin tx: %w", err)
			}
			if err := s.executeOrder(tx, userID, order, price); err != nil {
				_ = tx.Rollback()
				return nil, err
			}
			if err := tx.Commit(); err != nil {
				return nil, fmt.Errorf("commit tx: %w", err)
			}
		} else {
			if err := s.storePendingOrder(order); err != nil {
				return nil, err
			}
		}
	} else {
		// sell — check position
		var ownedQty float64
		err := s.db.QueryRow(
			"SELECT quantity FROM positions WHERE user_id = ? AND ticker = ?",
			userID, req.Ticker,
		).Scan(&ownedQty)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, ErrInsufficientPosition
			}
			return nil, fmt.Errorf("fetch position: %w", err)
		}
		if quantity > ownedQty {
			return nil, ErrInsufficientPosition
		}

		if req.OrderType == "market" {
			tx, err := s.db.Begin()
			if err != nil {
				return nil, fmt.Errorf("begin tx: %w", err)
			}
			if err := s.executeOrder(tx, userID, order, price); err != nil {
				_ = tx.Rollback()
				return nil, err
			}
			if err := tx.Commit(); err != nil {
				return nil, fmt.Errorf("commit tx: %w", err)
			}
		} else {
			if err := s.storePendingOrder(order); err != nil {
				return nil, err
			}
		}
	}

	return order, nil
}

// ─── executeOrder ─────────────────────────────────────────────────────────────

func (s *OrderService) executeOrder(tx *sql.Tx, userID int64, order *models.Order, price float64) error {
	now := time.Now().UTC()
	tradeValue := round2(order.Quantity * price)

	// 1. Insert order as executed
	result, err := tx.Exec(`
		INSERT INTO orders (user_id, ticker, asset_type, order_type, side, quantity, price,
		limit_price, stop_price, status, fee, executed_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'executed', ?, ?, ?)`,
		userID, order.Ticker, order.AssetType, order.OrderType, order.Side,
		order.Quantity, price, order.LimitPrice, order.StopPrice,
		order.Fee, now, now,
	)
	if err != nil {
		return fmt.Errorf("insert order: %w", err)
	}
	id, _ := result.LastInsertId()
	order.ID = int(id)
	order.Status = "executed"
	order.ExecutedAt = now
	order.Price = price

	if order.Side == "buy" {
		// Deduct from cash
		_, err = tx.Exec(
			"UPDATE portfolios SET cash_balance = cash_balance - ? WHERE user_id = ?",
			round2(tradeValue+order.Fee), userID,
		)
		if err != nil {
			return fmt.Errorf("deduct cash: %w", err)
		}

		// Upsert position
		var existingQty, existingAvg float64
		err = tx.QueryRow(
			"SELECT quantity, avg_buy_price FROM positions WHERE user_id = ? AND ticker = ?",
			userID, order.Ticker,
		).Scan(&existingQty, &existingAvg)

		if errors.Is(err, sql.ErrNoRows) {
			_, err = tx.Exec(`
				INSERT INTO positions (user_id, ticker, asset_type, quantity, avg_buy_price, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				userID, order.Ticker, order.AssetType, order.Quantity, price, now, now,
			)
			if err != nil {
				return fmt.Errorf("insert position: %w", err)
			}
		} else if err == nil {
			newQty := existingQty + order.Quantity
			newAvg := round2((existingQty*existingAvg + order.Quantity*price) / newQty)
			_, err = tx.Exec(
				"UPDATE positions SET quantity = ?, avg_buy_price = ?, updated_at = ? WHERE user_id = ? AND ticker = ?",
				newQty, newAvg, now, userID, order.Ticker,
			)
			if err != nil {
				return fmt.Errorf("update position: %w", err)
			}
		} else {
			return fmt.Errorf("query position: %w", err)
		}

	} else {
		// Add proceeds to cash
		proceeds := round2(tradeValue - order.Fee)
		_, err = tx.Exec(
			"UPDATE portfolios SET cash_balance = cash_balance + ? WHERE user_id = ?",
			proceeds, userID,
		)
		if err != nil {
			return fmt.Errorf("add proceeds: %w", err)
		}

		// Reduce position
		var existingQty float64
		err = tx.QueryRow(
			"SELECT quantity FROM positions WHERE user_id = ? AND ticker = ?",
			userID, order.Ticker,
		).Scan(&existingQty)
		if err != nil {
			return fmt.Errorf("query position for sell: %w", err)
		}

		newQty := round2(existingQty - order.Quantity)
		if newQty <= 0 {
			_, err = tx.Exec(
				"DELETE FROM positions WHERE user_id = ? AND ticker = ?",
				userID, order.Ticker,
			)
		} else {
			_, err = tx.Exec(
				"UPDATE positions SET quantity = ?, updated_at = ? WHERE user_id = ? AND ticker = ?",
				newQty, now, userID, order.Ticker,
			)
		}
		if err != nil {
			return fmt.Errorf("update position for sell: %w", err)
		}
	}

	return nil
}

// ─── storePendingOrder ────────────────────────────────────────────────────────

func (s *OrderService) storePendingOrder(order *models.Order) error {
	result, err := s.db.Exec(`
		INSERT INTO orders (user_id, ticker, asset_type, order_type, side, quantity, price,
		limit_price, stop_price, status, fee, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
		order.UserID, order.Ticker, order.AssetType, order.OrderType, order.Side,
		order.Quantity, order.Price, order.LimitPrice, order.StopPrice,
		order.Fee, order.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert pending order: %w", err)
	}
	id, _ := result.LastInsertId()
	order.ID = int(id)
	return nil
}

// ─── CancelOrder ─────────────────────────────────────────────────────────────

func (s *OrderService) CancelOrder(userID int64, orderID int64) error {
	var status string
	var ownerID int
	err := s.db.QueryRow(
		"SELECT user_id, status FROM orders WHERE id = ?", orderID,
	).Scan(&ownerID, &status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrOrderNotFound
		}
		return fmt.Errorf("query order: %w", err)
	}
	if int64(ownerID) != userID {
		return ErrOrderNotFound // don't reveal existence to wrong user
	}
	if status != "pending" {
		return ErrOrderNotPending
	}

	_, err = s.db.Exec(
		"UPDATE orders SET status = 'cancelled' WHERE id = ?", orderID,
	)
	return err
}

// ─── CheckPendingOrders ───────────────────────────────────────────────────────

func (s *OrderService) CheckPendingOrders() error {
	rows, err := s.db.Query(`
		SELECT id, user_id, ticker, asset_type, order_type, side,
		       quantity, price, limit_price, stop_price, fee
		FROM orders WHERE status = 'pending'`,
	)
	if err != nil {
		return fmt.Errorf("query pending orders: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var o models.Order
		if err := rows.Scan(
			&o.ID, &o.UserID, &o.Ticker, &o.AssetType, &o.OrderType, &o.Side,
			&o.Quantity, &o.Price, &o.LimitPrice, &o.StopPrice, &o.Fee,
		); err != nil {
			log.Printf("scan pending order: %v", err)
			continue
		}

		quote, err := s.marketService.GetQuote(o.Ticker, o.AssetType)
		if err != nil {
			log.Printf("fetch quote for %s: %v", o.Ticker, err)
			continue
		}
		currentPrice := quote.Price

		shouldExecute := false
		switch o.OrderType {
		case "limit":
			if o.Side == "buy" && currentPrice <= o.LimitPrice {
				shouldExecute = true
			} else if o.Side == "sell" && currentPrice >= o.LimitPrice {
				shouldExecute = true
			}
		case "stop_loss":
			if o.Side == "sell" && currentPrice <= o.StopPrice {
				shouldExecute = true
			}
		}

		if !shouldExecute {
			continue
		}

		tx, err := s.db.Begin()
		if err != nil {
			log.Printf("begin tx for order %d: %v", o.ID, err)
			continue
		}

		// Delete the pending order first, then execute fresh
		if _, err := tx.Exec("DELETE FROM orders WHERE id = ?", o.ID); err != nil {
			_ = tx.Rollback()
			log.Printf("delete pending order %d: %v", o.ID, err)
			continue
		}

		if err := s.executeOrder(tx, int64(o.UserID), &o, currentPrice); err != nil {
			_ = tx.Rollback()
			log.Printf("execute pending order %d: %v", o.ID, err)
			continue
		}

		if err := tx.Commit(); err != nil {
			log.Printf("commit order %d: %v", o.ID, err)
			continue
		}

		log.Printf("executed pending order %d: %s %s %s @ %.2f", o.ID, o.Side, o.Ticker, o.OrderType, currentPrice)
	}

	return rows.Err()
}

// ─── Portfolio Snapshots ──────────────────────────────────────────────────────

func (s *OrderService) TakePortfolioSnapshot(userID int64) error {
	var cashBalance float64
	if err := s.db.QueryRow(
		"SELECT cash_balance FROM portfolios WHERE user_id = ?", userID,
	).Scan(&cashBalance); err != nil {
		return fmt.Errorf("fetch cash balance: %w", err)
	}

	rows, err := s.db.Query(
		"SELECT ticker, asset_type, quantity FROM positions WHERE user_id = ?", userID,
	)
	if err != nil {
		return fmt.Errorf("fetch positions: %w", err)
	}
	defer rows.Close()

	total := cashBalance
	for rows.Next() {
		var ticker, assetType string
		var quantity float64
		if err := rows.Scan(&ticker, &assetType, &quantity); err != nil {
			continue
		}
		quote, err := s.marketService.GetQuote(ticker, assetType)
		if err != nil {
			continue
		}
		total += quantity * quote.Price
	}

	_, err = s.db.Exec(
		"INSERT INTO portfolio_snapshots (user_id, total_value, created_at) VALUES (?, ?, ?)",
		userID, round2(total), time.Now().UTC(),
	)
	return err
}

func (s *OrderService) TakeAllSnapshots() error {
	rows, err := s.db.Query("SELECT id FROM users")
	if err != nil {
		return fmt.Errorf("fetch users: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		if err := s.TakePortfolioSnapshot(userID); err != nil {
			log.Printf("snapshot for user %d: %v", userID, err)
		}
	}
	return rows.Err()
}
