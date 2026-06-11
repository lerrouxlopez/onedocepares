# onedocepares.com Build Plan

**Blueprint Date:** 2026-06-11  
**Status:** Ready for Implementation  
**Prepared by:** Blueprint Document

IMPORTANT Note: 
## Session Start

**Always read `BUILDPLAN.md` at the start of every session before writing any code.** Check 5. [Task List](#task-list) for the first unchecked task, then read that phase's detail section. Never start a new phase until all tasks in the current phase are checked off and exit criteria are confirmed with the user.

**Make sure Frontend is runnable and testable even if API is not present**
Front end is being worked at separately even if backend is not yet ready. So Always make sure the developer can test and access the frontend.

**Make sure to document all API endpoints in API.md**
After an endpoint is done, make sure documentation is always present in the API.md file.

**Do not auto run scripts scripts like npm run dev, cargo run dev and etc. let me do them. Just tell me what to run**

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Phase Breakdown](#phase-breakdown)
5. [Task List](#task-list)
6. [Frontend Agent Prompt](#frontend-agent-prompt)
7. [Backend Agent Prompt](#backend-agent-prompt)

---

## Project Overview

**onedocepares.com** is a custom CMS and tournament management platform replacing WordPress. It serves One Doce Pares (a martial arts organization) with:
- Dynamic CMS pages, news, menus, and SEO management
- User authentication and role-based admin panel
- Team and player profile management
- Tournament CRUD, registration windows, and divisions
- Leaderboard calculations (derived from results, not manual edits)
- Social activity feed (auto-generated from system events)

### Key Principles
- **Users ≠ Players**: Users are login identities; Players are public competitor profiles. One user may manage many players.
- **Derived leaderboards**: Rankings calculated from approved results/events, stored as snapshots for auditability.
- **Admin-first MVP**: Reliable admin workflows before self-service features.
- **Monorepo**: Frontend (apps/web) and backend (apps/api) in one repository for clean versioning.
- **One domain**: Public pages at `/`, admin at `/admin`, API at `/api/v1`.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | HTML5 + Bootstrap 5 + jQuery + SCSS/CSS + Vite | Fast, SEO-friendly, no SPA complexity, aligns with request |
| **Backend** | Rust + Axum + Tokio | Modern async API, clean routing, Tower middleware |
| **Database** | PostgreSQL + SQLx | Relational integrity, explicit SQL for business rules |
| **Auth** | HttpOnly session cookies + Argon2id | Secure, server-backed, better than localStorage JWT |
| **Storage** | S3-compatible (Cloudflare R2) | Media: team logos, player photos, CMS assets |
| **Infra** | Docker Compose (dev), Caddy (prod) + Cloudflare DNS | Clean separation of assets and API, automatic HTTPS |
| **CI/CD** | GitHub Actions | Standard, integrated with repo |

---

## Architecture

### Repository Structure
```
onedocepares.com/
├── apps/
│   ├── web/                    # Frontend: HTML, Bootstrap, jQuery
│   │   ├── src/css/
│   │   ├── src/js/
│   │   ├── src/pages/
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   └── api/                    # Backend: Rust Axum API
│       ├── src/
│       │   ├── main.rs
│       │   ├── app.rs
│       │   ├── routes/
│       │   ├── services/
│       │   ├── repositories/
│       │   └── ...
│       ├── migrations/
│       └── Cargo.toml
├── infra/                      # Deployment configs
│   ├── docker/
│   ├── caddy/
│   └── sql/
├── docker-compose.yml
└── .github/workflows/
```

### Key URLs
| URL | Content | Purpose |
|-----|---------|---------|
| `/` | Public pages (HTML built by Vite) | Homepage, leaderboards, teams, players, tournaments |
| `/admin` | Admin panel (HTML built by Vite) | CMS, users, teams, tournaments, registrations |
| `/api/v1` | Rust API endpoints | JSON responses, CSRF-protected, session-based auth |

### Data Flow
1. Frontend calls `/api/v1/*` endpoints via jQuery Ajax
2. Backend validates permissions, applies business logic, queries PostgreSQL
3. Leaderboards: Store results → calculate snapshots → serve snapshots (never manual edits)
4. Activity feed: Generated from system events (registration, rank change, match win, etc.)
5. Media: Uploaded to object storage; URLs served via `/media/*` proxy

---

## Phase Breakdown

### Phase 0: Project Foundation (Weeks 1-2)
**Goal:** Scaffold repo, set up local dev, CI/CD, basic health.
- [x] Monorepo structure
- [x] Vite frontend init (Bootstrap, jQuery, SCSS)
- [x] Rust Axum API init
- [x] Docker Compose (postgres, api, web)
- [x] CI pipeline (linting, tests)
- [x] Health endpoint, structured logging

### Phase 1: CMS & Auth MVP (Weeks 3-6)
**Goal:** Admin can create/edit pages; users can log in.
- Users table, roles, sessions, login/logout
- Admin layout and sidebar
- CMS pages CRUD (draft/publish/preview)
- Media upload and library
- Site settings, menus, SEO fields
- Acceptance: Admin creates/publishes page; page visible publicly by slug

### Phase 2: Teams, Players, Tournaments (Weeks 7-10)
**Goal:** Core domain objects and public pages.
- Team CRUD, public team pages
- Player CRUD, public player pages
- Team member management
- Tournament CRUD, public tournament pages
- Registration windows and statuses
- Acceptance: Admin creates team/player/tournament; public pages render

### Phase 3: Registration & Leaderboards (Weeks 11-14)
**Goal:** Teams register; rankings calculated and displayed.
- Team manager role and permissions
- Team registration flow (pending → approved → checked-in → completed)
- Basic results entry (MVP: no bracket UI)
- Leaderboard calculation (event-driven point system)
- Public leaderboard pages with filters and rank movement badges
- Acceptance: Team registers; admin approves; leaderboard updates and shows movement

### Phase 4: Social & Advanced Features (Weeks 15+)
**Goal:** Activity feed, social engagement, advanced tournaments.
- Activity feed (auto-generated from events: registration, rank change, match win)
- Follows, likes, optional comments (moderated)
- Badges and badge feed items
- Tournament divisions, bracket generation, check-in
- Calendar export (.ics, Google Calendar links)
- Email notifications
- Payment gateway (if required)

---

## Task List

### Phase 0: Foundation
- [x] Create monorepo directory structure
- [x] Initialize Vite project in apps/web
  - [x] Bootstrap 5 npm install
  - [x] jQuery npm install
  - [x] SCSS setup with Bootstrap variables override
  - [x] package.json with dev/build scripts
- [x] Initialize Rust Axum project in apps/api
  - [x] Cargo.toml with dependencies (axum, tokio, sqlx, serde, etc.)
  - [x] Basic main.rs with router
- [x] Create docker-compose.yml with postgres, api, web services
- [x] Create GitHub Actions CI workflow
  - [x] Frontend: npm ci, npm run build
  - [x] Backend: cargo fmt --check, cargo clippy, cargo test
- [x] Implement /api/v1/health endpoint
- [x] Set up structured logging (tracing)
- [x] Create .env.example files (web and api)

### Phase 1: CMS & Auth MVP
- [x] **Database Migrations**
  - [x] users, roles, permissions, user_roles table
  - [x] sessions, password_reset_tokens table
  - [x] cms_pages, cms_posts, homepage_sections, menus, menu_items, site_settings, media table
- [x] **Backend**
  - [x] Auth routes: POST /auth/login, /auth/logout, GET /auth/me, GET /auth/csrf
  - [x] Password hashing (Argon2id)
  - [x] Session management and CSRF middleware
  - [x] CMS routes: GET /cms/pages/:slug, GET/POST/PATCH /admin/cms/pages, POST /admin/cms/pages/:id/publish, POST /admin/cms/pages/:id/unpublish
  - [x] Media routes: GET/POST/PATCH/DELETE /admin/media
  - [x] Authorization checks for admin actions
- [ ] **Frontend**
  - [x] Admin layout (sidebar, header, footer)
  - [x] Login page
  - [x] CMS pages list and edit form
  - [x] Media library list and upload
  - [x] Site settings form (placeholder)
  - [x] API wrapper (api.js) with CSRF, credentials, error handling
  - [x] Bootstrap theming (brand colors, custom classes)
- [x] **Testing**
  - [x] Auth workflow tests (login, session, logout)
  - [x] CMS page create/publish/render tests
  - [x] CSRF tests
- [ ] **Acceptance**: Admin logs in, creates draft page, previews, publishes; public user sees page at /page-slug

### Phase 2: Teams, Players, Tournaments
- [ ] **Database Migrations**
  - [ ] teams, team_members, team_managers, team_stats
  - [ ] players, user_player_links, player_social_links, player_stats
  - [ ] tournaments, tournament_divisions, tournament_team_registrations, tournament_player_entries
- [ ] **Backend**
  - [ ] Teams routes: GET/POST /admin/teams, PATCH /admin/teams/:id, DELETE, member management
  - [ ] Players routes: GET/POST /admin/players, PATCH, DELETE
  - [ ] Tournaments routes: GET/POST /admin/tournaments, PATCH, DELETE
  - [ ] Public list endpoints: GET /teams, GET /teams/:slug, GET /players, GET /players/:slug, GET /tournaments, GET /tournaments/:slug
  - [ ] Slug generation (unique, kebab-case)
- [ ] **Frontend**
  - [ ] Admin teams list, create/edit form, member management
  - [ ] Admin players list, create/edit form
  - [ ] Admin tournaments list, create/edit form
  - [ ] Public teams directory (search, country filter, card view)
  - [ ] Public team profile (logo, description, players, tournaments, rank)
  - [ ] Public players directory (search, team/country filter, card view)
  - [ ] Public player profile (photo, bio, team, tournament history, rank)
  - [ ] Public tournaments listing (upcoming/past tabs, filters, cards)
  - [ ] Public tournament detail (description, location, registration status, divisions)
- [ ] **Testing**
  - [ ] Team CRUD, member management tests
  - [ ] Player CRUD tests
  - [ ] Tournament CRUD tests
  - [ ] Permission tests (team manager can only edit assigned teams)
- [ ] **Acceptance**: Admin creates team/player/tournament; public pages render correctly

### Phase 3: Registration & Leaderboards
- [ ] **Database Migrations**
  - [ ] ranking_rules, leaderboard_snapshots, leaderboard_entries
  - [ ] activity_feed table
- [ ] **Backend**
  - [ ] Registration routes: POST /tournaments/:slug/register-team, GET/PATCH /admin/registrations
  - [ ] Registration workflow: pending → approved → checked-in → completed
  - [ ] Leaderboard service: calculate points from results, create snapshots
  - [ ] Leaderboard routes: GET /leaderboards/players, GET /leaderboards/teams, POST /admin/leaderboards/rebuild
  - [ ] Activity feed routes: GET /feed, GET /feed/players/:slug, GET /feed/teams/:slug, PATCH /admin/feed/:id
  - [ ] Feed generation on important events (registration approved, rank changed, match won)
  - [ ] Audit logging for admin actions
- [ ] **Frontend**
  - [ ] Team registration form (team, division, players, notes)
  - [ ] Admin registration approval/rejection interface
  - [ ] Leaderboard rebuild button (admin)
  - [ ] Public player leaderboard (table/cards, rank, points, W-L, movement badges, filters)
  - [ ] Public team leaderboard (table/cards, rank, points, movement badges)
  - [ ] Public activity feed (registration events, rank changes, match wins, badges, tournament completion)
- [ ] **Testing**
  - [ ] Registration workflow (submit, approve, reject, cancel)
  - [ ] Leaderboard calculation (points accumulation, rank movement)
  - [ ] Feed generation on events
  - [ ] Permission tests (team manager can only register assigned teams)
- [ ] **Acceptance**: Team registers; admin approves; leaderboard updates; user sees rank movement badge

### Phase 4: Social & Advanced
- [ ] Follows, likes, optional comments (moderated)
- [ ] Badges and badge awards
- [ ] Tournament divisions and bracket generation
- [ ] Calendar export (.ics) and Google Calendar links
- [ ] Email notifications
- [ ] Check-in workflow for tournaments
- [ ] Payment gateway integration (if required)

---

## Frontend Agent Prompt

Use this prompt when starting a frontend coding session. Copy and paste as your primary instruction.

---

### FRONTEND CODE AGENT PROMPT

You are the frontend code agent for onedocepares.com.

**Goal:**  
Build the frontend app in apps/web for a custom CMS + tournament platform. The frontend must be separate from the backend but live in the same monorepo. Use HTML, Bootstrap 5, jQuery, SCSS/CSS, and Vite. Do not use WordPress, React, Vue, Angular, or a SPA framework.

**Hard Requirements:**
1. Use Bootstrap 5 installed via npm and imported through SCSS.
2. Use jQuery for Ajax, DOM interactions, forms, filters, modals, and admin actions.
3. Use Vite for local dev and production build.
4. Serve public pages under / and admin pages under /admin.
5. Call the backend through VITE_API_BASE_URL, defaulting to /api/v1.
6. Centralize all API requests in src/js/api.js.
7. Include credentials with API requests because the backend uses HttpOnly session cookies.
8. Include CSRF token header for unsafe requests. Read it from a meta tag named csrf-token.
9. Use Bootstrap components for layout, navbars, cards, forms, modals, alerts, offcanvas, tables, pagination, tabs, badges, and dropdowns.
10. Make pages responsive and accessible. Use semantic HTML, labels, aria-labels, focus management for modals, and alt text for images.

**Folder Structure to Create:**
```
apps/web/
- public/favicon.svg
- public/robots.txt
- src/css/main.scss
- src/css/_variables.scss
- src/css/_layout.scss
- src/css/_components.scss
- src/css/_admin.scss
- src/js/app.js
- src/js/api.js
- src/js/ui.js
- src/js/auth.js
- src/js/cms.js
- src/js/teams.js
- src/js/players.js
- src/js/tournaments.js
- src/js/leaderboards.js
- src/js/admin.js
- src/pages/public/...
- src/pages/admin/...
- index.html
- package.json
- vite.config.js
- .env.example
```

**Public Pages to Implement (Priority Order):**
1. Homepage: hero, CTA, latest tournaments, leaderboard preview, latest teams/news.
2. Teams directory: search/filter, team cards, pagination.
3. Team profile: logo, name, city/country, description, players, tournament history, rank, activity feed.
4. Players directory: search/filter, player cards, pagination.
5. Player profile: photo, bio, team, rank, stats, tournament history, badges, activity feed.
6. Tournaments listing: upcoming/past tabs, filters, cards.
7. Tournament detail: description, date/location, registration status, divisions, registered teams.
8. Player leaderboard: ranked table with filters and rank movement badges.
9. Team leaderboard: ranked table with filters and rank movement badges.
10. Login page.
11. Account page (placeholder).

**Admin Pages (Priority Order):**
1. Dashboard: metric cards, pending registrations, latest activity, quick actions.
2. CMS pages list and edit form.
3. Users list and edit roles.
4. Teams list, create/edit form, member management.
5. Players list, create/edit form.
6. Tournaments list, create/edit form, status controls.
7. Registrations list for a tournament with approve/reject buttons.
8. Leaderboard rebuild screen.
9. Activity feed moderation screen.
10. Settings (placeholder).

**API Wrapper (src/js/api.js) Behavior:**
- Export `apiRequest(path, options)` that returns jqXHR promise.
- Set `Accept: application/json` and `Content-Type: application/json`.
- Support FormData uploads for multipart.
- Send `xhrFields: { withCredentials: true }` for session cookies.
- Dispatch global `odp:api-error` event on failure with `{ detail: { message, xhr } }`.

**UI Behavior:**
- Global toast/alert container for API errors and success.
- Loading states for buttons during submit.
- Empty states for tables/lists.
- Confirmation modal for destructive actions.
- Bootstrap validation classes (is-valid, is-invalid) for forms.
- Reusable render functions for cards, table rows, badges, pagination.

**Brand Colors:**
- Primary: `#1f3a5f` (dark blue)
- Secondary/Gold: `#c29b40`
- Success: `#1c7c54`
- Danger: `#b02a37`
- Background: `#f8f9fb`

**Data Assumptions:**
- API responses: `{ data: ... }` for single/list.
- Paginated: `{ data: [], pagination: { page, per_page, total, total_pages } }`.
- Errors: `{ error: { code, message, fields, request_id } }`.

**Acceptance Criteria:**
- `npm install` works.
- `npm run dev` starts Vite on port 5173.
- `npm run build` succeeds; `dist/` folder created.
- Public pages render using Bootstrap.
- Admin pages render using Bootstrap.
- No hardcoded API URLs outside .env.
- Mobile layout works at 360px width.
- All forms have labels and accessible names.

**Deliverables:**
- Complete apps/web implementation.
- README with dev commands.
- .env.example with `VITE_API_BASE_URL=http://localhost:8080/api/v1`.

---

## Backend Agent Prompt

Use this prompt when starting a backend coding session. Copy and paste as your primary instruction.

---

### BACKEND CODE AGENT PROMPT

You are the backend code agent for onedocepares.com.

**Goal:**  
Build the Rust backend API in apps/api for a custom CMS + tournament platform. The backend must be separate from the frontend but live in the same monorepo. Use Rust, Axum, Tokio, SQLx, and PostgreSQL. Do not use WordPress, PHP, or a frontend framework.

**Hard Requirements:**
1. Use Axum for routing and handlers.
2. Use Tokio async runtime.
3. Use SQLx with PostgreSQL and explicit migrations.
4. Use Serde for JSON DTOs.
5. Use structured errors with consistent JSON error format.
6. Use server-side sessions with secure HttpOnly cookies, not JWT.
7. Use Argon2id password hashing.
8. Implement CSRF protection for POST, PUT, PATCH, DELETE.
9. Implement role-based authorization. Users ≠ Players.
10. Keep handlers thin; business logic in services; SQL in repositories.
11. Provide tests for critical workflows and permissions.

**Folder Structure to Create:**
```
apps/api/
- src/main.rs
- src/app.rs
- src/config.rs
- src/db.rs
- src/state.rs
- src/error.rs
- src/routes/mod.rs
- src/routes/auth.rs
- src/routes/cms.rs
- src/routes/users.rs
- src/routes/teams.rs
- src/routes/players.rs
- src/routes/tournaments.rs
- src/routes/registrations.rs
- src/routes/leaderboards.rs
- src/routes/feed.rs
- src/handlers/...
- src/services/...
- src/repositories/...
- src/models/...
- src/dto/...
- src/middleware/auth.rs
- src/middleware/csrf.rs
- src/middleware/rate_limit.rs
- src/utils/slug.rs
- migrations/
- tests/
- Cargo.toml
- .env.example
```

**Core Dependencies (Cargo.toml):**
```
axum, tokio, sqlx, serde, serde_json
chrono, uuid, rand, argon2
thiserror, tower, tower-http, tracing, tracing-subscriber
validator, async-trait, dotenvy
```

**Database Tables to Implement (in order of dependency):**

1. Auth: users, roles, permissions, user_roles, role_permissions, sessions, password_reset_tokens
2. CMS: cms_pages, cms_posts, homepage_sections, menus, menu_items, site_settings, media
3. Teams/Players: teams, team_members, team_managers, team_stats, players, user_player_links, player_social_links, player_stats
4. Tournaments: tournaments, tournament_divisions, tournament_team_registrations, tournament_player_entries, matches, match_results
5. Leaderboards/Social: ranking_rules, leaderboard_snapshots, leaderboard_entries, activity_feed, follows, likes, comments, badges, player_badges, team_badges
6. System: audit_logs, notifications

**API Endpoints to Implement (MVP):**

Auth:
- POST /api/v1/auth/login, /auth/logout
- GET /api/v1/auth/me, /auth/csrf
- POST /auth/password-reset/request, /auth/password-reset/confirm

CMS:
- GET /api/v1/cms/pages/:slug
- GET/POST/PATCH /api/v1/admin/cms/pages
- POST /api/v1/admin/cms/pages/:id/publish, /unpublish

Teams:
- GET /api/v1/teams, /teams/:slug
- GET/POST/PATCH/DELETE /api/v1/admin/teams, members endpoints

Players:
- GET /api/v1/players, /players/:slug
- GET/POST/PATCH/DELETE /api/v1/admin/players

Tournaments:
- GET /api/v1/tournaments, /tournaments/:slug
- GET/POST/PATCH/DELETE /api/v1/admin/tournaments

Registrations:
- POST /api/v1/tournaments/:slug/register-team
- GET/PATCH /api/v1/admin/tournaments/:id/registrations

Leaderboards:
- GET /api/v1/leaderboards/players, /leaderboards/teams
- POST /api/v1/admin/leaderboards/rebuild

Feed:
- GET /api/v1/feed, /feed/players/:slug, /feed/teams/:slug
- PATCH /api/v1/admin/feed/:id

**Response Format Standards:**

Success (single):
```json
{ "data": { ... } }
```

Success (paginated):
```json
{ "data": [ ... ], "pagination": { "page": 1, "per_page": 20, "total": 0, "total_pages": 0 } }
```

Error:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": {}, "request_id": "..." } }
```

**Business Rules (Non-Negotiable):**
1. Users are login identities; Players are competitor profiles. Never merge.
2. A user can manage multiple players through user_player_links.
3. A user can manage teams through team_managers.
4. A player can belong to many teams (historically) through team_members.
5. Team can only register if registration window is open and team manager is authorized.
6. Registration: pending → approved → checked_in → completed (or rejected).
7. Leaderboards are **derived** from approved results/events. Never manual edits.
8. Every admin write action must create an audit_log row.
9. Important actions must create activity_feed rows.

**Security Requirements:**
- Passwords hashed with Argon2id.
- Sessions stored server-side; cookie stores opaque session ID.
- Cookie flags: `Secure` (prod), `HttpOnly`, `SameSite=Lax`, `Path=/`.
- Store hash of session token, not raw.
- CSRF token required for unsafe methods.
- Rate limit login and public forms.
- Validate request bodies.
- Sanitize CMS HTML before storage.
- Check permissions in backend services, not frontend.
- Write tests for every critical permission rule.

**Acceptance Criteria:**
- `cargo fmt --check` passes.
- `cargo clippy --all-targets --all-features -- -D warnings` passes.
- `cargo test` passes.
- SQLx migrations run on empty PostgreSQL.
- GET /api/v1/health returns `{ "status": "ok" }`.
- Login creates secure session cookie.
- Logout revokes session.
- Admin CRUD requires correct role.
- Public list endpoints support pagination and filters.
- Team manager cannot edit another team.
- Leaderboard rebuild creates new snapshot and entries.
- API error format is consistent.

**Deliverables:**
- Complete apps/api implementation.
- SQLx migrations in migrations/ folder.
- .env.example.
- README with setup, migration, test, and local run instructions.
- Seed command or migration data for default roles, admin user creation instructions, sample ranking rule.

---

## How to Use This BUILDPLAN

### For Coding Agents:
1. Read this entire BUILDPLAN at session start.
2. Identify which phase/task you're working on.
3. Use the corresponding Agent Prompt (Frontend or Backend) as your main instruction.
4. Reference the task list to track progress.
5. Follow the Hard Requirements and Acceptance Criteria strictly.

### For Project Managers:
1. Use the Phase Breakdown to estimate sprint capacity.
2. Check off tasks in the Task List as they complete.
3. Use the Acceptance Criteria to verify completion before marking done.

### For Developers:
1. Use the Architecture section to understand data flow.
2. Use the Tech Stack to set up your environment.
3. Reference the Frontend/Backend Agent Prompts when pairing with AI.
4. Follow the Business Rules and Security Requirements without exception.

---

## Next Steps

1. **Initialize monorepo** (Phase 0)
2. **Create apps/web and apps/api** directories and run frontend/backend agents
3. **Set up Docker Compose** for local development
4. **Implement Phase 1** (Auth & CMS) first
5. **Deploy to staging** after Phase 1 acceptance
6. **Roll out phases 2, 3, 4** incrementally

---

**Last Updated:** 2026-06-11  
**Blueprint Source:** onedocepares_platform_blueprint.pdf  
**Maintained by:** Development Team
