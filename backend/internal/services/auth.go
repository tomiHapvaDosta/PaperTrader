// internal/services/auth.go
// Purpose: Business logic for user registration and login.
// Depends on: models/user.go, internal/auth/jwt.go, internal/db/db.go

package services

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"time"
	"unicode"

	"github.com/tomiHapvaDosta/PaperTrader/internal/auth"
	//"github.com/tomiHapvaDosta/PaperTrader/internal/db"
	"github.com/tomiHapvaDosta/PaperTrader/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Sentinel i18n-keyed errors
var (
	ErrInvalidEmail       = errors.New("auth.invalid_email")
	ErrInvalidUsername    = errors.New("auth.invalid_username")
	ErrPasswordTooShort   = errors.New("auth.password_too_short")
	ErrInvalidBalance     = errors.New("auth.invalid_starting_balance")
	ErrEmailTaken         = errors.New("auth.email_taken")
	ErrUsernameTaken      = errors.New("auth.username_taken")
	ErrInvalidCredentials = errors.New("auth.invalid_credentials")
)

var (
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,20}$`)
)

// AuthResult holds the JWT token and user info returned after successful auth.
type AuthResult struct {
	Token   string
	User    models.UserPublic
	Balance float64
}

// RegisterUser validates input, creates a new user and portfolio, and returns a JWT token.
func RegisterUser(database *sql.DB, email, username, password string, startingBalance float64) (*AuthResult, error) {
	// 1. Validate email format
	if !emailRegex.MatchString(email) {
		return nil, ErrInvalidEmail
	}

	// 2. Validate username: 3-20 chars, alphanumeric + underscores only
	if !usernameRegex.MatchString(username) {
		return nil, ErrInvalidUsername
	}

	// 3. Validate password: minimum 8 characters
	if len([]rune(password)) < 8 {
		return nil, ErrPasswordTooShort
	}
	// Ensure at least one non-space character
	hasNonSpace := false
	for _, r := range password {
		if !unicode.IsSpace(r) {
			hasNonSpace = true
			break
		}
	}
	if !hasNonSpace {
		return nil, ErrPasswordTooShort
	}

	// 4. Validate startingBalance: must be between 100 and 1,000,000
	if startingBalance < 100 || startingBalance > 1_000_000 {
		return nil, ErrInvalidBalance
	}

	// 5. Check if email already exists
	var existingID int64
	err := database.QueryRow("SELECT id FROM users WHERE email = ?", email).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("db error checking email: %w", err)
	}
	if err == nil {
		return nil, ErrEmailTaken
	}

	// 6. Check if username already exists
	err = database.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("db error checking username: %w", err)
	}
	if err == nil {
		return nil, ErrUsernameTaken
	}

	// 7. Hash password using bcrypt (cost 12)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, fmt.Errorf("bcrypt error: %w", err)
	}

	// 8. Insert new user into users table
	now := time.Now().UTC()
	result, err := database.Exec(
		"INSERT INTO users (email, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
		email, username, string(hash), now,
	)
	if err != nil {
		return nil, fmt.Errorf("db error inserting user: %w", err)
	}
	userID, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("db error getting user id: %w", err)
	}

	// 9. Create portfolio record for user
	_, err = database.Exec(
		"INSERT INTO portfolios (user_id, cash_balance, starting_balance, created_at) VALUES (?, ?, ?, ?)",
		userID, startingBalance, startingBalance, now,
	)
	if err != nil {
		return nil, fmt.Errorf("db error creating portfolio: %w", err)
	}

	// 10. Generate JWT token
	token, err := auth.GenerateToken(models.User{
		ID:       int(userID),
		Email:    email,
		Username: username,
	})
	if err != nil {
		return nil, fmt.Errorf("jwt error: %w", err)
	}

	// 11. Return token and user info (never return password hash)
	return &AuthResult{
		Token: token,
		User: models.UserPublic{
			ID:        userID,
			Email:     email,
			Username:  username,
			CreatedAt: now,
		},
		Balance: startingBalance,
	}, nil
}

// LoginUser validates credentials and returns a JWT token on success.
// Generic errors are returned to avoid leaking whether an email exists.
func LoginUser(database *sql.DB, email, password string) (*AuthResult, error) {
	// 1. Look up user by email — return generic error if not found
	var user struct {
		ID           int64
		Username     string
		PasswordHash string
		CreatedAt    time.Time
	}
	err := database.QueryRow(
		"SELECT id, username, password_hash, created_at FROM users WHERE email = ?",
		email,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Generic error — do not reveal whether email exists
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("db error looking up user: %w", err)
	}

	// 2. Compare password with bcrypt hash — return generic error if wrong
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// 3. Generate JWT token
	token, err := auth.GenerateToken(models.User{
		ID:       int(user.ID),
		Email:    email,
		Username: user.Username,
	})
	if err != nil {
		return nil, fmt.Errorf("jwt error: %w", err)
	}

	// 4. Return token and user info (never return password hash)
	return &AuthResult{
		Token: token,
		User: models.UserPublic{
			ID:        user.ID,
			Email:     email,
			Username:  user.Username,
			CreatedAt: user.CreatedAt,
		},
	}, nil
}
