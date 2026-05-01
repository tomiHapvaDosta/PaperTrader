// main.go starts the PaperTrader backend server and wires middleware, routes, and background tasks.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/tomiHapvaDosta/PaperTrader/internal/auth"
	"github.com/tomiHapvaDosta/PaperTrader/internal/db"
	"github.com/tomiHapvaDosta/PaperTrader/internal/handlers"
	"github.com/tomiHapvaDosta/PaperTrader/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	database, err := db.OpenDB()
	if err != nil {
		log.Fatalf("database initialization failed: %v", err)
	}
	defer database.Close()

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(httprate.LimitByIP(100, 1*time.Minute))
	r.Use(jsonContentTypeMiddleware)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/register", handlers.RegisterHandler(database))
		r.Post("/auth/login", handlers.LoginHandler(database))

		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware)
			r.Get("/portfolio", handlers.PortfolioHandler)
			r.Get("/portfolio/snapshots", handlers.PortfolioSnapshotsHandler)
			r.Get("/positions", handlers.PositionsHandler)
			r.Get("/orders", handlers.OrdersHandler)
			r.Post("/orders", handlers.PlaceOrderHandler)
			r.Delete("/orders/{id}", handlers.CancelOrderHandler)
			r.Get("/market/quote/{ticker}", handlers.QuoteHandler)
			r.Get("/market/candles/{ticker}", handlers.CandlesHandler)
			r.Get("/market/search", handlers.SearchHandler)
			r.Get("/market/profile/{ticker}", handlers.ProfileHandler)
			r.Get("/fees/estimate", handlers.FeeEstimateHandler)
		})
	})

	go startPendingOrderChecker(database)
	go startSnapshotSaver(database)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: r,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("PaperTrader backend running on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server shutdown failed: %v", err)
	}
	log.Println("server stopped")
}

func jsonContentTypeMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

func startPendingOrderChecker(database *sql.DB) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		_ = services.CheckPendingOrders(database)
	}
}

func startSnapshotSaver(database *sql.DB) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		_ = services.SavePortfolioSnapshots(database)
	}
}
