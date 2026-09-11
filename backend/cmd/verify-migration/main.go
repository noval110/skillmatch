// Apply additive migrations and verify that pre-existing records retain their content.
// Only counts and preservation results are printed, never profile data or credentials.
package main

import (
	"context"
	"fmt"
	"log"
	"skillmatch/database"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func snapshot(ctx context.Context, pool *pgxpool.Pool, table string) map[int64]string {
	// New classification fields are the only intended changes to old records.
	query := `SELECT id, md5((to_jsonb(t) - 'competition_category' - 'competition_type' - 'category')::text) FROM ` + pgx.Identifier{table}.Sanitize() + ` t`
	rows, err := pool.Query(ctx, query)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	result := map[int64]string{}
	for rows.Next() {
		var id int64
		var digest string
		if err := rows.Scan(&id, &digest); err != nil {
			log.Fatal(err)
		}
		result[id] = digest
	}
	if err := rows.Err(); err != nil {
		log.Fatal(err)
	}
	return result
}

func main() {
	ctx := context.Background()
	pool := database.Connect()
	defer pool.Close()
	tables := []string{"users", "teams", "team_roles", "skills", "team_members", "user_skills", "role_skills", "join_requests"}
	before := map[string]map[int64]string{}
	for _, table := range tables {
		before[table] = snapshot(ctx, pool, table)
	}
	for range 2 {
		if err := database.Migrate(ctx, pool); err != nil {
			log.Fatal(err)
		}
	}
	for _, table := range tables {
		after := snapshot(ctx, pool, table)
		for id, digest := range before[table] {
			if after[id] != digest {
				log.Fatalf("Existing %s record changed or disappeared; check concurrent writes", table)
			}
		}
		fmt.Printf("%s: %d existing records preserved; %d added\n", table, len(before[table]), len(after)-len(before[table]))
	}
	log.Println("Both migration runs passed; existing record content and IDs preserved")
}
