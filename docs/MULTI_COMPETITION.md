# SkillMatch multi-competition implementation

SkillMatch now supports finding teammates for any competition. The existing Go/Echo/pgxpool backend and React application were extended; the maroon branding, approved illustrations, asset files, sidebar, and page layouts were retained.

## Database changes and preservation

`backend/database/migrations/002_multi_competition.sql` adds nullable `teams.competition_category VARCHAR(50)`, `teams.competition_type VARCHAR(100)`, and `skills.category VARCHAR(50)` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. No existing tables or records are deleted. Known skills receive a category only when unclassified; custom categories and original skill names/IDs remain intact. Catalog inserts compare trimmed, case-insensitive names to avoid duplicates. The migration runs inside the existing transaction and advisory lock; catalog writes also hold a table lock.

Applied to the configured database on September 11, 2026. Two consecutive migration runs verified preservation of the original record contents and IDs:

| Table | Existing records preserved | Added |
| --- | ---: | ---: |
| users | 10 | 0 |
| teams | 6 | 0 |
| team_roles | 3 | 0 |
| skills | 4 | 55 |
| team_members | 6 | 0 |
| user_skills | 7 | 0 |
| role_skills | 4 | 0 |
| join_requests | 6 | 0 |

The comparison excludes the new classification fields. Existing teams were not recategorized; they display “General Competition” / “Other” until their owners choose competition metadata. All other existing fields were compared using in-memory hashes; no user records or credentials were printed or exported.

Migrations also run on backend startup. To apply explicitly, run `go run ./cmd/migrate` from `backend`. `go run ./cmd/verify-migration` applies them twice and compares existing records before and after; use without concurrent application writes so unrelated edits do not affect the comparison.

## Backend files

- `database/migrations/002_multi_competition.sql`: nullable fields, categorized catalog, duplicate-safe insertion.
- `database/migrate.go`: embeds and executes the migration atomically.
- `cmd/migrate/main.go`: updated migration output.
- `cmd/verify-migration/main.go`: repeatability and existing-data verification.
- `models/team.go`: competition fields in team/create models; pointer fields in update requests preserve metadata when omitted or null.
- `models/skill.go`: category in catalog and profile skill responses.
- `handlers/team_handler.go`: create/update, null-safe list/detail/search, optional filters, Unicode-aware length validation.
- `handlers/skill_handler.go`: categories, optional category filter, iteration error checks.
- `handlers/role_match_handler.go` and `handlers/matching.go`: include competition category/type in the existing interest keyword calculation; scoring weights remain unchanged.
- `handlers/matching_integration_test.go`: legacy and multi-domain integration tests.
- `main.go`: also permits the local frontend origin `http://127.0.0.1:5173`.

## Frontend files

- New `src/config/competitions.js`: nine competition categories, icons, subtle colors, dependent type suggestions, role/skill presets, and category-diverse recommendation selection.
- New components: `CompetitionFields.jsx`, `CompetitionBadge.jsx`, `CompetitionCategories.jsx`, `SkillSelect.jsx`.
- Pages updated: `Profile.jsx`, `CreateTeam.jsx`, `TeamDetail.jsx`, `Teams.jsx`, `Dashboard.jsx`, `LandingPage.jsx`, `Login.jsx`, `Register.jsx`.
- Components updated: `TeamCard.jsx`, `MatchBreakdown.jsx`, `SkillIcon.jsx`.
- `src/services/api.js`: optional category parameter for fetching skills.
- `src/index.css`: small category, skill picker, and responsive additions.
- `index.html`: generic competition title and description.
- `scripts/competition-browser-smoke.mjs`: new browser regression suite.
- `MATCHING.md`: documents the generic interest label while retaining API field compatibility.

Profile skills are grouped by category, with category browsing in Add Skill. Create/Edit Team uses dependent competition fields and accepts custom types. Team owners can type any role, use role suggestions, and explicitly select a suggested skill, choose its level, and save it. Suggestions never create requirements automatically. Team cards and details show competition type/category with legacy fallbacks. Dashboard recommendations choose the strongest available match in each category before filling remaining slots. Landing examples cover multiple domains and are labeled as examples; their existing local cover assets were retained.

## Competition categories

| Category | Suggested competition types |
| --- | --- |
| Technology | Hackathon, Web Development, Data Competition, Robotics |
| Academic | Debate, Essay Competition, Public Speaking |
| Business | Business Case, Marketing Competition, Startup Competition |
| Research | Scientific Writing, KTI, Research Competition |
| Creative | Video Competition, Photography |
| Design | UI/UX Competition, Poster Design |
| Sports | Sports Competition, Other |
| Esports | Mobile Legends, Valorant, Other |
| Other | Other, or any custom type |

