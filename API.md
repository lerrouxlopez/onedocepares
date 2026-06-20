# API Reference

Base path: `/api/v1`

All responses use these shapes:

```json
{ "data": { ... } }
{ "data": [ ... ], "pagination": { "page": 1, "per_page": 20, "total": 0, "total_pages": 0 } }
{ "error": { "code": "...", "message": "...", "fields": {}, "request_id": "..." } }
```

Auth is session-based. After login, the `odp_session` HttpOnly cookie is set automatically. Include `credentials: 'include'` on every request. All mutating endpoints (POST / PATCH / DELETE) require an `x-csrf-token` header — get the token from `GET /auth/csrf` after logging in.

---

## Health

### `GET /health`

Public. Returns API status.

**Response 200**
```json
{ "status": "ok", "service": "onedocepares-api", "version": "0.1.0" }
```

---

## Auth

### `POST /auth/login`

Public. Authenticates a user and sets the session cookie.

**Request body**
```json
{ "email": "admin@example.com", "password": "secret" }
```

**Response 200** — sets `Set-Cookie: odp_session=...`
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@example.com",
    "display_name": "Admin",
    "roles": ["admin"]
  }
}
```

**Errors:** `400 BAD_REQUEST` (empty fields), `401 UNAUTHORIZED` (bad credentials)

---

### `GET /auth/me`

Requires session. Returns the current user.

**Response 200**
```json
{ "data": { "id": "uuid", "email": "...", "display_name": "...", "roles": ["admin"] } }
```

---

### `GET /auth/csrf`

Requires session. Returns the CSRF token for the current session. Store this and send it as `x-csrf-token` on every mutation.

**Response 200**
```json
{ "data": { "csrf_token": "abc123..." } }
```

---

### `POST /auth/logout`

Requires session + CSRF. Revokes the session and clears the cookie.

**Headers:** `x-csrf-token: <token>`

**Response 204** (no body)

---

## CMS Pages (public)

### `GET /cms/pages/:slug`

Public. Returns a published page by slug.

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "title": "Home",
    "slug": "home",
    "body": "<p>...</p>",
    "excerpt": null,
    "seo_title": null,
    "seo_description": null,
    "status": "published",
    "published_at": "2026-06-11T00:00:00Z",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**Errors:** `404 NOT_FOUND` (not published or does not exist)

---

## CMS Pages (admin)

All endpoints require admin role + CSRF where noted.

### `GET /admin/cms/pages`

Requires admin. Lists all pages (draft and published).

**Response 200**
```json
{ "data": [ { ...page... }, ... ] }
```

---

### `POST /admin/cms/pages`

Requires admin + CSRF. Creates a page (defaults to `draft`).

**Request body**
```json
{
  "title": "My Page",
  "slug": "my-page",
  "body": "<p>Content</p>",
  "excerpt": null,
  "seo_title": null,
  "seo_description": null,
  "status": "draft"
}
```

`slug` is optional — auto-generated from `title` when omitted.

**Response 200** — returns the created page

---

### `PATCH /admin/cms/pages/:id`

Requires admin + CSRF. Updates all writable fields.

**Request body** — same shape as POST

**Response 200** — returns the updated page

**Errors:** `404 NOT_FOUND`

---

### `POST /admin/cms/pages/:id/publish`

Requires admin + CSRF. Sets `status = 'published'` and records `published_at`.

**Response 200** — returns the updated page

**Errors:** `404 NOT_FOUND`

---

### `POST /admin/cms/pages/:id/unpublish`

Requires admin + CSRF. Sets `status = 'draft'`. Preserves the original `published_at`.

**Response 200** — returns the updated page

**Errors:** `404 NOT_FOUND`

---

## Media (admin)

Files are stored locally in `UPLOADS_DIR` (default `./uploads`) and served at `/uploads/<filename>`. Max upload size: 10 MB.

### `GET /admin/media`

Requires admin. Lists all uploaded files, newest first.

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "filename": "abc123.jpg",
      "original_name": "photo.jpg",
      "alt_text": null,
      "mime_type": "image/jpeg",
      "size_bytes": 123456,
      "url": "/uploads/abc123.jpg",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### `POST /admin/media`

Requires admin + CSRF. Uploads a file. Send as `multipart/form-data`.

**Request** — `Content-Type: multipart/form-data`, field name: `file`

**Response 201** — returns the created media record

**Errors:** `400 BAD_REQUEST` (no file, oversized)

---

### `PATCH /admin/media/:id`

Requires admin + CSRF. Updates `alt_text`.

**Request body**
```json
{ "alt_text": "A descriptive label" }
```

**Response 200** — returns the updated record

**Errors:** `404 NOT_FOUND`

---

### `DELETE /admin/media/:id`

Requires admin + CSRF. Deletes the DB record and the file from disk.

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

## Teams (public)

### `GET /teams`

Public. Lists active teams, paginated.

**Query params:** `page` (default 1), `per_page` (default 20, max 100)

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "name": "Team Alpha", "slug": "team-alpha",
      "description": null, "logo_url": null, "city": "Manila",
      "country": "Philippines", "founded_year": 2010,
      "website": null, "is_active": true,
      "created_at": "...", "updated_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 5, "total_pages": 1 }
}
```

