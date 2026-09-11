package database

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func Connect() *pgxpool.Pool {
	// Render supplies environment variables directly; keep .env optional for local development.
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Fatal("Failed to load .env: ", err)
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	// Pass the URL through unchanged so hosted TLS options are honored.
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatal("Failed to create database pool:", err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("Database connected")

	return pool
}
