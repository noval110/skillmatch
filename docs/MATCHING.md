# Beginner-friendly matching

SkillMatch evaluates compatibility with a particular role. Experience is contextual: a Beginner receives 10/10 experience points for a beginner role, while an Advanced user receives 5/10 for that same role. An open role awards 10/10 to every experience level.

## Database and startup

The existing PostgreSQL schema was inspected before changes. The additive migration is `backend/database/migrations/001_beginner_matching.sql`. It adds default-false team flags, default-open role preferences, nullable profile preferences, and constraints on role preferences and availability. It does not delete or rewrite existing users, teams, roles, or join requests.

The backend applies this repeatable migration in a transaction at startup, using the existing `pgxpool` connection pool. A transaction advisory lock serializes concurrent migration runs. To apply it separately, run `go run ./cmd/migrate` from `backend` with the existing `.env` configuration. Run `go run ./cmd/inspect-schema` for a read-only schema report. For manual SQL execution, wrap the migration file in a transaction.

The migration was applied to the configured development database during implementation. Restart the backend to load the new handlers.

## Scoring

All response components are integer points. The overall score is their exact sum, at most 100. No badge adds bonus points.

| Component | Maximum | Rule / missing-data fallback |
| --- | ---: | --- |
| Skill Compatibility | 30 | Equal weight per required skill. Present skills get full credit at or above the requirement, 80% one level below, 60% two levels below. Missing skills get zero. No requirements means full credit because there is no skill requirement to miss. |
| Role Interest | 25 | Case-insensitive exact role match gets 25. Whole-keyword partial coverage gets up to 20. An unspecified preference gets 13. |
| Availability | 20 | Flexible gets 20. Weekday, weekend, and unspecified availability get a neutral 10. Team schedules are not known or inferred. |
| Competition Interest | 15 | Whole-keyword coverage against team name, project idea, description, competition category, and competition type. The API retains `project_interest` and `project_interest_score` for compatibility. Unspecified interest gets 8. For example, `AI` does not accidentally match `retail`. |
| Experience Fit | 10 | Contextual table below. Open/legacy roles get 10; unknown user experience for a specific preference gets a neutral 5. |

Each component is rounded separately, so neutral role/project values are the nearest integer to half their weight.

| Role preference | Beginner user | Intermediate user | Advanced user |
| --- | ---: | ---: | ---: |
| beginner | 10 | 7 | 5 |
| intermediate | 6 | 10 | 8 |
| advanced | 3 | 6 | 10 |
| open | 10 | 10 | 10 |

`matched_skills` contains relevant skills the user has; `missing_skills` contains absent skills. The additional `skills_to_improve` list identifies relevant skills below the required level. `profile_incomplete` drives the Complete Profile prompt. The response exposes no raw private profile preferences.

## Existing APIs, extended

- `POST/PUT /api/teams`: `beginner_friendly` and `willing_to_mentor` booleans; omitted flags default to false.
- `POST /api/teams/:id/roles`: optional `experience_preference`, default `open`.
- `PUT /api/teams/:id/roles/:role_id`: accepts a preference, status, or both. Omitted fields preserve their existing value. Existing `active`/`filled` status requests still work; `open` is also accepted to match the database default.
- `PUT /api/profile`: optional `preferred_role`, `availability`, `project_interest`. Omission/null preserves the saved preference; an empty string clears it. Existing name/bio/experience fields remain. Experience accepts both lowercase and title-case input.
- `GET /api/teams/search`: adds `beginner_friendly=true` (or `false`), combinable with name, role, and skill. Omission leaves all teams eligible.
- Team list/detail/search and role list responses include their new flags/preferences. The existing authenticated role-match endpoint includes all five score components, team flags, role preference, and profile-completion indicator.

JWT protection and owner checks remain in place. Team creation and owner membership now commit atomically.

## UI

The existing maroon theme, layout, illustrations, and local assets are retained. Team cards and details show compact Beginner Friendly and Mentor Available badges. Teams has a beginner-friendly checkbox. Create/Edit Team, Add/Edit Role, and Edit Profile expose the new settings. Role Detail shows Overall Match, five labeled progress bars, learning opportunities, and an explanation of availability and missing-data fallbacks.

## Verification

From `backend`:

```powershell
$env:GOCACHE='C:\skillmatch\.gocache'
go test ./...
$env:SKILLMATCH_INTEGRATION='1'
go test ./...
go build ./...
```

Integration tests connect using the existing `.env`, create a uniquely named test schema, apply the migration twice over legacy fixtures, and remove only that test schema on completion. They cover cases A–E, legacy login/profile/team/role loading, optional-field persistence and clearing, combined filters, role/team updates, JWT protection, owner checks, join requests, database constraints, and rollback when owner membership fails. Existing application records are never used as mutable fixtures.

From `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
```

`node scripts/matching-browser-smoke.mjs` runs the browser checks when Vite is listening on `127.0.0.1:5173` and a dedicated headless Chrome instance exposes DevTools on port `9222`. These browser checks use API fixtures; the Go integration suite verifies real PostgreSQL behavior. They cover badges, filters, profile saving, team/role creation and editing, score bars, missing optional data, runtime exceptions, and horizontal overflow at desktop and mobile sizes. Screenshots are saved under `frontend/artifacts/matching/`.
