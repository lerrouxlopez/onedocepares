# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Read First

**Always read `BUILDPLAN.md` at the start of every session before writing any code.** Check `5. [Task List](#task-list)` for the first unchecked task, then read that phase's detail section. Never start a new phase until all tasks in the current phase are checked off and exit criteria are confirmed with the user.

Read `README.md` for environment setup, Docker Compose usage, and local workflow commands.

## Project Context

`onedocepares.com` is a custom CMS and tournament management platform replacing WordPress, serving a martial arts organization. Monorepo layout:

- `apps/web/` — Public site and admin interface (Vite + Bootstrap 5 + jQuery)
- `apps/api/` — Rust API (Axum + SQLx + PostgreSQL)
- `infra/` — Deployment config (Caddy, Docker)

## Commands

### Frontend (`apps/web/`)

```powershell
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # Production build to dist/
```

### Backend (`apps/api/`)

```powershell
cargo run                                               # Start API on port 8000
cargo fmt --check                                       # Format check
cargo clippy --all-targets -- -D warnings               # Lint
cargo test                                              # Run tests
sqlx migrate run                                        # Apply pending migrations
sqlx migrate add <name>                                 # Create a new migration file
```

### Full stack with Docker

```powershell
docker compose up --build   # postgres + api + web at their respective ports
```

Dev endpoints:
- Public: `http://localhost:5173`
- Admin: `http://localhost:5173/admin/`
- API health: `http://localhost:8000/api/v1/health`

### Environment setup

Copy `.env.example` files to `.env` in `apps/api/` and `apps/web/` before running locally. The API needs `DATABASE_URL`; the frontend needs `VITE_API_BASE_URL`.

## Architecture

### Backend layers

Handlers in `routes/` are thin — they parse inputs, call a service, and serialize the response. Business logic lives in `services/`; all SQL in `repositories/`. The `AppState` struct (in `state.rs`) holds the database pool and config and is injected via Axum extractors.

```
routes/ (HTTP handlers)
  └─ services/ (business logic: password hashing, slug resolution, token generation)
       └─ repositories/ (SQLx queries against PostgreSQL)

middleware/ (auth session validation, CSRF token check)
error.rs   (thiserror enum → consistent JSON error responses)
config.rs  (env vars with defaults)
```

### Auth flow

- Login (`POST /api/v1/auth/login`) verifies Argon2id password hash, creates a session row, and sets an HttpOnly session cookie (`odp_session`).
- `middleware/auth.rs` provides two extractors: `require_authenticated` (any valid session) and `require_admin` (session + "admin" role).
- CSRF tokens are issued via `GET /api/v1/auth/csrf` and must be sent as a header on all mutating requests. `middleware/csrf.rs` enforces this.
- Sessions store a SHA-256 hash of the opaque token (never the raw token).

### API response format

All endpoints follow these shapes — do not deviate:

```json
// Single resource
{ "data": { ... } }

// Paginated list
{ "data": [ ... ], "pagination": { "page": 1, "per_page": 20, "total": 0, "total_pages": 0 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {}, "request_id": "..." } }
```

### Frontend architecture

Vite is configured with two entry points (`main.js` for the public site, `admin.js` for the admin shell). All API calls go through `src/js/api.js`, which sets `credentials: include` for session cookies and reads the CSRF token from a `<meta name="csrf-token">` tag. The admin shell uses a lightweight hash-based router (`src/js/admin-router.js`).

### Route namespaces

| Prefix | Served by | Auth |
|--------|-----------|------|
| `/` | Vite (public pages) | None |
| `/admin/` | Vite (admin shell) | Session cookie |
| `/api/v1/` | Rust API | Varies per endpoint |

Admin API routes live under `/api/v1/admin/` and require the "admin" role.

### Database migrations

Migrations are plain SQL files in `apps/api/migrations/` and run in order via `sqlx migrate run`. Currently implemented:
- `0001_auth.sql` — users, roles, permissions, sessions, password_reset_tokens
- `0002_cms.sql` — cms_pages

New migrations must be additive; never modify existing migration files.

## Important Conventions

- Keep public routes at `/`, admin routes at `/admin/`, and API routes under `/api/v1`.
- Follow the architecture and phased priorities in `BUILDPLAN.md`.
- When planned work is completed, update the corresponding checklist items in `BUILDPLAN.md` during the same session.
- Document all new API endpoints in `API.md` (create it if it does not exist).
- Prefer minimal, phase-appropriate changes over broad redesigns.
- The frontend must remain runnable and testable even when the API is not available.

## Domain Rules

- Users and players are separate concepts — never merge them. Users are login identities; Players are public competitor profiles.
- One user may manage many players (via `user_player_links`) and many teams (via `team_managers`).
- Leaderboards are derived from approved results and stored as snapshots for auditability — never allow manual rank edits.
- Admin workflows come before self-service features in MVP scope.
- Every admin write action must create an `audit_log` row (once that table exists).
