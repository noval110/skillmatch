package main

import (
	"context"
	"log"
	"skillmatch/database"
)

func main() {
	pool := database.Connect()
	defer pool.Close()
	if err := database.Migrate(context.Background(), pool); err != nil {
		log.Fatal(err)
	}
	log.Println("SkillMatch additive migrations applied (beginner matching and multi-competition catalog)")
}
