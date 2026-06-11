import {
  createPage,
  deleteMedia,
  fetchCsrfToken,
  fetchCurrentUser,
  isNetworkError,
  isUnauthorizedError,
  listMedia,
  listPages,
  login,
  logout,
  publishPage,
  unpublishPage,
  updateMedia,
  updatePage,
  uploadMedia,
} from './api'

const PREVIEW_SESSION_KEY = 'odp-admin-preview-session'
const PREVIEW_PAGES_KEY = 'odp-admin-preview-pages'
const PREVIEW_MEDIA_KEY = 'odp-admin-preview-media'
const PREVIEW_SETTINGS_KEY = 'odp-admin-preview-settings'

const routes = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    summary: 'Program pulse, quick actions, and platform status.',
  },
  {
    key: 'pages',
    label: 'Pages',
    summary: 'Drafts, publishing workflow, and live preview.',
  },
  {
    key: 'media',
    label: 'Media',
    summary: 'Uploads, metadata, and asset selection.',
  },
  {
    key: 'settings',
    label: 'Settings',
    summary: 'Brand, SEO, and organizational defaults.',
  },
]

const previewUser = {
  id: 'preview-admin',
  email: 'preview@onedocepares.com',
  display_name: 'Local Preview Admin',
  roles: ['admin'],
}