These presets are suggestions, not backend enums. Custom competition categories are also accepted by the API within the field length limit, and existing custom values remain editable in the UI.

## Skill catalog

The catalog now contains 59 skills, including 48 outside Technical. There are nine populated skill categories and an Other fallback for unclassified skills. The migration added 55 missing entries while retaining the four existing skills.

| Category | Skills |
| --- | --- |
| Technical | Frontend Development, Backend Development, React, JavaScript, TypeScript, Go, Python, PostgreSQL, API Integration, Git, Docker |
| Communication | Public Speaking, Argumentation, Rebuttal, Presentation, Negotiation, Team Communication, Persuasive Speaking |
| Research | Research, Literature Review, Critical Thinking, Data Analysis, Academic Writing, Citation Management, Problem Analysis |
| Business | Business Analysis, Market Research, Financial Analysis, Strategy, Pitching, Business Modeling, Marketing, Competitor Analysis |
| Design | Figma, UI Design, UX Research, Adobe Illustrator, Photoshop, Typography, Branding, Poster Design |
| Creative | Storytelling, Scriptwriting, Video Editing, Cinematography, Voice Over, Motion Graphics, Photography |
| Leadership | Leadership, Team Coordination, Project Management, Decision Making, Time Management |
| Language | English, Indonesian, Copywriting |
| Strategy | Case Building, Game Strategy, Analytical Thinking |

## API compatibility and filters

- `POST /api/teams` accepts optional competition metadata. Existing requests still work.
- `PUT /api/teams/:id` accepts optional competition metadata. Omitted/null values retain stored values; explicit empty strings clear them. Existing required name/project idea/member-capacity fields remain.
- `GET /api/teams`, `GET /api/teams/:id`, and `GET /api/teams/search` return both fields. SQL nulls become empty strings.
- Search adds optional `competition_category` and `competition_type`, matched case-insensitively by full value. Existing name/role/skill substring searches and the beginner-friendly boolean filter remain composable.
- `GET /api/skills` and `GET /api/profile/skills` include `category`. `GET /api/skills?category=Communication` filters the catalog; no query returns all skills.
- Matching keeps Skill Compatibility (30), Role Interest (25), Availability (20), Competition Interest (15), and Experience Fit (10). `project_interest` and `project_interest_score` retain their existing API names.

## Verification

- `go build ./...`: passed.
- `go test ./...` with `SKILLMATCH_INTEGRATION=1`: passed, including real PostgreSQL integration tests in a unique disposable schema. Existing public user/team records are not used as test fixtures.
- `npm.cmd run build`: passed. Windows PowerShell blocks the npm `.ps1` wrapper, so the equivalent `.cmd` entry point is used.
- `npm.cmd run lint`: passed.
- Existing `node scripts/matching-browser-smoke.mjs`: passed for beginner badges/filter, optional profile preferences, team/role editing, score breakdown, and desktop/mobile layout.
- New `node scripts/competition-browser-smoke.mjs`: passed for the five requested domains, custom type/role input, dependent suggestions, explicit skill saves, categorized profile skill add/edit/delete, filters, legacy fallback, diverse recommendations, auth screen rendering, desktop/mobile layout, and zero browser runtime exceptions.

The API tests exercise registration/login, JWT protection, profile skill writes, team and role creation, requirements, exact match scores, all combined filters, owner authorization, legacy nulls/requests, explicit field clearing, repeatable catalog insertion, case/whitespace duplicate prevention, preserved custom categories, and transaction rollback. Debate, Business Case, Scientific Writing, Video Competition, Hackathon, and a custom competition each reach 100% when the profile meets every requirement and preference, even with beginner experience in an open role. The existing partial HackSquad match remains 88%.

Browser tests use API fixtures; real authentication, persistence, and matching are independently exercised by the PostgreSQL integration tests. They require Vite at `127.0.0.1:5173` and a local headless Chrome debugging endpoint at `127.0.0.1:9222`. Screenshots are in `frontend/artifacts/competitions/` and `frontend/artifacts/matching/`.

## Preserved features and limitations

JWT, owner authorization, pgxpool, transactional creation, memberships, join requests, team/role management, role requirements, existing technical skills, beginner-friendly and mentoring flags, and the matching philosophy remain in place. No external AI service or new image assets were added.

Existing limits remain: teams require 2–10 members and a project/competition goal; there is no separate competition/event table, event schedule, or team availability requirement. Availability therefore retains the existing neutral/flexible scoring. Competition interest uses deterministic keyword coverage, not semantic inference. Skills are chosen from the catalog; this change does not add a user-facing skill-catalog creation endpoint. Frontend recommendations still hydrate team/role data through multiple requests, so large catalogs would benefit from future pagination/batched matching. Historical teams remain unclassified unless edited by their owners.
