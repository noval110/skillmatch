package database

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func Connect() *pgxpool.Pool {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		log.Fatal("Failed to create database pool:", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	log.Println("Database connected")

	return pool
}
