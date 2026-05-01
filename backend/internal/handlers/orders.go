// internal/handlers/orders.go
// Purpose: HTTP handlers for order listing, placement, and cancellation.
// Depends on: internal/services/order.go, internal/auth/jwt.go

package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/tomiHapvaDosta/PaperTrader/internal/models"
	"github.com/tomiHapvaDosta/PaperTrader/internal/services"
)

type OrdersHandler struct {
	db           *sql.DB
	orderService *services.OrderService
}

func NewOrdersHandler(db *sql.DB, orderService *services.OrderService) *OrdersHandler {
	return &OrdersHandler{db: db, orderService: orderService}
}

// GET /api/v1/orders
func (h *OrdersHandler) GetOrdersHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	status := r.URL.Query().Get("status")
	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 100 {
		limit = 100
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	query := `SELECT id, ticker, asset_type, order_type, side, quantity, price,
	           limit_price, stop_price, status, fee, executed_at, created_at
	           FROM orders WHERE user_id = ?`
	countQuery := `SELECT COUNT(*) FROM orders WHERE user_id = ?`
	args := []any{userID}
	countArgs := []any{userID}

	if status != "" && status != "all" {
		query += " AND status = ?"
		countQuery += " AND status = ?"
		args = append(args, status)
		countArgs = append(countArgs, status)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	var total int
	if err := h.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}

	rows, err := h.db.Query(query, args...)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		return
	}
	defer rows.Close()

	orders := make([]models.Order, 0)
	for rows.Next() {
		var o models.Order
		if err := rows.Scan(
			&o.ID, &o.Ticker, &o.AssetType, &o.OrderType, &o.Side,
			&o.Quantity, &o.Price, &o.LimitPrice, &o.StopPrice,
			&o.Status, &o.Fee, &o.ExecutedAt, &o.CreatedAt,
		); err != nil {
			continue
		}
		orders = append(orders, o)
	}

	respondJSON(w, http.StatusOK, apiResponse{
		Success: true,
		Data: map[string]any{
			"orders": orders,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// POST /api/v1/orders
func (h *OrdersHandler) PlaceOrderHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	var req models.OrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_json"})
		return
	}

	order, err := h.orderService.PlaceOrder(userID, req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidOrder):
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: err.Error()})
		case errors.Is(err, services.ErrInsufficientFunds),
			errors.Is(err, services.ErrInsufficientPosition):
			respondJSON(w, http.StatusUnprocessableEntity, apiResponse{Success: false, Error: err.Error()})
		default:
			respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		}
		return
	}

	respondJSON(w, http.StatusCreated, apiResponse{Success: true, Data: order})
}

// DELETE /api/v1/orders/{id}
func (h *OrdersHandler) CancelOrderHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: "auth.unauthorized"})
		return
	}

	idStr := chi.URLParam(r, "id")
	orderID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_id"})
		return
	}

	if err := h.orderService.CancelOrder(userID, orderID); err != nil {
		switch {
		case errors.Is(err, services.ErrOrderNotFound):
			respondJSON(w, http.StatusNotFound, apiResponse{Success: false, Error: err.Error()})
		case errors.Is(err, services.ErrOrderNotPending):
			respondJSON(w, http.StatusUnprocessableEntity, apiResponse{Success: false, Error: err.Error()})
		default:
			respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
		}
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true})
}
