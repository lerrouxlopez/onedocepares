# Project Memory

## Read First

- Read `BUILDPLAN.md` at the beginning of the session.

**Always read `BUILDPLAN.md` at the start of every session before writing any code.** Check `5. [Task List](#task-list)` for the first unchecked task, then read that phase's detail section. Never start a new phase until all tasks in the current phase are checked off and exit criteria are confirmed with the user.


- Read `README.md` for the current scaffold, commands, and local workflow.

## Project Context

- `onedocepares.com` is a custom CMS and tournament management platform replacing WordPress.
- The repo is a monorepo with:
  - `apps/web` for the public site and admin interface
  - `apps/api` for the Rust API
  - `infra/` for deployment-related configuration

## Current Status

- The repository is in Phase 0 / early implementation.
- A baseline web shell, admin placeholder, API health endpoint, Docker Compose file, and CI workflow already exist.
- Build on top of the scaffold that is already present.

## Important Conventions

- Keep public routes at `/`, admin routes at `/admin/`, and API routes under `/api/v1`.
- Follow the architecture and phased priorities in `BUILDPLAN.md`.
- When planned work is completed, update the corresponding checklist items in `BUILDPLAN.md` during the same session.
- Prefer minimal, phase-appropriate changes over broad redesigns.
- Update docs when commands, structure, or setup changes.

## Domain Rules

- Users and players are separate concepts.
- One user may manage many players.
- Leaderboards should be derived from approved results and stored as snapshots for auditability.
- Admin workflows come before self-service features in MVP scope.