---

### `GET /teams/:slug`

Public. Returns an active team by slug.

**Response 200** — returns the team object

**Errors:** `404 NOT_FOUND`

---

## Teams (admin)

All admin team endpoints require admin role + CSRF on mutations.

### `GET /admin/teams`

Requires admin. Lists all teams including inactive ones.

**Response 200** — `{ "data": [ ...team... ] }`

---

### `POST /admin/teams`

Requires admin + CSRF. Creates a team.

**Request body**
```json
{
  "name": "Team Alpha",
  "slug": "team-alpha",
  "description": null,
  "logo_url": null,
  "city": "Manila",
  "country": "Philippines",
  "founded_year": 2010,
  "website": null,
  "is_active": true
}
```

`slug` is optional — auto-generated from `name` (guaranteed unique). `is_active` defaults to `true`.

**Response 201** — returns the created team

---

### `PATCH /admin/teams/:id`

Requires admin + CSRF. Updates all writable fields.

**Request body** — same shape as POST

**Response 200** — returns the updated team

**Errors:** `404 NOT_FOUND`, `400 BAD_REQUEST` (slug conflict)

---

### `DELETE /admin/teams/:id`

Requires admin + CSRF. Deletes the team and all its members/registrations (cascade).

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

### `GET /admin/teams/:id/members`

Requires admin. Lists players on a team (includes departed members where `left_at` is set).

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "team_id": "uuid", "player_id": "uuid",
      "player_name": "Jose Reyes", "player_slug": "jose-reyes",
      "is_captain": true, "joined_at": "2022-01-01", "left_at": null,
      "created_at": "..."
    }
  ]
}
```

---

### `POST /admin/teams/:id/members`

Requires admin + CSRF. Adds a player to a team.

**Request body**
```json
{ "player_id": "uuid", "is_captain": false, "joined_at": "2024-01-01" }
```

**Response 201** — returns the created membership record

**Errors:** `404 NOT_FOUND` (team or player), `400 BAD_REQUEST` (already a member)

---

### `DELETE /admin/teams/:id/members/:player_id`

Requires admin + CSRF. Removes a player from a team.

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

## Players (public)

### `GET /players`

Public. Lists active players, paginated.

**Query params:** `page` (default 1), `per_page` (default 20, max 100)

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "name": "Jose Reyes", "slug": "jose-reyes",
      "bio": null, "photo_url": null, "date_of_birth": "1995-03-15",
      "nationality": "Philippines", "belt_rank": "black",
      "weight_class": "lightweight", "is_active": true,
      "created_at": "...", "updated_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 12, "total_pages": 1 }
}
```

---

### `GET /players/:slug`

Public. Returns an active player by slug.

**Response 200** — returns the player object

**Errors:** `404 NOT_FOUND`

---

## Players (admin)

### `GET /admin/players`

Requires admin. Lists all players including inactive ones.

**Response 200** — `{ "data": [ ...player... ] }`

---

### `POST /admin/players`

Requires admin + CSRF. Creates a player.

