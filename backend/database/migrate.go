package database

import (
	"context"
	_ "embed"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_beginner_matching.sql
var beginnerMatchingMigration string

//go:embed migrations/002_multi_competition.sql
var multiCompetitionMigration string

// Migrate adds only optional/defaulted fields. All changes commit atomically.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(736452901)`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, beginnerMatchingMigration); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, multiCompetitionMigration); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
