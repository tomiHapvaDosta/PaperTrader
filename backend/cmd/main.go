// main.go starts the PaperTrader backend server and wires middleware, routes, and background tasks.
package main

import (
	"context"
	//"database/sql"
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
	log.Println("JWT_SECRET:", os.Getenv("JWT_SECRET"))

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

	marketSvc := services.NewMarketService(database)
	orderSvc := services.NewOrderService(database, marketSvc)

	marketHandler := handlers.NewMarketHandler(marketSvc)
	portfolioHandler := handlers.NewPortfolioHandler(database, marketSvc)
	positionsHandler := handlers.NewPositionsHandler(database)
	ordersHandler := handlers.NewOrdersHandler(database, orderSvc)
	feesHandler := handlers.NewFeesHandler(marketSvc)

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/register", handlers.RegisterHandler(database))
		r.Post("/auth/login", handlers.LoginHandler(database))
		r.Post("/auth/logout", handlers.LogoutHandler())

		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware)
			r.Get("/portfolio", portfolioHandler.GetPortfolioHandler)
			r.Get("/portfolio/snapshots", portfolioHandler.GetSnapshotsHandler)
			r.Get("/positions", positionsHandler.GetPositionsHandler)
			r.Get("/orders", ordersHandler.GetOrdersHandler)
			r.Post("/orders", ordersHandler.PlaceOrderHandler)
			r.Delete("/orders/{id}", ordersHandler.CancelOrderHandler)
			r.Get("/market/quote/{ticker}", marketHandler.GetQuoteHandler)
			r.Get("/market/candles/{ticker}", marketHandler.GetCandlesHandler)
			r.Get("/market/search", marketHandler.SearchAssetsHandler)
			r.Get("/market/cached", marketHandler.GetCachedPricesHandler)
			r.Get("/market/profile/{ticker}", marketHandler.GetProfileHandler)
			r.Get("/fees/estimate", feesHandler.EstimateFeeHandler)
		})
	})

	go startPendingOrderChecker(orderSvc)
	go startSnapshotSaver(orderSvc)

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

func startPendingOrderChecker(svc *services.OrderService) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		_ = svc.CheckPendingOrders()
	}
}

func startSnapshotSaver(svc *services.OrderService) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		_ = svc.TakeAllSnapshots()
	}
}
