// internal/handlers/market.go
// Purpose: HTTP handlers for market data routes.
// Thin layer — calls MarketService only, no business logic here.
// Depends on: internal/services/market.go

package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/tomiHapvaDosta/PaperTrader/internal/services"
)

type MarketHandler struct {
	market *services.MarketService
}

func NewMarketHandler(market *services.MarketService) *MarketHandler {
	return &MarketHandler{market: market}
}

// GET /api/v1/market/quote/:ticker
func (h *MarketHandler) GetQuoteHandler(w http.ResponseWriter, r *http.Request) {
	ticker := strings.ToUpper(chi.URLParam(r, "ticker"))
	assetType := r.URL.Query().Get("asset_type")
	if assetType == "" {
		assetType = "stock"
	}

	quote, err := h.market.GetQuote(ticker, assetType)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondJSON(w, http.StatusNotFound, apiResponse{Success: false, Error: "market.ticker_not_found"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "market.quote_error"})
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: quote})
}

// GET /api/v1/market/candles/:ticker
func (h *MarketHandler) GetCandlesHandler(w http.ResponseWriter, r *http.Request) {
	ticker := strings.ToUpper(chi.URLParam(r, "ticker"))
	assetType := r.URL.Query().Get("asset_type")
	if assetType == "" {
		assetType = "stock"
	}

	resolution := r.URL.Query().Get("resolution")
	if resolution == "" {
		resolution = "D"
	}

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	var from, to int64
	var err error

	if fromStr == "" {
		from = time.Now().AddDate(0, -1, 0).Unix()
	} else {
		from, err = strconv.ParseInt(fromStr, 10, 64)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "market.invalid_from"})
			return
		}
	}

	if toStr == "" {
		to = time.Now().Unix()
	} else {
		to, err = strconv.ParseInt(toStr, 10, 64)
		if err != nil {
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "market.invalid_to"})
			return
		}
	}

	candles, err := h.market.GetCandles(ticker, assetType, from, to, resolution)
	if err != nil {
		if strings.Contains(err.Error(), "no candle data") {
			respondJSON(w, http.StatusNotFound, apiResponse{Success: false, Error: "market.no_candle_data"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "market.candles_error"})
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: candles})
}

// GET /api/v1/market/search?q=
func (h *MarketHandler) SearchAssetsHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "market.query_too_short"})
		return
	}

	results, err := h.market.SearchAssets(q)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "market.search_error"})
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: results})
}

// GET /api/v1/market/profile/:ticker
func (h *MarketHandler) GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	ticker := strings.ToUpper(chi.URLParam(r, "ticker"))
	assetType := r.URL.Query().Get("asset_type")
	if assetType == "" {
		assetType = "stock"
	}

	profile, err := h.market.GetProfile(ticker, assetType)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondJSON(w, http.StatusNotFound, apiResponse{Success: false, Error: "market.profile_not_found"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "market.profile_error"})
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: profile})
}
