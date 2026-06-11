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
