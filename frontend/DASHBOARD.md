# SkillMatch dashboard

The authenticated dashboard follows the supplied dark workspace reference. The page is assembled from React components; the reference image is not included in the application. Existing approved artwork is unchanged. The subtle summit decoration is CSS geometry.

## Implementation

- `src/pages/Dashboard.jsx`: orchestration, active-team selection, recommendations and application state.
- `src/components/dashboard/`: DashboardHero, DashboardStats, ActiveTeamCard, TeamReadinessPreview, CompetitionPreparationPreview, CompetitionJourney, DashboardEmptyState, TeamApplicationDialog.
- `src/components/RecommendationCard.jsx`: existing recommendation data, explanations, and join-request actions.
- `src/services/dashboard.js`: partial-failure-aware loading of the existing endpoints.
- `src/utils/dashboard.js`: isolated profile checklist and journey state.
- `src/components/readiness/TeamReadinessPanel.jsx`: protected full-team score, role and skill coverage, member profile summary, and deterministic next actions.
- `src/styles/readiness.css`: responsive readiness layout and covered/partial/missing states.
- `src/components/milestones/`, `src/utils/milestones.js`, `src/styles/milestones.css`: private owner-managed competition milestones, calendar deadline states, and responsive workspace presentation.
- `src/styles/dashboard.css`: responsive center/rail layout, cards, progress, dialogs, and loading states.
- `src/styles/workspace.css`: shared authenticated sidebar and search presentation.
- `src/components/Navbar.jsx`, `src/components/Sidebar.jsx`, `src/layouts/DashboardLayout.jsx`: compact account controls, existing notification bell, explicit drawer open/close, Escape and focus handling.
- `src/pages/Teams.jsx`, `src/utils/teamSearch.js`: global `?q=` search over already hydrated team names, competition types/categories, roles, and required skills. Existing server filters remain in effect. Clearing global search preserves other query parameters.

## Existing APIs reused

| Endpoint | Dashboard use |
| --- | --- |
| `GET /profile` | Name, profile fields, account avatar |
| `GET /profile/skills` | Actual skill count and checklist completion |
| `GET /teams` | Team directory and owner identity |
| `GET /teams/:id` | Verified team membership and member count |
| `GET /teams/:id/roles` | Selected team's filled/open role statuses |
| `GET /teams/:id/readiness` | Protected, database-derived team readiness and skill-gap analysis |
| `GET /teams/:id/milestones` | Protected preparation summary and small Active Team preview |
| `GET /teams/:id/join-requests` | Pending incoming requests for teams the user owns |
| `GET /teams/recommended` | Existing matching score, recommended role, skills, reasons, and breakdown |
| `POST /teams/:id/join` | User-submitted introduction through the join-request form |
| `GET /notifications/unread-count` | Existing notification bell and polling |
| `GET /teams/search` and existing role hydration APIs | Existing directory filters and global search results |

JWT, login, registration, recommendation matching, and the readiness formula are unchanged. Navbar reuses the dashboard's fetched profile instead of requesting it again. Missing profile photos use initials in the top bar, not an invented portrait.

## Data meanings and limitations

- **Teams Joined** includes owned teams. There is no current-user membership endpoint, so the loader reads team membership in batches of six. It does not fetch every team's role requirements or match scores. An incomplete membership response shows an unavailable total rather than a misleading zero; known teams remain accessible.
- **Join Requests** means pending *incoming* requests awaiting the user's review. The current API does not expose the user's outgoing request count.
- **Profile Completion** is a transparent frontend checklist: name, bio, experience level, preferred role, availability, competition interest, and at least one skill. Each completed item contributes equally. It is not a backend-generated completeness score. The journey includes the checklist and completed-item count.
- **Team Readiness** uses the backend V1 formula: 25% team composition, 30% role coverage, 35% unique required-skill coverage, and 10% average member profile completeness. Covered skills contribute 1, partial skills 0.5, and missing skills 0. Shared requirements count once at their highest required level.
- A role is covered only when its owner-controlled status is `filled` and its required skills are collectively covered. The current schema has no member-to-role assignment, so the product does not infer one from membership or skill possession.
- Teams with missing roles, missing role skills, invalid levels, invalid capacity, or no members receive `setup_required` and a null score. The dashboard and detail tab explain what to configure instead of presenting 0%.
- Detailed readiness, supporting member names, and profile checklist summaries are available only to the team owner and current members. The endpoint checks this access server-side.
- **Competition Preparation** averages stored milestone progress. It remains separate from Team Readiness. The dashboard shows only completed/total, overall progress, and the next unfinished milestone; the private Team Detail tab contains the full workspace.
- **Journey** checks profile basics and verified team membership. Collaboration becomes the next action after those steps; collaboration success and competition participation are never automatically marked complete.
- **Recommendations** preserve backend scoring and explainable matching. The existing availability caveat is retained: team schedules are not specified, so schedule compatibility is not claimed.
- All failures have retry states. Empty memberships and empty recommendations have useful actions. No sample data is imported by production code.

## Future work, deliberately not fabricated

Competition results, automated deadline reminders, verified proficiency, workload/capacity per skill, explicit member-to-role assignments, and a live competition directory need backend support. The competition panel is clearly marked coming soon. A dedicated authenticated membership endpoint would remove the directory-wide membership reads.

## Validation

- `npm.cmd run build --prefix frontend`
- `npm.cmd run lint --prefix frontend` (three existing warnings in usePolling, ProfileShowcase, and Notifications)
- `node --test frontend/tests/dashboard.test.mjs`
- `node frontend/tests/readiness.browser.mjs` with a local Vite server and isolated headless Chrome CDP session
- `node --test frontend/tests/milestones.test.mjs`
- `node frontend/tests/milestones.browser.mjs` with controlled owner/member/outsider fixtures
- Chrome browser checks at 1536, 1280, 768, 390, and 320 pixels.
- Routes checked: `/dashboard`, `/teams`, `/my-team`, `/messages`, `/notifications`, `/profile`.
- Interactions checked: search by skill, mobile drawer/Escape, readiness details, matching breakdown, join-request success/error, and empty/unavailable/partial data.
- Readiness states checked: owner, member, outsider, full/partial/missing coverage, missing role, no roles, roles without required skills, incomplete profiles, API failure, and desktop/tablet/mobile overflow.

Browser verification uses controlled API fixtures intercepted in a separate Chrome test profile. It does not create accounts, submit real requests, or alter server data. Screenshots in `../artifacts/dashboard-redesign/` illustrate those test fixtures, not live user or team records. The application itself exclusively loads existing APIs. Results are recorded in `checks.json`.
