# SkillMatch community features

Implemented in four phases: notifications, profile showcase, direct messages, and recommended teams. Each phase passed Go builds/integration tests and frontend builds/browser checks before the next phase began. Existing account profile, authentication, teams, competition fields, skills, and role matching remain available.

## Migrations and deployment

The existing embedded migration runner automatically applies these files in order on backend startup, after `000_initial_schema.sql`, `001_beginner_matching.sql`, and `002_multi_competition.sql`:

| Migration | Changes |
| --- | --- |
| `003_notifications.sql` | Notifications, recipient/unread indexes, transactional join-request notification trigger |
| `004_profile_showcase.sql` | User portfolios and achievements, owner indexes |
| `005_direct_messages.sql` | Conversations, conversation members, messages, pagination/unread indexes, notification conversation reference |

Migrations are additive and safe to replay. They create no demo records, drop no application tables, and preserve existing rows. The runner applies them atomically under its existing transaction advisory lock. Tests cover a database created from PostgreSQL `template0`, a legacy schema with existing records, repeated migration execution, and populated new features. Notification triggers do not backfill historical decisions. Invitations are supported as a future notification type; no invitation workflow is introduced.

No new environment variables or services are required. `DATABASE_URL` and `JWT_SECRET` remain environment based. The Go backend continues to build with `go build -o server .` and starts with `./server`, using the existing `PORT`/`FRONTEND_URL` configuration. Deploy backend before frontend so the new endpoints exist when the new UI loads. On Vercel, keep `VITE_API_URL` set to the backend HTTPS URL ending in `/api`; the existing SPA rewrite handles the new routes. This implementation was not deployed to Railway, Vercel, or the production Neon branch.

## Protected API

