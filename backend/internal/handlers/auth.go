// auth.go contains authentication route stubs for PaperTrader.
package handlers

import (
	"encoding/json"
	"net/http"
)

type apiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: "coming soon"})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, http.StatusOK, apiResponse{Success: true, Data: "coming soon"})
}

func respondJSON(w http.ResponseWriter, status int, payload apiResponse) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