**Request body**
```json
{
  "name": "Jose Reyes",
  "slug": "jose-reyes",
  "bio": null,
  "photo_url": null,
  "date_of_birth": "1995-03-15",
  "nationality": "Philippines",
  "belt_rank": "black",
  "weight_class": "lightweight",
  "is_active": true
}
```

`slug` is optional — auto-generated from `name` (guaranteed unique). `is_active` defaults to `true`.

**Response 201** — returns the created player

---

### `PATCH /admin/players/:id`

Requires admin + CSRF. Updates all writable fields.

**Request body** — same shape as POST

**Response 200** — returns the updated player

**Errors:** `404 NOT_FOUND`, `400 BAD_REQUEST` (slug conflict)

---

### `DELETE /admin/players/:id`

Requires admin + CSRF. Deletes the player.

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

## Tournaments (public)

### `GET /tournaments`

Public. Lists non-cancelled tournaments ordered by upcoming start date, paginated.

**Query params:** `page` (default 1), `per_page` (default 20, max 100)

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "name": "Open 2026", "slug": "open-2026",
      "description": null, "location": "Manila",
      "start_date": "2026-08-10", "end_date": "2026-08-11",
      "registration_open_at": "2026-06-01T00:00:00Z",
      "registration_close_at": "2026-07-31T23:59:59Z",
      "status": "upcoming", "max_teams": 32,
      "created_at": "...", "updated_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 3, "total_pages": 1 }
}
```

---

### `GET /tournaments/:slug`

Public. Returns a tournament by slug (any status except intentionally hidden).

**Response 200** — returns the tournament object

**Errors:** `404 NOT_FOUND`

---

## Tournaments (admin)

### `GET /admin/tournaments`

Requires admin. Lists all tournaments ordered by start date descending.

**Response 200** — `{ "data": [ ...tournament... ] }`

---

### `POST /admin/tournaments`

Requires admin + CSRF. Creates a tournament.

**Request body**
```json
{
  "name": "Open 2026",
  "slug": "open-2026",
  "description": null,
  "location": "Manila",
  "start_date": "2026-08-10",
  "end_date": "2026-08-11",
  "registration_open_at": "2026-06-01T00:00:00Z",
  "registration_close_at": "2026-07-31T23:59:59Z",
  "status": "upcoming",
  "max_teams": 32
}
```

`slug` is optional — auto-generated from `name` (guaranteed unique). `status` defaults to `"upcoming"`.

**Response 201** — returns the created tournament

---

### `PATCH /admin/tournaments/:id`

Requires admin + CSRF. Updates all writable fields.

**Request body** — same shape as POST

**Response 200** — returns the updated tournament

**Errors:** `404 NOT_FOUND`, `400 BAD_REQUEST` (slug conflict)

---

### `DELETE /admin/tournaments/:id`

Requires admin + CSRF. Deletes the tournament and all related divisions and registrations (cascade).

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

### `GET /admin/tournaments/:id/divisions`

Requires admin. Lists divisions for a tournament.

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "tournament_id": "uuid", "name": "Open Lightweight",
      "description": null, "max_participants": 16, "created_at": "..."
    }
  ]
}
```

---

### `POST /admin/tournaments/:id/divisions`

Requires admin + CSRF. Adds a division to a tournament.

**Request body**
```json
{ "name": "Open Lightweight", "description": null, "max_participants": 16 }
```

**Response 201** — returns the created division

**Errors:** `404 NOT_FOUND` (tournament), `400 BAD_REQUEST` (empty name)

---

### `DELETE /admin/tournaments/:id/divisions/:div_id`

Requires admin + CSRF. Deletes a division (and cascades to player entries).

**Response 204** (no body)

**Errors:** `404 NOT_FOUND`

---

## Registrations (public)

### `POST /tournaments/:slug/register-team`

Requires session + CSRF (authenticated user). Submits a team registration for a tournament. Validates that the registration window is open and the team is not already registered.

**Headers:** `x-csrf-token: <token>`

**Request body**
```json
{ "team_id": "uuid", "division_id": "uuid or null", "notes": "optional" }
```

