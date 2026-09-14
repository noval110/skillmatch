package database

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// This stronger check needs a local/test DATABASE_URL with CREATEDB permission.
// Only the uniquely named database created by this test is modified or removed.
func TestMigrationsFromEmptyDatabase(t *testing.T) {
	if os.Getenv("SKILLMATCH_EMPTY_DATABASE_TEST") != "1" {
		t.Skip("set SKILLMATCH_EMPTY_DATABASE_TEST=1 to test a completely empty database")
	}
	_ = godotenv.Load("../.env")
	if os.Getenv("DATABASE_URL") == "" {
		t.Fatal("DATABASE_URL is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal("invalid test DATABASE_URL")
	}
	admin, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	name := fmt.Sprintf("skillmatch_migration_test_%d", time.Now().UnixNano())
	quoted := pgx.Identifier{name}.Sanitize()
	// template0 guarantees no tables inherited from a modified template1.
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+quoted+" TEMPLATE template0"); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := admin.Exec(cleanupCtx, "DROP DATABASE "+quoted); err != nil {
			t.Errorf("clean up newly created test database %s: %v", name, err)
		}
	}()
	isolated := config.Copy()
	isolated.ConnConfig.Database = name
	isolated.ConnConfig.RuntimeParams["search_path"] = "public"
	pool, err := pgxpool.NewWithConfig(ctx, isolated)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close() // Runs before dropping the test database.

	tables := func() []string {
		t.Helper()
		rows, err := pool.Query(ctx, `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		result, err := pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	if got := tables(); len(got) != 0 {
		t.Fatalf("test database was not empty: %v", got)
	}
	t.Log("Created a completely empty PostgreSQL database from template0")

	// Reproduce Railway's failure from the old runner, which began with 001.
	oldFirstMigration, err := migrationFiles.ReadFile("migrations/001_beginner_matching.sql")
	if err != nil {
		t.Fatal(err)
	}
	_, err = pool.Exec(ctx, string(oldFirstMigration))
	var pgError *pgconn.PgError
	if !errors.As(err, &pgError) || pgError.Code != "42P01" || !strings.Contains(pgError.Message, `"teams"`) {
		t.Fatalf("expected the old migration to fail on missing teams, got %v", err)
	}
	t.Log("Reproduced the original missing teams error (SQLSTATE 42P01)")
	if err := Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	wantTables := []string{"conversation_members", "conversations", "join_requests", "messages", "notifications", "role_skills", "skills", "team_members", "team_milestones", "team_roles", "teams", "user_achievements", "user_portfolios", "user_skills", "users"}
	if got := tables(); !reflect.DeepEqual(got, wantTables) {
		t.Fatalf("tables after bootstrap: got %v, want %v", got, wantTables)
	}
	var skillCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM skills").Scan(&skillCount); err != nil || skillCount != 59 {
		t.Fatalf("expected complete skill catalog, got %d: %v", skillCount, err)
	}

	// Populate every table, including role matching relationships. Use generated IDs
	// so this also verifies the bootstrap's sequences/defaults and foreign keys.
	_, err = pool.Exec(ctx, `
DO $$
DECLARE u bigint; s bigint; team bigint; role bigint;
BEGIN
    INSERT INTO users(name,email,password,experience_level,bio,preferred_role,availability,project_interest)
        VALUES ('Migration fixture','migration@example.test','test-only','Beginner','Preserve bio','Developer','weekend','Research') RETURNING id INTO u;
    INSERT INTO skills(name,category) VALUES ('Migration custom skill','Custom') RETURNING id INTO s;
    INSERT INTO teams(name,owner_id,max_members,description,beginner_friendly,willing_to_mentor,competition_category,competition_type)
        VALUES ('Migration team',u,4,'Preserve description',true,true,'Research','Scientific Writing') RETURNING id INTO team;
    INSERT INTO team_members(team_id,user_id,role) VALUES (team,u,'Owner');
    INSERT INTO team_milestones(team_id,title,description,status,progress,due_date,created_by)
        VALUES (team,'Migration milestone','Preserve milestone','in_progress',40,CURRENT_DATE + 7,u);
    INSERT INTO team_roles(team_id,role_name,experience_preference) VALUES (team,'Developer','beginner') RETURNING id INTO role;
    INSERT INTO user_skills(user_id,skill_id,level) VALUES (u,s,'beginner');
    INSERT INTO role_skills(role_id,skill_id,required_level) VALUES (role,s,'intermediate');
    INSERT INTO join_requests(team_id,user_id,message) VALUES (team,u,'Preserve request');
END $$;
`)
	if err != nil {
		t.Fatal(err)
	}
	snapshot := func() map[string]string {
		t.Helper()
		result := make(map[string]string)
		for _, table := range wantTables {
			var data string
			query := `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text FROM ` + pgx.Identifier{table}.Sanitize() + ` t`
			if err := pool.QueryRow(ctx, query).Scan(&data); err != nil {
				t.Fatal(err)
			}
			result[table] = data
		}
		return result
	}
	before := snapshot()
	for range 2 {
		if err := Migrate(ctx, pool); err != nil {
			t.Fatal(err)
		}
	}
	if after := snapshot(); !reflect.DeepEqual(after, before) {
		t.Fatal("reapplying migrations changed existing rows or duplicated the skill catalog")
	}
	t.Logf("Verified all application tables, generated IDs, foreign keys, skill catalog, and preservation of every row after repeated migrations: %v", wantTables)
}
