package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Name the bootstrap explicitly so omitting it from a deployment fails at build
// time, rather than starting with an ALTER TABLE against an empty database.

//go:embed migrations/000_initial_schema.sql migrations/*.sql
var migrationFiles embed.FS

// Migrate bootstraps empty databases and applies additive changes to existing ones.
// Numbered SQL files execute in filename order and must be safe to reapply.
// All changes commit atomically, with a transaction lock serializing startups.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	files, err := fs.Glob(migrationFiles, "migrations/*.sql")
	if err != nil {
		return fmt.Errorf("list database migrations: %w", err)
	}
	sort.Strings(files)
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin database migrations: %w", err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(736452901)`); err != nil {
		return fmt.Errorf("lock database migrations: %w", err)
	}
	for _, name := range files {
		sql, err := migrationFiles.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		log.Printf("Applying database migration %s", name)
		if _, err = tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit database migrations: %w", err)
	}
	return nil
}