function createDefaultPages() {
  return [
    {
      id: crypto.randomUUID(),
      title: 'Homepage',
      slug: 'home',
      body: '<p>Welcome to the One Doce Pares platform preview.</p>',
      excerpt: 'Homepage introduction',
      seo_title: 'One Doce Pares',
      seo_description: 'Preview homepage',
      status: 'published',
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'About One Doce Pares',
      slug: 'about',
      body: '<p>Martial arts organization profile and values.</p>',
      excerpt: 'Organization overview',
      seo_title: 'About One Doce Pares',
      seo_description: 'Who we are',
      status: 'draft',
      published_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
}

function createDefaultMedia() {
  return [
    {
      id: crypto.randomUUID(),
      filename: 'training-hall.jpg',
      original_name: 'training-hall.jpg',
      alt_text: 'Students training in the hall',
      mime_type: 'image/jpeg',
      size_bytes: 245600,
      url: 'https://placehold.co/800x500?text=Training+Hall',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      filename: 'tournament-poster.png',
      original_name: 'tournament-poster.png',
      alt_text: 'Tournament event poster',
      mime_type: 'image/png',
      size_bytes: 189300,
      url: 'https://placehold.co/800x500?text=Tournament+Poster',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
}

function createDefaultSettings() {
  return {
    siteTitle: 'One Doce Pares',
    homepageTagline: 'Discipline, community, and competition under one platform.',
    defaultSeoTitle: 'One Doce Pares Official Platform',
    defaultSeoDescription: 'CMS and tournament management platform for One Doce Pares.',
    contactEmail: 'info@onedocepares.com',
    registrationNotice: 'Team registration requests are reviewed by administrators before approval.',
  }
}

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDate(value) {
  if (!value) {
    return 'Not published'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createAppState() {
  return {
    route: getRoute(),
    auth: {
      user: null,
      mode: 'api',
      status: 'loading',
      error: '',
      isOffline: false,
    },
    ui: {
      flash: null,
      saving: false,
      uploading: false,
    },
    pages: {
      items: readStorage(PREVIEW_PAGES_KEY, createDefaultPages()),
      selectedId: null,
      draft: null,
      filter: '',
      editorMode: 'create',
    },
    media: {
      items: readStorage(PREVIEW_MEDIA_KEY, createDefaultMedia()),
      altDrafts: {},
    },
    settings: readStorage(PREVIEW_SETTINGS_KEY, createDefaultSettings()),
  }
}

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return routes.some((route) => route.key === hash) ? hash : 'dashboard'
}

function getCurrentRoute(state) {
  return routes.find((route) => route.key === state.route) || routes[0]
}

function isPreviewMode(state) {
  return state.auth.mode === 'preview'
}

function isAuthenticated(state) {
  return Boolean(state.auth.user)
}

function getSelectedPage(state) {
  return state.pages.items.find((page) => page.id === state.pages.selectedId) || null
}

function getPageDraft(state) {
  if (state.pages.draft) {
    return state.pages.draft
  }

  return {
    title: '',
    slug: '',
    excerpt: '',
    body: '<p></p>',
    seo_title: '',
    seo_description: '',
    status: 'draft',
  }
}

function renderStatusBadge(status) {
  const className =
    status === 'published' ? 'text-bg-success' : status === 'draft' ? 'text-bg-secondary' : 'text-bg-warning'
  return `<span class="badge ${className} rounded-pill">${escapeHtml(status)}</span>`
}

function renderAuthScreen(state) {
  const offlineNote = state.auth.isOffline
    ? `
      <div class="admin-banner admin-banner--warning">
        The API is unreachable right now. You can still use Local Preview Mode to test the frontend experience.
      </div>
    `
    : ''

  return `
    <main class="admin-auth-shell">
      <section class="admin-auth-card shell-card rounded-4 p-4 p-lg-5">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-4">
          <div>
            <div class="text-uppercase small fw-semibold text-secondary mb-2">Admin sign-in</div>
            <h1 class="h2 mb-2">Access the One Doce Pares control room</h1>
            <p class="text-secondary mb-0">
              Sign in with an admin account or continue in local preview mode while the API is offline.
            </p>
          </div>
          <a class="btn btn-outline-dark" href="/">Public site</a>
        </div>
        ${offlineNote}
        ${
          state.auth.error
            ? `<div class="alert alert-danger" role="alert">${escapeHtml(state.auth.error)}</div>`
            : ''
        }
        <form data-form="login" class="d-grid gap-3">
          <div>
            <label class="form-label" for="login-email">Email</label>
            <input class="form-control form-control-lg" id="login-email" name="email" type="email" autocomplete="email" required />
          </div>
          <div>
            <label class="form-label" for="login-password">Password</label>
            <input class="form-control form-control-lg" id="login-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <div class="d-flex flex-wrap gap-2 pt-2">
            <button class="btn btn-primary btn-lg" type="submit">Sign in</button>
            <button class="btn btn-outline-dark btn-lg" type="button" data-action="enter-preview">Local preview mode</button>
          </div>
        </form>
      </section>
    </main>
  `
}

function renderFlash(state) {
  if (!state.ui.flash) {
    return ''
  }

  const className =
    state.ui.flash.type === 'danger'
      ? 'alert-danger'
      : state.ui.flash.type === 'success'
        ? 'alert-success'
        : 'alert-warning'

  return `<div class="alert ${className} admin-alert" role="alert">${escapeHtml(state.ui.flash.message)}</div>`
}

function renderDashboard(state) {
  const publishedCount = state.pages.items.filter((page) => page.status === 'published').length
  const draftCount = state.pages.items.filter((page) => page.status !== 'published').length

  return `
    <div class="row g-4">
      <div class="col-xl-8">
        <div class="shell-card rounded-4 p-4 h-100">
          <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
            <div>
              <div class="text-uppercase small fw-semibold text-secondary mb-2">Platform readiness</div>
              <h2 class="h4 mb-1">Phase 1 frontend is now actionable</h2>
              <p class="text-secondary mb-0">Use the modules on the left to manage pages, media, and site settings from one shell.</p>
            </div>
            <span class="status-pill"><span class="status-dot"></span>${isPreviewMode(state) ? 'Local preview' : 'API-connected session'}</span>
          </div>
          <div class="row g-3">
            <div class="col-md-4">
              <div class="admin-metric rounded-4 p-3 h-100">
                <div class="admin-metric__label">Published pages</div>
                <div class="admin-metric__value">${publishedCount}</div>
                <div class="text-secondary small">Live content ready for the public site.</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="admin-metric rounded-4 p-3 h-100">
                <div class="admin-metric__label">Draft pages</div>
                <div class="admin-metric__value">${draftCount}</div>
                <div class="text-secondary small">Pages still waiting on editing or publishing.</div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="admin-metric rounded-4 p-3 h-100">
                <div class="admin-metric__label">Media assets</div>
                <div class="admin-metric__value">${state.media.items.length}</div>
                <div class="text-secondary small">Reusable assets available to editors.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="shell-card rounded-4 p-4 h-100">
          <div class="text-uppercase small fw-semibold text-secondary mb-3">Quick actions</div>
          <div class="d-grid gap-2">
            <a class="btn btn-primary" href="#/pages">Open pages workspace</a>
            <a class="btn btn-outline-dark" href="#/media">Review media library</a>
            <a class="btn btn-outline-dark" href="#/settings">Edit site defaults</a>
          </div>
          <hr class="my-4" />
          <div class="text-uppercase small fw-semibold text-secondary mb-2">Session</div>
          <div class="small text-secondary">Signed in as ${escapeHtml(state.auth.user.display_name)} (${escapeHtml(state.auth.user.email)})</div>
        </div>
      </div>
    </div>
  `
}

function renderPagesView(state) {
  const draft = getPageDraft(state)
  const filteredPages = state.pages.items.filter((page) => {
    const haystack = `${page.title} ${page.slug}`.toLowerCase()
    return haystack.includes(state.pages.filter.toLowerCase())
  })
  const selectedPage = getSelectedPage(state)
  const previewHtml = draft.body || '<p>No body content yet.</p>'

  return `
    <div class="row g-4">
      <div class="col-xl-5">
        <div class="shell-card rounded-4 p-4 h-100">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div>
              <div class="text-uppercase small fw-semibold text-secondary mb-1">CMS pages</div>
              <h2 class="h4 mb-0">Page library</h2>
            </div>
            <button class="btn btn-primary" type="button" data-action="new-page">Create page</button>
          </div>
          <div class="mb-3">
            <label class="form-label" for="page-filter">Search pages</label>
            <input class="form-control" id="page-filter" name="pageFilter" value="${escapeHtml(state.pages.filter)}" placeholder="Search by title or slug" />
          </div>
          <div class="admin-page-list">
            ${
              filteredPages.length
                ? filteredPages
                    .map(
                      (page) => `
                        <button
                          class="admin-page-card ${page.id === state.pages.selectedId ? 'is-active' : ''}"
                          type="button"
                          data-action="select-page"
                          data-page-id="${page.id}"
                        >
                          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div>
                              <div class="fw-semibold">${escapeHtml(page.title)}</div>
                              <div class="small text-secondary">/${escapeHtml(page.slug)}</div>
                            </div>
                            ${renderStatusBadge(page.status)}
                          </div>
                          <div class="small text-secondary">Updated ${escapeHtml(formatDate(page.updated_at))}</div>
                        </button>
                      `,
                    )
                    .join('')
                : `<div class="admin-empty-state">No pages match your current search.</div>`
            }
          </div>
        </div>
      </div>
      <div class="col-xl-7">
        <div class="shell-card rounded-4 p-4">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div>
              <div class="text-uppercase small fw-semibold text-secondary mb-1">Editor</div>
              <h2 class="h4 mb-0">${selectedPage ? 'Edit page' : 'Create page'}</h2>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              ${
                selectedPage
                  ? `
                    <button class="btn btn-outline-dark" type="button" data-action="duplicate-preview-link">Preview</button>
                    <button class="btn btn-outline-dark" type="button" data-action="toggle-publish">
                      ${selectedPage.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  `
                  : ''
              }
            </div>
          </div>
          <form data-form="page-editor" class="d-grid gap-3">
            <div class="row g-3">
              <div class="col-md-8">
                <label class="form-label" for="page-title">Title</label>
                <input class="form-control" id="page-title" name="title" value="${escapeHtml(draft.title)}" required />
              </div>
              <div class="col-md-4">
                <label class="form-label" for="page-status">Status</label>
                <select class="form-select" id="page-status" name="status">
                  <option value="draft" ${draft.status === 'draft' ? 'selected' : ''}>Draft</option>
                  <option value="published" ${draft.status === 'published' ? 'selected' : ''}>Published</option>
                </select>
              </div>
            </div>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label" for="page-slug">Slug</label>
                <input class="form-control" id="page-slug" name="slug" value="${escapeHtml(draft.slug)}" placeholder="auto-generated-from-title" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="page-excerpt">Excerpt</label>
                <input class="form-control" id="page-excerpt" name="excerpt" value="${escapeHtml(draft.excerpt || '')}" placeholder="Short summary for listings" />
              </div>
            </div>
            <div>
              <label class="form-label" for="page-body">Body</label>
              <textarea class="form-control admin-textarea" id="page-body" name="body">${escapeHtml(draft.body)}</textarea>
            </div>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label" for="seo-title">SEO title</label>
                <input class="form-control" id="seo-title" name="seo_title" value="${escapeHtml(draft.seo_title || '')}" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="seo-description">SEO description</label>
                <input class="form-control" id="seo-description" name="seo_description" value="${escapeHtml(draft.seo_description || '')}" />
              </div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-primary" type="submit">${selectedPage ? 'Save changes' : 'Create draft'}</button>
              <button class="btn btn-outline-dark" type="button" data-action="save-and-publish">Save and publish</button>
              <button class="btn btn-outline-secondary" type="button" data-action="reset-page-form">Reset</button>
            </div>
          </form>
        </div>
        <div class="shell-card rounded-4 p-4 mt-4">
          <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
            <div>
              <div class="text-uppercase small fw-semibold text-secondary mb-1">Preview</div>
              <h2 class="h5 mb-0" data-preview-title>${escapeHtml(draft.title || 'Untitled page')}</h2>
            </div>
            <div class="small text-secondary" data-preview-slug>Slug: /${escapeHtml(draft.slug || slugify(draft.title || 'untitled-page'))}</div>
          </div>
          <div class="admin-preview" data-preview-body>${previewHtml}</div>
        </div>
      </div>
    </div>
  `
}

function renderMediaView(state) {
  return `
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="shell-card rounded-4 p-4 h-100">
          <div class="text-uppercase small fw-semibold text-secondary mb-2">Upload assets</div>
          <h2 class="h4 mb-3">Media intake</h2>
          <form data-form="media-upload" class="d-grid gap-3">
            <div>
              <label class="form-label" for="media-file">Choose a file</label>
              <input class="form-control" id="media-file" name="file" type="file" accept="image/*" required />
            </div>
            <button class="btn btn-primary" type="submit">Upload to library</button>
          </form>
          <p class="text-secondary small mt-3 mb-0">
            Uploads work against the API when available. In local preview mode they are stored in browser storage so the interface remains testable.
          </p>
        </div>
      </div>
      <div class="col-lg-8">
        <div class="shell-card rounded-4 p-4">
          <div class="d-flex justify-content-between align-items-center gap-3 mb-3">
            <div>
              <div class="text-uppercase small fw-semibold text-secondary mb-1">Library</div>
              <h2 class="h4 mb-0">${state.media.items.length} assets</h2>
            </div>
          </div>
          <div class="row g-3">
            ${
              state.media.items.length
                ? state.media.items
                    .map(
                      (item) => `
                        <div class="col-md-6">
                          <article class="admin-media-card h-100">
                            <div class="admin-media-card__frame">
                              <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt_text || item.original_name)}" />
                            </div>
                            <div class="p-3">
                              <div class="fw-semibold mb-1">${escapeHtml(item.original_name)}</div>
                              <div class="small text-secondary mb-3">${escapeHtml(item.mime_type)} • ${Math.round(item.size_bytes / 1024)} KB</div>
                              <label class="form-label small" for="alt-${item.id}">Alt text</label>
                              <input
                                class="form-control form-control-sm mb-3"
                                id="alt-${item.id}"
                                name="alt-${item.id}"
                                value="${escapeHtml(state.media.altDrafts[item.id] ?? item.alt_text ?? '')}"
                                data-media-id="${item.id}"
                                data-field="media-alt"
                              />
                              <div class="d-flex gap-2 flex-wrap">
                                <button class="btn btn-outline-dark btn-sm" type="button" data-action="save-media-alt" data-media-id="${item.id}">Save alt text</button>
                                <button class="btn btn-outline-danger btn-sm" type="button" data-action="delete-media" data-media-id="${item.id}">Delete</button>
                              </div>
                            </div>
                          </article>
                        </div>
                      `,
                    )
                    .join('')
                : `<div class="col-12"><div class="admin-empty-state">No media yet. Upload the first asset to populate the library.</div></div>`
            }
          </div>
        </div>
      </div>
    </div>
  `
}

function renderSettingsView(state) {
  return `
    <div class="shell-card rounded-4 p-4">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div class="text-uppercase small fw-semibold text-secondary mb-1">Site defaults</div>
          <h2 class="h4 mb-1">Settings placeholder</h2>
          <p class="text-secondary mb-0">This placeholder is fully editable so the team can test layout and form behavior before the backend settings endpoints arrive.</p>
        </div>
      </div>
      <form data-form="settings" class="row g-3">
        <div class="col-md-6">
          <label class="form-label" for="site-title">Site title</label>
          <input class="form-control" id="site-title" name="siteTitle" value="${escapeHtml(state.settings.siteTitle)}" />
        </div>
        <div class="col-md-6">
          <label class="form-label" for="contact-email">Contact email</label>
          <input class="form-control" id="contact-email" name="contactEmail" type="email" value="${escapeHtml(state.settings.contactEmail)}" />
        </div>
        <div class="col-12">
          <label class="form-label" for="homepage-tagline">Homepage tagline</label>
          <input class="form-control" id="homepage-tagline" name="homepageTagline" value="${escapeHtml(state.settings.homepageTagline)}" />
        </div>
        <div class="col-md-6">
          <label class="form-label" for="seo-default-title">Default SEO title</label>
          <input class="form-control" id="seo-default-title" name="defaultSeoTitle" value="${escapeHtml(state.settings.defaultSeoTitle)}" />
        </div>
        <div class="col-md-6">
          <label class="form-label" for="seo-default-description">Default SEO description</label>
          <input class="form-control" id="seo-default-description" name="defaultSeoDescription" value="${escapeHtml(state.settings.defaultSeoDescription)}" />
        </div>
        <div class="col-12">
          <label class="form-label" for="registration-notice">Registration notice</label>
          <textarea class="form-control admin-textarea admin-textarea--sm" id="registration-notice" name="registrationNotice">${escapeHtml(state.settings.registrationNotice)}</textarea>
        </div>
        <div class="col-12">
          <button class="btn btn-primary" type="submit">Save placeholder settings</button>
        </div>
      </form>
    </div>
  `
}

function renderMainView(state) {
  if (state.route === 'pages') {
    return renderPagesView(state)
  }

  if (state.route === 'media') {
    return renderMediaView(state)
  }

  if (state.route === 'settings') {
    return renderSettingsView(state)
  }

  return renderDashboard(state)
}

function renderApp(state) {
  if (!isAuthenticated(state)) {
    return renderAuthScreen(state)
  }

  const route = getCurrentRoute(state)

  return `
    <div class="admin-app">
      <aside class="admin-sidebar">
        <div>
          <a class="admin-brand" href="#/dashboard">
            <span class="admin-brand__crest">ODP</span>
            <span>
              <span class="admin-brand__name">One Doce Pares</span>
              <span class="admin-brand__sub">${isPreviewMode(state) ? 'Local preview mode' : 'Admin console'}</span>
            </span>
          </a>
          <nav class="admin-nav" aria-label="Admin sections">
            ${routes
              .map(
                (item) => `
                  <a class="admin-nav__link ${item.key === state.route ? 'is-active' : ''}" href="#/${item.key}">
                    <span class="admin-nav__icon" aria-hidden="true">${item.label.slice(0, 1)}</span>
                    <span>
                      <span class="admin-nav__label">${item.label}</span>
                      <span class="admin-nav__summary">${item.summary}</span>
                    </span>
                  </a>
                `,
              )
              .join('')}
          </nav>
        </div>
        <div class="admin-sidebar__footer">
          <div class="text-uppercase small fw-semibold text-secondary mb-2">Signed in</div>
          <div class="small text-white mb-2">${escapeHtml(state.auth.user.display_name)}</div>
          <div class="small text-secondary mb-3">${escapeHtml(state.auth.user.email)}</div>
          <button class="btn btn-outline-light btn-sm" type="button" data-action="logout">Sign out</button>
        </div>
      </aside>
      <div class="admin-main">
        <header class="admin-topbar">
          <div>
            <div class="text-uppercase small fw-semibold text-secondary mb-2">${escapeHtml(route.label)}</div>
            <h1 class="h2 mb-2">${escapeHtml(route.label)}</h1>
            <p class="text-secondary mb-0">${escapeHtml(route.summary)}</p>
          </div>
          <div class="d-flex flex-wrap gap-2">
            <span class="status-pill">
              <span class="status-dot"></span>
              ${isPreviewMode(state) ? 'Frontend preview mode' : 'Connected to API'}
            </span>
            <a class="btn btn-outline-dark" href="/">Public site</a>
          </div>
        </header>
        ${renderFlash(state)}
        ${renderMainView(state)}
      </div>
    </div>
  `
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read file for preview upload.'))
    reader.readAsDataURL(file)
  })
}

export function createAdminApp(root) {
  const state = createAppState()

  function setFlash(message, type = 'success') {
    state.ui.flash = { message, type }
  }

  function clearFlash() {
    state.ui.flash = null
  }

  function persistPreviewData() {
    writeStorage(PREVIEW_PAGES_KEY, state.pages.items)
    writeStorage(PREVIEW_MEDIA_KEY, state.media.items)
    writeStorage(PREVIEW_SETTINGS_KEY, state.settings)
  }

  function syncPageDraft(page) {
    state.pages.draft = page
      ? {
          title: page.title || '',
          slug: page.slug || '',
          excerpt: page.excerpt || '',
          body: page.body || '',
          seo_title: page.seo_title || '',
          seo_description: page.seo_description || '',
          status: page.status || 'draft',
        }
      : null
  }

  function render() {
    root.innerHTML = renderApp(state)
    document.title = `One Doce Pares Admin | ${getCurrentRoute(state).label}`
  }

  function updateEditorPreview() {
    const previewTitle = root.querySelector('[data-preview-title]')
    const previewSlug = root.querySelector('[data-preview-slug]')
    const previewBody = root.querySelector('[data-preview-body]')
    const draft = getPageDraft(state)

    if (previewTitle) {
      previewTitle.textContent = draft.title || 'Untitled page'
    }

    if (previewSlug) {
      previewSlug.textContent = `Slug: /${draft.slug || slugify(draft.title || 'untitled-page')}`
    }

    if (previewBody) {
      previewBody.innerHTML = draft.body || '<p>No body content yet.</p>'
    }
  }

  function enterPreviewMode() {
    state.auth.mode = 'preview'
    state.auth.status = 'authenticated'
    state.auth.user = previewUser
    state.auth.error = ''
    window.localStorage.setItem(PREVIEW_SESSION_KEY, '1')
    if (!window.location.hash || window.location.hash === '#/login') {
      window.location.hash = '#/dashboard'
    }
  }

  async function bootstrapAuth() {
    if (window.localStorage.getItem(PREVIEW_SESSION_KEY) === '1') {
      enterPreviewMode()
      render()
      return
    }

    try {
      const response = await fetchCurrentUser()
      state.auth.user = response.data
      state.auth.status = 'authenticated'
      state.auth.mode = 'api'
      await fetchCsrfToken().catch(() => {})
      if (!window.location.hash || window.location.hash === '#/login') {
        window.location.hash = '#/dashboard'
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        state.auth.user = null
        state.auth.status = 'anonymous'
      } else if (isNetworkError(error)) {
        state.auth.user = null
        state.auth.status = 'anonymous'
        state.auth.isOffline = true
      } else {
        state.auth.user = null
        state.auth.status = 'anonymous'
        state.auth.error = error.message
      }
    }

    render()
  }

  async function savePage(formData, shouldPublish = false) {
    const title = formData.get('title')?.trim() || ''
    const body = formData.get('body')?.trim() || ''

    if (!title || !body) {
      setFlash('Title and body are required before saving a page.', 'danger')
      render()
      return
    }

    const payload = {
      title,
      slug: formData.get('slug')?.trim() || undefined,
      excerpt: formData.get('excerpt')?.trim() || null,
      body,
      seo_title: formData.get('seo_title')?.trim() || null,
      seo_description: formData.get('seo_description')?.trim() || null,
      status: shouldPublish ? 'published' : formData.get('status') || 'draft',
    }

    try {
      clearFlash()
      if (isPreviewMode(state)) {
        const existing = getSelectedPage(state)
        const now = new Date().toISOString()
        const nextPage = existing
          ? {
              ...existing,
              ...payload,
              slug: payload.slug || slugify(title),
              status: shouldPublish ? 'published' : payload.status,
              published_at:
                shouldPublish || payload.status === 'published'
                  ? existing.published_at || now
                  : null,
              updated_at: now,
            }
          : {
              id: crypto.randomUUID(),
              ...payload,
              slug: payload.slug || slugify(title),
              published_at:
                shouldPublish || payload.status === 'published' ? now : null,
              created_at: now,
              updated_at: now,
            }

        if (existing) {
          state.pages.items = state.pages.items.map((page) => (page.id === existing.id ? nextPage : page))
        } else {
          state.pages.items = [nextPage, ...state.pages.items]
        }

        state.pages.selectedId = nextPage.id
        syncPageDraft(nextPage)
        persistPreviewData()
        setFlash(`Page ${existing ? 'updated' : 'created'} in local preview mode.`)
      } else {
        const existing = getSelectedPage(state)
        const response = existing
          ? await updatePage(existing.id, payload)
          : await createPage(payload)
        let page = response.data

        if (shouldPublish || payload.status === 'published') {
          const publishResponse = await publishPage(page.id)
          page = publishResponse.data
        }

        if (existing) {
          state.pages.items = state.pages.items.map((item) => (item.id === page.id ? page : item))
        } else {
          state.pages.items = [page, ...state.pages.items]
        }

        state.pages.selectedId = page.id
        syncPageDraft(page)
        setFlash(`Page ${existing ? 'updated' : 'created'} successfully.`)
      }
    } catch (error) {
      setFlash(error.message, 'danger')
    }

    render()
  }

  async function togglePublishSelectedPage() {
    const selected = getSelectedPage(state)

    if (!selected) {
      setFlash('Select a page before changing publish state.', 'warning')
      render()
      return
    }

    try {
      if (isPreviewMode(state)) {
        const nextStatus = selected.status === 'published' ? 'draft' : 'published'
        const updatedPage = {
          ...selected,
          status: nextStatus,
          published_at: nextStatus === 'published' ? selected.published_at || new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }
        state.pages.items = state.pages.items.map((page) => (page.id === selected.id ? updatedPage : page))
        syncPageDraft(updatedPage)
        persistPreviewData()
        setFlash(`Page moved to ${nextStatus}.`)
      } else {
        const response =
          selected.status === 'published'
            ? await unpublishPage(selected.id)
            : await publishPage(selected.id)
        state.pages.items = state.pages.items.map((page) => (page.id === selected.id ? response.data : page))
        syncPageDraft(response.data)
        setFlash(`Page ${selected.status === 'published' ? 'unpublished' : 'published'} successfully.`)
      }
    } catch (error) {
      setFlash(error.message, 'danger')
    }

    render()
  }

  async function handleMediaUpload(file) {
    if (!file) {
      setFlash('Choose a file to upload first.', 'warning')
      render()
      return
    }

    try {
      if (isPreviewMode(state)) {
        const previewUrl = await fileToDataUrl(file)
        const item = {
          id: crypto.randomUUID(),
          filename: file.name,
          original_name: file.name,
          alt_text: '',
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          url: previewUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        state.media.items = [item, ...state.media.items]
        persistPreviewData()
        setFlash('Media uploaded into local preview mode.')
      } else {
        const response = await uploadMedia(file)
        state.media.items = [response.data, ...state.media.items]
        setFlash('Media uploaded successfully.')
      }
    } catch (error) {
      setFlash(error.message, 'danger')
    }

    render()
  }

  async function saveMediaAlt(mediaId) {
    const current = state.media.items.find((item) => item.id === mediaId)
    const nextAlt = state.media.altDrafts[mediaId] ?? current?.alt_text ?? ''

    if (!current) {
      return
    }

    try {
      if (isPreviewMode(state)) {
        state.media.items = state.media.items.map((item) =>
          item.id === mediaId
            ? {
                ...item,
                alt_text: nextAlt,
                updated_at: new Date().toISOString(),
              }
            : item,
        )
        persistPreviewData()
      } else {
        const response = await updateMedia(mediaId, { alt_text: nextAlt })
        state.media.items = state.media.items.map((item) => (item.id === mediaId ? response.data : item))
      }

      setFlash('Media alt text saved.')
    } catch (error) {
      setFlash(error.message, 'danger')
    }

    render()
  }

  async function removeMedia(mediaId) {
    try {
      if (isPreviewMode(state)) {
        state.media.items = state.media.items.filter((item) => item.id !== mediaId)
        persistPreviewData()
      } else {
        await deleteMedia(mediaId)
        state.media.items = state.media.items.filter((item) => item.id !== mediaId)
      }

      setFlash('Media item removed.')
    } catch (error) {
      setFlash(error.message, 'danger')
    }

    render()
  }

  function handleSettingsSave(formData) {
    state.settings = {
      siteTitle: formData.get('siteTitle')?.trim() || '',
      homepageTagline: formData.get('homepageTagline')?.trim() || '',
      defaultSeoTitle: formData.get('defaultSeoTitle')?.trim() || '',
      defaultSeoDescription: formData.get('defaultSeoDescription')?.trim() || '',
      contactEmail: formData.get('contactEmail')?.trim() || '',
      registrationNotice: formData.get('registrationNotice')?.trim() || '',
    }

    persistPreviewData()
    setFlash('Settings placeholder saved locally.')
    render()
  }

  async function refreshApiBackedData() {
    if (isPreviewMode(state) || !isAuthenticated(state)) {
      return
    }

    try {
      const [pagesResponse, mediaResponse] = await Promise.all([listPages(), listMedia()])
      state.pages.items = pagesResponse.data || []
      state.media.items = mediaResponse.data || []
      state.auth.isOffline = false
    } catch (error) {
      if (isNetworkError(error)) {
        state.auth.isOffline = true
        setFlash('The API became unreachable. You can keep testing with the current loaded data.', 'warning')
      } else if (isUnauthorizedError(error)) {
        state.auth.user = null
        state.auth.status = 'anonymous'
        state.auth.error = 'Your session has expired. Please sign in again.'
      } else {
        setFlash(error.message, 'danger')
      }
    }
  }

  root.addEventListener('submit', async (event) => {
    const form = event.target

    if (!(form instanceof HTMLFormElement)) {
      return
    }

    event.preventDefault()

    if (form.dataset.form === 'login') {
      const formData = new FormData(form)
      const credentials = {
        email: formData.get('email')?.toString().trim() || '',
        password: formData.get('password')?.toString() || '',
      }

      try {
        clearFlash()
        const response = await login(credentials)
        state.auth.user = response.data
        state.auth.status = 'authenticated'
        state.auth.mode = 'api'
        state.auth.error = ''
        state.auth.isOffline = false
        window.localStorage.removeItem(PREVIEW_SESSION_KEY)
        await refreshApiBackedData()
        window.location.hash = '#/dashboard'
      } catch (error) {
        if (isNetworkError(error)) {
          state.auth.error = 'The API is currently unavailable. Use Local Preview Mode to keep working on the frontend.'
          state.auth.isOffline = true
        } else {
          state.auth.error = error.message
        }
      }

      render()
      return
    }

    if (form.dataset.form === 'page-editor') {
      await savePage(new FormData(form), false)
      return
    }

    if (form.dataset.form === 'media-upload') {
      await handleMediaUpload(form.elements.file.files[0])
      form.reset()
      return
    }

    if (form.dataset.form === 'settings') {
      handleSettingsSave(new FormData(form))
    }
  })

  root.addEventListener('input', (event) => {
    const target = event.target

    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return
    }

    if (target.name === 'pageFilter') {
      state.pages.filter = target.value
      render()
      return
    }

    if (target.form?.dataset.form === 'page-editor') {
      const nextDraft = {
        ...getPageDraft(state),
        [target.name]: target.value,
      }

      if (target.name === 'title' && !nextDraft.slug) {
        nextDraft.slug = slugify(target.value)
      }

      state.pages.draft = nextDraft
      updateEditorPreview()
      return
    }

    if (target.dataset.field === 'media-alt') {
      state.media.altDrafts[target.dataset.mediaId] = target.value
    }
  })

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]')

    if (!button) {
      return
    }

    const action = button.dataset.action

    if (action === 'enter-preview') {
      enterPreviewMode()
      render()
      return
    }

    if (action === 'logout') {
      try {
        if (!isPreviewMode(state)) {
          await logout()
        }
      } catch (error) {
        setFlash(error.message, 'danger')
      }

      state.auth.user = null
      state.auth.status = 'anonymous'
      state.auth.mode = 'api'
      state.auth.error = ''
      state.pages.selectedId = null
      state.pages.draft = null
      window.localStorage.removeItem(PREVIEW_SESSION_KEY)
      window.location.hash = '#/login'
      render()
      return
    }

    if (action === 'new-page') {
      state.pages.selectedId = null
      syncPageDraft(null)
      clearFlash()
      render()
      return
    }

    if (action === 'select-page') {
      state.pages.selectedId = button.dataset.pageId
      syncPageDraft(getSelectedPage(state))
      clearFlash()
      render()
      return
    }

    if (action === 'reset-page-form') {
      syncPageDraft(getSelectedPage(state))
      clearFlash()
      render()
      return
    }

    if (action === 'save-and-publish') {
      const form = root.querySelector('[data-form="page-editor"]')
      await savePage(new FormData(form), true)
      return
    }

    if (action === 'toggle-publish') {
      await togglePublishSelectedPage()
      return
    }

    if (action === 'duplicate-preview-link') {
      const page = getSelectedPage(state)
      if (page) {
        const url = `${window.location.origin}/#/preview/${page.slug}`
        await navigator.clipboard?.writeText(url).catch(() => {})
        setFlash('Preview link copied to clipboard.')
        render()
      }
      return
    }

    if (action === 'save-media-alt') {
      await saveMediaAlt(button.dataset.mediaId)
      return
    }

    if (action === 'delete-media') {
      await removeMedia(button.dataset.mediaId)
    }
  })

  window.addEventListener('hashchange', () => {
    state.route = getRoute()

    if (!isAuthenticated(state)) {
      window.location.hash = '#/login'
      state.route = 'dashboard'
    }

    render()
  })

  window.addEventListener('odp:api-error', (event) => {
    if (event.detail?.error && !isUnauthorizedError(event.detail.error)) {
      setFlash(event.detail.message, 'danger')
      render()
    }
  })

  render()
  bootstrapAuth().then(async () => {
    if (isAuthenticated(state) && !isPreviewMode(state)) {
      await refreshApiBackedData()
      render()
    }
  })
}
