# SkillMatch deployment

## Environment

| Service | Variable | Value |
| --- | --- | --- |
| Vercel | `VITE_API_URL` | `https://<render-service>.onrender.com/api` (include `/api`) |
| Render | `DATABASE_URL` | Neon PostgreSQL connection string, including its TLS options |
| Render | `JWT_SECRET` | A strong random secret, kept stable across deploys; the Blueprint generates one |
| Render | `FRONTEND_URL` | Exact frontend origin, e.g. `https://<project>.vercel.app`, without a path |
| Render | `PORT` | Supplied by Render; the application defaults to `8080` when empty |
| Render | `UPLOAD_DIR` | `/var/data/uploads`, on the Blueprint's persistent disk |

`VITE_API_URL` is public and embedded at build time. Redeploy Vercel after changing it. Keep database credentials and JWT secrets exclusively on the backend. CORS allows the configured frontend origin and `http://localhost:5173` / `http://127.0.0.1:5173`. It does not enable credentials or wildcard origins. A new production/custom domain requires updating `FRONTEND_URL` on Render. Arbitrary Vercel preview domains are not allowed automatically.

## Neon database

1. Create a Neon project and database, choosing a region near the backend.
2. In **Connect**, copy the PostgreSQL connection string. Use the direct connection endpoint for this long-running service, which already uses `pgxpool` and runs migrations on startup. Preserve the supplied TLS parameters (such as `sslmode=require`); never substitute local `sslmode=disable` in production. [Neon connection guidance](https://neon.com/docs/connect/connection-errors)
3. Save this URL as Render's `DATABASE_URL`. No database URL is needed on Vercel.
4. The backend initializes an empty database automatically: `000_initial_schema.sql` creates missing base tables, then the existing additive migrations add fields and populate the skill catalog. All migrations are embedded in the binary and run in a transaction protected by a transaction advisory lock. The database role must own or have permission to create/alter these tables.
5. To preserve local users and teams, import a PostgreSQL dump into an empty Neon database **before the first backend startup**. Use `pg_dump` and `pg_restore --no-owner --no-acl` with PostgreSQL tools compatible with the source/target versions. Do not commit database dumps. Local data is not copied by deployment or migrations. Existing databases receive only the repeatable additive migrations.

## Render backend

Create a Blueprint from the repository's `render.yaml`, supply `DATABASE_URL` and `FRONTEND_URL`, and review the service/disk configuration before creating it. It defines a Go web service and a persistent disk for existing profile-photo functionality. Persistent disks require a paid service; review the selected plan in Render. [Render Blueprint reference](https://render.com/docs/blueprint-spec)

For manual setup, create a Web Service connected to the repository with:

- Runtime: **Go**, with Go **1.26.4 or newer**, as required by `backend/go.mod`.
- Root directory: `backend`.
- Build command: `go build -o server .`.
- Start command: `./server`.
- Health check: `/api/health`.
- Environment variables: those listed above; leave `PORT` to Render.
- A persistent disk mounted at `/var/data`, with `UPLOAD_DIR=/var/data/uploads`.

The server binds on all interfaces using `":" + PORT`. Startup needs no PowerShell, Windows paths, or local `.env` file. A missing JWT secret or invalid port/frontend origin stops startup. PostgreSQL must connect and migrations must succeed before the server listens. [Render web service setup](https://render.com/docs/web-services)

Profile photos remain in the existing local filesystem format. Only files on the persistent disk survive redeploys. If retaining local profiles, transfer the contents of `backend/uploads/avatars/` to `/var/data/uploads/avatars/` while preserving filenames and matching database user IDs. The disk supports one service instance, so use a single instance with this storage setup. [Render persistent disks](https://render.com/docs/disks)

After deployment, confirm `https://<render-service>.onrender.com/api/health` returns `{"app":"skillmatch","status":"ok"}` and `/api/skills` returns the catalog.

## Vercel frontend

1. Import the repository into Vercel and set the project root to `frontend`.
2. Select the **Vite** preset, Node.js **24.x**, install command `npm ci`, build command `npm run build`, and output directory `dist`.
3. Set `VITE_API_URL=https://<render-service>.onrender.com/api` for the Production environment, then deploy.
4. Set Render's `FRONTEND_URL` to the final Vercel production origin and redeploy/restart the backend. If necessary, reserve the Vercel project/domain first to obtain its origin.
5. Open `/login` and `/register` directly and refresh. After login, refresh `/dashboard`, `/teams`, and a valid `/teams/<id>` URL. Confirm registration/login, team operations, profile editing, and photo upload still work.

`frontend/vercel.json` rewrites deep links to `/index.html` so `BrowserRouter` handles them after a refresh. Vercel serves existing static files before applying the fallback. [Vercel Vite SPA configuration](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas)

## Local development and validation

Copy `frontend/.env.example` to `frontend/.env`. Copy `backend/.env.example` to `backend/.env` only if it does not already exist, then fill in your local `DATABASE_URL` and `JWT_SECRET`. Local PostgreSQL remains supported via the same URL; use TLS settings appropriate to your local server. Never overwrite existing local secrets with blank examples. All `.env` files and local overrides are ignored; `.env.example` files remain trackable.

From `backend`:

```sh
go build ./...
go test ./...
go run .
```

From `frontend`, after installing dependencies with `npm ci`:

```sh
npm run build
npm run dev
```

On Windows with PowerShell script execution disabled, use `npm.cmd` in place of `npm`. This is a local shell detail; deployment uses the standard commands above.

For database regression coverage, set `SKILLMATCH_INTEGRATION=1` and run `go test ./...` from `backend`. Tests create uniquely named temporary schemas and cover both a fresh database and legacy records; they do not modify application records in `public`. Use a development database role permitted to create schemas.

## Deployment handoff

Preparation checks passed: `go build ./...`, `npm run build` (using `npm.cmd` on Windows), Linux/amd64 compilation with `go build -o server .`, and `SKILLMATCH_INTEGRATION=1 go test ./...`. Integration coverage includes fresh/legacy schemas, startup from a directory with no `.env` or SQL files, a custom port, and allowed/rejected CORS origins. A headless browser verified direct navigation and refresh for `/login`, `/register`, `/teams`, and `/profile` against the built SPA; authenticated routes used API fixtures and verified the configured production API origin. The live Vercel rewrite and Neon TLS connection still require hosted verification.

Provisioning the hosted services, entering production credentials/origins, optionally transferring existing data/photos, and checking the deployed URLs remain deployment-time steps. Local build and integration checks cannot verify an unconfigured live Neon connection or Vercel/Render deployment.
