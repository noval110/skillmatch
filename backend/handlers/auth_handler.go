package handlers

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

	"skillmatch/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

func Register(c echo.Context, conn *pgxpool.Pool) error {
	var req models.RegisterRequest

	if err := c.Bind(&req); err != nil {

		if req.Name == "" ||
			req.Email == "" ||
			req.Password == "" ||
			req.ExperienceLevel == "" {

			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "All fields are required",
			})
		}

		if len(req.Password) < 6 {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Password must be at least 6 characters",
			})
		}

		if req.ExperienceLevel != "beginner" &&
			req.ExperienceLevel != "intermediate" &&
			req.ExperienceLevel != "advanced" {

			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "Invalid experience level",
			})
		}

		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(req.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to process password",
		})
	}

	var id int64

	err = conn.QueryRow(
		context.Background(),
		`
				INSERT INTO users 
				(name, email, password, experience_level)
				VALUES ($1, $2, $3, $4)
				RETURNING id
				`,
		req.Name,
		req.Email,
		string(hashedPassword),
		req.ExperienceLevel,
	).Scan(&id)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.JSON(http.StatusConflict, map[string]string{
				"error": "Email is already registered",
			})
		}

		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to create user",
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "User registered successfully",
		"user_id": id,
	})
}

func Login(c echo.Context, conn *pgxpool.Pool) error {
	var req models.LoginRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request",
		})
	}

	var id int64
	var name string
	var email string
	var hashedPassword string

	err := conn.QueryRow(
		context.Background(),
		`
					SELECT id, name, email, password 
					FROM users 
					WHERE email=$1
					`,
		req.Email,
	).Scan(&id,
		&name,
		&email,
		&hashedPassword)

	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Email or password is incorrect",
		})
	}

	//cek password
	err = bcrypt.CompareHashAndPassword(
		[]byte(hashedPassword),
		[]byte(req.Password),
	)

	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "Email or password is incorrect",
		})
	}

	//generate JWT token
	secret := os.Getenv("JWT_SECRET")

	claims := jwt.MapClaims{
		"user_id": id,
		"email":   email,
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(secret))

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to generate token",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "Login successful",
		"token":   tokenString,
		"user": map[string]interface{}{
			"id":    id,
			"name":  name,
			"email": email,
		},
	})
}
