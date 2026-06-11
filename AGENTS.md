# Repository Instructions

## Start Here

- Read `BUILDPLAN.md` before making implementation decisions.
- Use `README.md` for current scaffold status, local setup, and validation commands.
- Treat `BUILDPLAN.md` as the source of truth for roadmap, architecture, and phased delivery.

## Current Project State

- This repository is in early scaffold stage.
- Phase 0 foundation exists for `apps/web` and `apps/api`.
- Prefer extending the current scaffold instead of replacing it.

## Architecture Expectations

- Keep the monorepo structure centered around `apps/web` and `apps/api`.
- Public pages live at `/`, admin pages at `/admin/`, and API routes under `/api/v1`.
- Preserve the stack choices in `BUILDPLAN.md` unless explicitly asked to change them.

## Working Style

- Make focused, minimal changes that fit the current phase of the build plan.
- Update documentation when structure, setup, or developer workflow changes.
- Validate changes with the smallest relevant build or test command before finishing.

## Implementation Notes

- Frontend uses Vite, Bootstrap 5, jQuery, and SCSS.
- Backend uses Rust, Axum, Tokio, and tracing.
- Keep leaderboards derived from results rather than manually edited, per the build plan.
- Keep the distinction between users and players clear in data modeling and UI.
