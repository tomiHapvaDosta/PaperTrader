// internal/db/db.go
// Purpose: Initializes the SQLite database connection and runs all migrations in order.

package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func OpenDB() (*sql.DB, error) {
	path := os.Getenv("DB_PATH")
	if path == "" {
		path = "./papertrader.db"
	}

	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable wal mode: %w", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping sqlite database: %w", err)
	}

	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, err
	}

	DB = db
	fmt.Println("database ready at", path)
	return db, nil
}

func runMigrations(db *sql.DB) error {
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("get working dir: %w", err)
	}

	// Run all migration files in order
	migrations := []string{
		"001_initial_schema.sql",
		"002_market_cache.sql",
	}

	for _, filename := range migrations {
		migrationPath := filepath.Join(cwd, "migrations", filename)

		// Skip if file doesn't exist — allows gradual rollout
		content, err := os.ReadFile(migrationPath)
		if err != nil {
			if os.IsNotExist(err) {
				fmt.Printf("migration %s not found, skipping\n", filename)
				continue
			}
			return fmt.Errorf("read migration %s: %w", filename, err)
		}

		if _, err := db.Exec(string(content)); err != nil {
			return fmt.Errorf("execute migration %s: %w", filename, err)
		}

		fmt.Printf("migration %s applied\n", filename)
	}

	return nil
}
