// Read-only schema inspection; prints no credentials or user records.
package main

import (
	"context"
	"fmt"
	"log"
	"skillmatch/database"
)

func main() {
	pool := database.Connect()
	defer pool.Close()
	rows, err := pool.Query(context.Background(), `SELECT table_name, column_name, data_type, is_nullable, COALESCE(column_default, '') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var table, column, kind, nullable, fallback string
		if err := rows.Scan(&table, &column, &kind, &nullable, &fallback); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("%s.%s %s nullable=%s default=%s\n", table, column, kind, nullable, fallback)
	}
	if err := rows.Err(); err != nil {
		log.Fatal(err)
	}
	rows.Close()
	rows, err = pool.Query(context.Background(), `SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid, conname`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var table, name, definition string
		if err := rows.Scan(&table, &name, &definition); err != nil {
			log.Fatal(err)
		}
		fmt.Println(table, name, definition)
	}
	if err := rows.Err(); err != nil {
		log.Fatal(err)
	}
}
