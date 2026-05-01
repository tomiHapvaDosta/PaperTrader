// internal/handlers/fees.go
// Purpose: HTTP handler for fee estimation before placing an order.
// Depends on: internal/services/fee.go, internal/services/market.go

package handlers

import (
	"net/http"
	"strconv"

	"github.com/tomiHapvaDosta/PaperTrader/internal/services"
)

type FeesHandler struct {
	market *services.MarketService
}

func NewFeesHandler(market *services.MarketService) *FeesHandler {
	return &FeesHandler{market: market}
}

// GET /api/v1/fees/estimate
func (h *FeesHandler) EstimateFeeHandler(w http.ResponseWriter, r *http.Request) {
	ticker := r.URL.Query().Get("ticker")
	assetType := r.URL.Query().Get("asset_type")
	quantityStr := r.URL.Query().Get("quantity")
	priceStr := r.URL.Query().Get("price")

	if ticker == "" || assetType == "" || quantityStr == "" {
		respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.missing_params"})
		return
	}

	quantity, err := strconv.ParseFloat(quantityStr, 64)
	if err != nil || quantity <= 0 {
		respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_quantity"})
		return
	}

	var price float64
	if priceStr != "" {
		price, err = strconv.ParseFloat(priceStr, 64)
		if err != nil || price <= 0 {
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_price"})
			return
		}
	} else {
		quote, err := h.market.GetQuote(ticker, assetType)
		if err != nil {
			respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "market.quote_error"})
			return
		}
		price = quote.Price
	}

	tradeValue := roundMoney(quantity * price)
	fee := services.CalculateFee(assetType, tradeValue)
	totalCost := roundMoney(tradeValue + fee)

	respondJSON(w, http.StatusOK, apiResponse{
		Success: true,
		Data: map[string]any{
			"ticker":      ticker,
			"quantity":    quantity,
			"price":       price,
			"trade_value": tradeValue,
			"fee":         fee,
			"total_cost":  totalCost,
		},
	})
}
