# onedocepares.com

Custom CMS and tournament management platform for One Doce Pares. This repository replaces a WordPress setup with a monorepo that includes:

- A public website
- An admin interface at `/admin/`
- A Rust API at `/api/v1`
- Local development infrastructure with Docker Compose

## Stack

- Frontend: Vite, Bootstrap 5, jQuery, SCSS
- Backend: Rust, Axum, Tokio, Tracing
- Database: PostgreSQL
- Infra: Docker Compose, Caddy
- CI: GitHub Actions

## Repository Layout

```text
.
|-- apps/
|   |-- api/
|   |   |-- migrations/
|   |   `-- src/
|   `-- web/
|       |-- admin/
|       |-- public/
|       `-- src/
|-- infra/
|   |-- caddy/
|   |-- docker/
|   `-- sql/
|-- .github/
|   `-- workflows/
|-- BUILDPLAN.md
|-- docker-compose.yml
`-- README.md
```

## Current Status

Phase 0 foundation is scaffolded:

- Web app boots with a public landing shell and a Phase 1 admin frontend
- API serves `GET /api/v1/health`
- Backend auth foundation now includes login/logout, session lookup, CSRF token fetch, and admin CMS page routes
- Docker Compose defines `postgres`, `api`, and `web`
- CI runs frontend build plus Rust formatting, clippy, and tests
- Environment templates exist for both apps

## Requirements

- Node.js 24+
- npm 11+
- Rust 1.94+
- Docker Desktop or compatible Docker engine

## Local Development

### Option 1: Run apps directly

1. Install frontend dependencies:

   ```powershell
   cd apps/web
   npm install
   ```

2. Start the API:

   ```powershell
   cd apps/api
   cargo run
   ```

3. Start the frontend in another terminal:

   ```powershell
   cd apps/web
   npm run dev
   ```

4. Open:
   - Public site: `http://localhost:5173`
   - Admin shell: `http://localhost:5173/admin/`
   - API health: `http://localhost:8000/api/v1/health`

The admin frontend also supports a local preview mode when the API is unavailable, so the login, CMS pages, media library, and settings placeholder can still be tested in the browser.

### Option 2: Run with Docker Compose

```powershell
docker compose up --build
```

Then open:

- Public site: `http://localhost:5173`
- Admin shell: `http://localhost:5173/admin/`
- API health: `http://localhost:8000/api/v1/health`
- PostgreSQL: `localhost:5432`

## Environment Files

Copy these templates when you need local overrides:

- `apps/web/.env.example`
- `apps/api/.env.example`

Current variables:

- `VITE_API_BASE_URL`
- `API_PORT`
- `DATABASE_URL`
- `RUST_LOG`
- `SESSION_COOKIE_NAME`
- `SECURE_COOKIES`
- `SESSION_TTL_HOURS`

## Validation

Frontend:

```powershell
cd apps/web
npm run build
```

Backend:

```powershell
cd apps/api
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Compose config:

```powershell
docker compose config
```

## Next Milestones

- Add database migrations for users, roles, sessions, and CMS entities
- Implement auth routes and session-backed login
- Build the first admin CMS workflows
- Add media storage and upload handling

## Notes

- The frontend build currently shows Sass deprecation warnings originating from Bootstrap's upstream Sass usage. The build still succeeds.
- The source project plan lives in `BUILDPLAN.md`.