Every endpoint below uses the existing JWT middleware and private/no-store responses. IDs are checked, mutations are scoped to the authenticated owner, and new JSON request bodies are bounded to 64 KiB. No public response adds email, password/hash, token, JWT secret, or database credentials.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/api/notifications` | Recipient's notifications, newest IDs first, 50 per page; optional `before` ID |
| GET | `/api/notifications/unread-count` | `{ unread_count }` |
| PUT | `/api/notifications/:id/read` | Mark own notification read; missing/foreign IDs return 404 |
| PUT | `/api/notifications/read-all` | Mark only current user's notifications read |
| GET | `/api/profile/showcase` | Current user's `{ portfolio, achievements }` |
| POST | `/api/profile/portfolio` | Add project |
| PUT, DELETE | `/api/profile/portfolio/:id` | Edit/delete own project |
| POST | `/api/profile/achievements` | Add achievement |
| PUT, DELETE | `/api/profile/achievements/:id` | Edit/delete own achievement |
| POST | `/api/conversations` | `{ user_id }`; find/create direct conversation and return `{ id }` |
| GET | `/api/conversations` | Participant's conversations: other user's safe identity/photo, latest text/time, unread count; 50 per page, optional `offset` |
| GET | `/api/conversations/:id` | Member-only conversation summary for direct links |
| GET | `/api/conversations/:id/messages` | Latest 50 messages in chronological order; `before` for history or `after` for incremental polling |
| POST | `/api/conversations/:id/messages` | `{ content, client_message_id? }`; 1–4000 characters, optional retry deduplication key |
| PUT | `/api/conversations/:id/read` | `{ last_message_id? }`; mark received messages through fetched cursor, clear message notification only when no unread messages remain |
| GET | `/api/teams/recommended` | Top 12 eligible teams, best open role, score, breakdown, matched skills, data-derived reason |

The existing `GET /api/users/:id/profile` additionally exposes `portfolio` and `achievements` using explicit safe field lists. The original editable `/api/profile` API is unchanged. Portfolio fields are `id`, `title`, `description`, `role`, `project_url`, `repository_url`, `technologies`. Achievement fields are `id`, `title`, `organization`, `achievement_type`, `date`, `description`, `credential_url`.

Project and credential links accept only HTTP(S), with no embedded credentials. Titles, descriptions, roles, technology lists, achievement types and calendar dates are validated. Public profiles provide no showcase editing controls. The optional project image upload was omitted because the existing uploader is specific to profile avatars.

## Notifications and messaging consistency

Join-request insert/status transitions generate notifications within the same transaction. Repeated writes do not duplicate events. Accept/reject decisions lock the team and request, so concurrent decisions/capacity checks cannot produce conflicting membership and notification state.

A database unique constraint on the sorted user pair prevents duplicate direct conversations, including concurrent requests in opposite directions. Every conversation/message/read endpoint checks membership. A composite foreign key also requires message senders to belong to the conversation. Client retry keys deduplicate message sends; using the same key with different content returns 409.

Each recipient receives at most one outstanding unread message notification per conversation. Its timestamp represents the first unread alert. Reading notifications alone does not mark chat messages read. Reading the conversation clears its alert only when all received messages through the fetched cursor have been read. Send and read operations serialize on the conversation to prevent lost unread state.

## Frontend

New pages are `/notifications`, `/messages`, and `/messages/:conversationId`. All use the authenticated layout. The bell links to notifications and polls unread counts every 20 seconds. Notifications have timestamps, unread indicators, team/conversation links, mark-one/all controls, older-page loading, and errors/retry.

Own Profile has portfolio and achievement add/edit/delete forms and delete confirmations; Public Profile shows the same information read-only and includes a Message button for other users. Existing public user links and the own-account menu remain usable.

Messages show the conversation list beside chat on desktop and separate list/detail views with Back navigation on mobile. The active conversation polls every 8 seconds, the list every 10 seconds. Requests do not overlap; hidden tabs pause polling and resume on visibility. Older history can be loaded, drafts survive failures, and message text is rendered as text rather than HTML. No attachments, push notifications, WebSockets, voice, or video are included.

The dashboard recommendation section calls the new aggregate endpoint instead of making a match request for every role. Cards show score, recommended role, actual matched skills, explanation, existing five-component breakdown, and View Team. The original scoring functions and 30/25/20/15/10 weights are reused exactly. Owned, joined, full, and teams without open/active roles are excluded. Ties use stable team IDs. Team schedules are not yet represented in the schema: availability retains the existing neutral 10/20, or 20/20 for flexible availability, and the UI explains this limitation. Recommendation text is deterministic, not AI-generated.

## Files

- Backend registration: `backend/main.go`, `backend/handlers/community_routes.go`.
- Backend features: `notification_handler.go`, `showcase_handler.go`, `message_handler.go`, `recommendation_handler.go`, `join_decision_handler.go`; existing `team_handler.go` delegates accept/reject to the transaction helper. Files are under `backend/handlers`.
- Public profile: `backend/handlers/public_profile_handler.go`, `backend/models/public_profile.go`, new `backend/models/showcase.go`.
- Frontend pages: `Notifications.jsx`, `Messages.jsx`, `community.css`, plus `Profile.jsx`, `PublicProfilePage.jsx`, and `Dashboard.jsx` integration.
- Frontend components: `NotificationBell.jsx`, `ProfileShowcase.jsx`, `RecommendationCard.jsx`, updated `Navbar.jsx` and `Sidebar.jsx`.
- Frontend plumbing: `src/App.jsx`, `src/services/api.js`, `src/hooks/usePolling.js`.
- Tests: `backend/handlers/community_integration_test.go`, updated public-profile and database migration tests, `frontend/scripts/community-browser-smoke.mjs`, and adapted existing public-profile/competition/matching smoke tests.

Earlier uncommitted public-profile work remains in the workspace. Existing assets and environment files are unchanged.

## Verification

Backend commands, from `backend`:

```text
go build ./...
go test ./...
go vet ./...
```

Real database checks use `SKILLMATCH_INTEGRATION=1` and `SKILLMATCH_EMPTY_DATABASE_TEST=1` with a local/test `DATABASE_URL`. Only uniquely created test schemas/databases and temporary avatar directories are modified. The empty-database test requires CREATEDB permission.

Frontend commands, from `frontend`:

```text
npm run build
node scripts/community-browser-smoke.mjs
node scripts/competition-browser-smoke.mjs
node scripts/matching-browser-smoke.mjs
node scripts/public-profile-browser-smoke.mjs
```

Browser scripts require a running Vite server/preview and an isolated Chrome instance exposing CDP. Set `FRONTEND_URL` to that local server, `CDP_URL` to its Chrome `/json` endpoint (community/public-profile default port 9334; legacy suites default 9222), and `PHASE=4` for all community checks. Public-profile smoke expects a production build with `VITE_API_URL=https://skillmatch-api.example.test/api`. Browser APIs are simulated; PostgreSQL integration tests exercise real backend handlers and authentication.

Verified scenarios include registration/login, existing team/competition/role/skill workflows, join submission and accept/reject, public profiles, notification isolation/read operations, showcase CRUD/ownership/URL validation, concurrent direct-conversation creation, message isolation/retry/read cursors/history, ranking/exclusions/score consistency, SPA refresh, HTTP polling, and desktop/tablet/mobile widths 1440/900/390/320. Browser screenshots go to ignored `.gocache` folders. Live production API/deployment verification remains a deployment step.
