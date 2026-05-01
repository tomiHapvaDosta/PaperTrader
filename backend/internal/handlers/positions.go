// positions.go contains position route stubs for PaperTrader.
package handlers

import (
	"net/http"
)

func PositionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: "coming soon"})
}
