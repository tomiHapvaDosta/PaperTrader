// internal/handlers/auth.go
// Purpose: HTTP handlers for authentication routes. Thin layer — delegates to services/auth.go.
// Depends on: internal/services/auth.go

package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	//"github.com/tomiHapvaDosta/PaperTrader/internal/db"
	"github.com/tomiHapvaDosta/PaperTrader/internal/services"
)

// respondJSON writes a JSON response with the given status code and payload.
func respondJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// apiResponse is the standard envelope for all API responses.
type apiResponse struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

// setAuthCookie sets an httpOnly JWT cookie valid for 24 hours.
func setAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(24 * time.Hour),
		MaxAge:   86400,
	})
}

// clearAuthCookie expires the JWT cookie immediately.
func clearAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

// RegisterHandler handles POST /api/v1/auth/register
func RegisterHandler(database *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, http.StatusMethodNotAllowed, apiResponse{Success: false, Error: "method_not_allowed"})
			return
		}

		var req struct {
			Email           string  `json:"email"`
			Username        string  `json:"username"`
			Password        string  `json:"password"`
			StartingBalance float64 `json:"starting_balance"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_json"})
			return
		}

		result, err := services.RegisterUser(database, req.Email, req.Username, req.Password, req.StartingBalance)
		if err != nil {
			switch {
			case errors.Is(err, services.ErrInvalidEmail),
				errors.Is(err, services.ErrInvalidUsername),
				errors.Is(err, services.ErrPasswordTooShort),
				errors.Is(err, services.ErrInvalidBalance):
				respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: err.Error()})
			case errors.Is(err, services.ErrEmailTaken),
				errors.Is(err, services.ErrUsernameTaken):
				respondJSON(w, http.StatusConflict, apiResponse{Success: false, Error: err.Error()})
				log.Printf("register error: %v", err)

			default:
				log.Printf("register error: %v", err)
				respondJSON(w, http.StatusInternalServerError, apiResponse{Success: false, Error: "server.internal_error"})
			}
			return
		}

		setAuthCookie(w, result.Token)
		respondJSON(w, http.StatusCreated, apiResponse{
			Success: true,
			Data: map[string]any{
				"user":             result.User,
				"starting_balance": result.Balance,
			},
		})
	}
}

// LoginHandler handles POST /api/v1/auth/login
func LoginHandler(database *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, http.StatusMethodNotAllowed, apiResponse{Success: false, Error: "method_not_allowed"})
			return
		}

		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, http.StatusBadRequest, apiResponse{Success: false, Error: "request.invalid_json"})
			return
		}

		result, err := services.LoginUser(database, req.Email, req.Password)
		if err != nil {
			// Always 401 with generic message — never reveal why login failed
			respondJSON(w, http.StatusUnauthorized, apiResponse{Success: false, Error: services.ErrInvalidCredentials.Error()})
			return
		}

		setAuthCookie(w, result.Token)
		respondJSON(w, http.StatusOK, apiResponse{
			Success: true,
			Data: map[string]any{
				"user": result.User,
			},
		})
	}
}

// LogoutHandler handles POST /api/v1/auth/logout
// No authentication required — anyone can call this to clear their cookie.
func LogoutHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, http.StatusMethodNotAllowed, apiResponse{Success: false, Error: "method_not_allowed"})
			return
		}

		clearAuthCookie(w)
		respondJSON(w, http.StatusOK, apiResponse{Success: true})
	}
}