**Response 201** — returns the created registration record
```json
{
  "data": {
    "id": "uuid",
    "tournament_id": "uuid", "tournament_name": "Open 2026", "tournament_slug": "open-2026",
    "team_id": "uuid", "team_name": "Team Alpha", "team_slug": "team-alpha",
    "division_id": null, "division_name": null,
    "status": "pending",
    "registered_by": "uuid", "approved_by": null,
    "notes": null,
    "created_at": "...", "updated_at": "..."
  }
}
```

**Errors:** `400 BAD_REQUEST` (window closed, already registered, cancelled tournament), `404 NOT_FOUND` (tournament not found)

---

## Registrations (admin)

### `GET /admin/registrations`

Requires admin. Lists all registrations across all tournaments, newest first.

**Response 200** — `{ "data": [ ...registration... ] }`

---

### `GET /admin/tournaments/:id/registrations`

Requires admin. Lists all registrations for a specific tournament.

**Response 200** — `{ "data": [ ...registration... ] }`

---

### `PATCH /admin/registrations/:id`

Requires admin + CSRF. Updates a registration's status. Valid values: `pending`, `approved`, `rejected`, `checked_in`, `completed`, `cancelled`.

Approving (`approved`) automatically awards `tournament_participation` points to the team. Completing (`completed`) awards `tournament_completion` points.

**Headers:** `x-csrf-token: <token>`

**Request body**
```json
{ "status": "approved", "notes": "optional" }
```

**Response 200** — returns the updated registration record

**Errors:** `400 BAD_REQUEST` (invalid status), `404 NOT_FOUND`

---

## Leaderboards (public)

### `GET /leaderboards/players`

Public. Returns the latest player leaderboard snapshot entries, ranked by points descending. Returns an empty array if no snapshot has been built yet.

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid", "snapshot_id": "uuid",
      "entity_type": "player", "entity_id": "uuid",
      "entity_name": "Jose Reyes", "entity_slug": "jose-reyes",
      "rank": 1, "points": 25, "wins": 3, "losses": 1, "draws": 0,
      "created_at": "..."
    }
  ]
}
```

---

### `GET /leaderboards/teams`

Public. Returns the latest team leaderboard snapshot entries, ranked by points descending.

**Response 200** — same shape as player leaderboard with `entity_type: "team"`

---

## Leaderboards (admin)

### `POST /admin/leaderboards/rebuild`

Requires admin + CSRF. Triggers a full leaderboard rebuild for both players and teams. Reads from `team_stats`/`player_stats` tables, creates two new immutable snapshots, and returns their IDs.

**Headers:** `x-csrf-token: <token>`

**Response 200**
```json
{
  "data": {
    "team_snapshot_id": "uuid",
    "player_snapshot_id": "uuid"
  }
}
```

---

## Activity Feed (public)

### `GET /feed`

Public. Returns paginated visible activity feed events, newest first.

**Query params:** `page` (default 1), `per_page` (default 20, max 100)

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "registration_approved",
      "entity_type": "tournament", "entity_id": "uuid", "entity_slug": "open-2026",
      "actor_type": "team", "actor_id": "uuid", "actor_slug": "team-alpha",
      "title": "Team Alpha approved for Open 2026",
      "body": null, "is_visible": true,
      "created_at": "..."
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 5, "total_pages": 1 }
}
```

---

### `GET /feed/players/:slug`

Public. Returns paginated feed events where `entity_type = 'player'` and `entity_id` matches the player's ID (looked up by slug).

**Query params:** `page`, `per_page`

**Response 200** — same paginated shape as `/feed`

**Errors:** `404 NOT_FOUND` (player not found)

---

### `GET /feed/teams/:slug`

Public. Returns paginated feed events for the given team slug.

**Query params:** `page`, `per_page`

**Response 200** — same paginated shape as `/feed`

**Errors:** `404 NOT_FOUND` (team not found)

---

## Activity Feed (admin)

### `PATCH /admin/feed/:id`

Requires admin + CSRF. Shows or hides a feed item.

**Headers:** `x-csrf-token: <token>`

**Request body**
```json
{ "is_visible": false }
```

**Response 200** — returns the updated feed record

**Errors:** `404 NOT_FOUND`
