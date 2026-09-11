# SkillMatch migrations

The server calls `database.Migrate` before listening for requests. The migration
command (`go run ./cmd/migrate` from `backend`) uses the same runner.

SQL files are embedded in the Go binary and executed in sorted filename order:

1. `000_initial_schema.sql`: creates all eight base tables (`users`, `skills`,
   `teams`, `team_roles`, `team_members`, `role_skills`, `user_skills`,
   `join_requests`), including keys, relationships, and defaults.
2. `001_beginner_matching.sql`: adds team flags, role experience preferences,
   profile preferences, and their constraints.
3. `002_multi_competition.sql`: adds competition/skill classification and seeds
   the skill catalog without duplicating existing names or replacing custom categories.

Keep zero-padded numeric filename prefixes. Every migration must be repeatable:
the runner reapplies the ordered files at startup. Existing tables are retained by
`CREATE TABLE IF NOT EXISTS`; later migrations add only missing columns/constraints.
All files run within one transaction under a transaction advisory lock. Failures
roll back the batch and report the failing filename. No migration deletes tables
or application records.

## Railway / fresh Neon startup

The original committed runner began with `001`, whose first statement is
`ALTER TABLE teams`. An empty database therefore failed with SQLSTATE `42P01`.
The initial schema file and updated runner must both be included in the deployed
revision. The bootstrap filename is explicitly required by `go:embed`, so a build
missing it fails instead of deploying an incomplete migration set.

Build from `backend` with `go build -o server .` and start with `./server`.
Keep Railway's `DATABASE_URL` environment variable set to the Neon connection URL
(use its direct endpoint for this startup migration flow and preserve TLS options).
The role must have permission to create and alter tables. With the updated binary,
a fresh database initializes automatically before Echo starts. The SQL files do
not need to exist alongside the deployed executable.

## Validation

From `backend`, run `go build ./...` and `go test ./...`.

Set `SKILLMATCH_INTEGRATION=1` to enable the existing API/legacy-schema and
environment-only startup tests. They use temporary schemas.

Set `SKILLMATCH_EMPTY_DATABASE_TEST=1` to enable the stronger empty-database test.
Use a **test/local** `DATABASE_URL` whose role has `CREATEDB` permission. The test
creates a uniquely named database from `template0`, reproduces the old error,
runs the fixed migrations, checks all eight tables, inserts linked fixtures,
and reapplies migrations twice to verify that every row is preserved. It closes
connections and removes only the database it created. Existing local/production
databases are not migrated or deleted by this test.

Example in PowerShell (the existing backend `.env` is loaded without overriding
environment variables):

```powershell
$env:SKILLMATCH_INTEGRATION='1'
$env:SKILLMATCH_EMPTY_DATABASE_TEST='1'
go test ./... -count=1
```
