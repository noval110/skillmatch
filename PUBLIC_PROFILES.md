# Public user profiles

Signed-in members can visit `/users/:id` to view a read-only profile, including their own. The existing editable `/profile` page and its endpoint are unchanged.

## API and privacy

`GET /api/users/:id/profile` uses the existing JWT authentication middleware. It returns an explicit allowlist: `id`, `name`, `bio`, `experience_level`, `profile_photo_url`, `preferred_role`, `availability`, `project_interest`, `created_at`, `skills` (id/name/category/level), and `teams` (id/name/role).

Email, passwords/hashes, JWT claims/tokens, secrets, and credentials are excluded. Parameterized PostgreSQL queries aggregate skills, actual team memberships, portfolio and achievements; pending join requests are excluded. Optional text defaults to empty strings and collections to arrays. Missing users return JSON 404; malformed IDs return 400; database failures return a generic 500. Responses use `Cache-Control: private, no-store`.

The community expansion adds showcase migrations and a Message button; see [COMMUNITY_FEATURES.md](COMMUNITY_FEATURES.md). No new environment variable is required. Photos reuse existing avatar storage and `resolveMediaURL`; API calls use `VITE_API_URL`. The existing Vercel SPA rewrite supports direct visits and refresh. No per-user mentor status exists in the schema, so no mentor badge is inferred from team preferences.

## Navigation

Member names/avatars in Team Detail, applicant names/avatars in Join Requests, and member avatars in My Team/team cards link to the public profile. Accept/reject/remove controls retain their separate actions. The bell now opens the persistent notification page described in the community feature guide. Public team cards link back to `/teams/:id`.

## Verification

From `backend`, run `go build ./...` and `go test ./...`. For real PostgreSQL tests, set `SKILLMATCH_INTEGRATION=1` and use a local/test `DATABASE_URL` (or the existing backend `.env`). Tests create and clean up a uniquely named schema and temporary avatar directory; application data is untouched. Tests cover self/other profiles, authentication, IDs/404, exact safe field lists, skills, memberships, photos, nullable fields, empty arrays, and generic failures. The startup integration test also checks the actual protected route registration.

Browser smoke test:

1. Build `frontend` with process environment `VITE_API_URL=https://skillmatch-api.example.test/api` and `npm run build`.
2. Run `npm run preview -- --host 127.0.0.1 --port 4173`.
3. Launch an isolated headless Chrome instance with remote debugging port `9334`.
4. Run `node frontend/scripts/public-profile-browser-smoke.mjs` from the repository root.

The smoke test uses synthetic API fixtures, verifies Bearer headers and HTTPS API/photo origins, user links, request actions, refresh, loading/404/retry/empty states, account menu links, and widths 1440/900/390/320. It writes screenshots into ignored `.gocache/public-profile-review`. It does not contact or verify the live production API. Rebuild normally afterward to restore the local build configuration.
