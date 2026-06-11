import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import { getHealth, getPublicPage, ApiError } from './js/api'

window.$ = $
window.jQuery = $

const app = document.querySelector('#app')

// Support both clean URLs (/my-slug) and hash URLs (/#/my-slug).
function getSlugFromUrl() {
  const path = window.location.pathname
  if (path !== '/' && path !== '') {
    return path.replace(/^\/+/, '').replace(/\/+$/, '')
  }
  const hash = window.location.hash
  if (hash.startsWith('#/') && hash.length > 2) {
    return hash.slice(2).replace(/\/+$/, '')
  }
  return null
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(String(str)))
  return div.innerHTML
}

function renderHome() {
  app.innerHTML = `
    <main class="container py-4 py-lg-5">
      <section class="shell-hero">
        <div class="row align-items-center g-4">
          <div class="col-lg-7">
            <span class="badge text-bg-dark rounded-pill px-3 py-2 mb-3">Phase 0 foundation</span>
            <h1 class="display-4 fw-bold mb-3">One Doce Pares platform scaffold</h1>
            <p class="lead text-secondary mb-4">
              Bootstrap and jQuery power the web shell while Axum, PostgreSQL, and Docker
              anchor the backend stack for CMS, tournaments, and leaderboard workflows.
            </p>
            <div class="d-flex flex-wrap gap-2">
              <span class="status-pill">
                <span class="status-dot"></span>
                <span id="api-status-label">Checking API health...</span>
              </span>
              <a class="btn btn-primary btn-lg" href="/admin/">Admin shell</a>
              <a class="btn btn-outline-dark btn-lg" href="/api/v1/health">Health endpoint</a>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="shell-card rounded-4 p-4">
              <h2 class="h4 mb-3">Scaffolded workstreams</h2>
              <div class="d-grid gap-3">
                <div>
                  <div class="fw-semibold">Frontend shell</div>
                  <div class="text-secondary">Vite, Bootstrap 5, jQuery, SCSS, API helper.</div>
                </div>
                <div>
                  <div class="fw-semibold">Rust API</div>
                  <div class="text-secondary">Axum router, tracing, health route, shared app state.</div>
                </div>
                <div>
                  <div class="fw-semibold">Ops baseline</div>
                  <div class="text-secondary">Docker Compose, CI workflow, env templates, Caddy starter.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  `

  getHealth()
    .then(health => {
      const label = document.querySelector('#api-status-label')
      if (label) label.textContent = `${health.status} | ${health.service} ${health.version}`
    })
    .catch(() => {
      const label = document.querySelector('#api-status-label')
      if (label) label.textContent = 'API unavailable'
    })
}

async function renderCmsPage(slug) {
  app.innerHTML = `
    <main class="container py-5">
      <div class="text-secondary">Loading…</div>
    </main>
  `

  try {
    const response = await getPublicPage(slug)
    const page = response.data

    document.title = page.seo_title || `${page.title} — One Doce Pares`
    if (page.seo_description) {
      let meta = document.querySelector('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = page.seo_description
    }

    app.innerHTML = `
      <main class="container py-4 py-lg-5">
        <nav aria-label="breadcrumb" class="mb-4">
          <a href="/" class="text-decoration-none text-secondary">← Home</a>
        </nav>
        <article class="cms-page">
          <h1 class="mb-4">${escapeHtml(page.title)}</h1>
          <div class="cms-content">${page.body}</div>
        </article>
      </main>
    `
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      document.title = 'Page not found — One Doce Pares'
      app.innerHTML = `
        <main class="container py-5 text-center">
          <h1 class="mb-3">Page not found</h1>
          <p class="text-secondary mb-4">This page does not exist or has not been published.</p>
          <a href="/" class="btn btn-primary">Go home</a>
        </main>
      `
    } else {
      app.innerHTML = `
        <main class="container py-5">
          <div class="alert alert-danger">Failed to load page. Please try again later.</div>
          <a href="/" class="btn btn-outline-secondary mt-2">Go home</a>
        </main>
      `
    }
  }
}

const slug = getSlugFromUrl()
if (slug) {
  renderCmsPage(slug)
} else {
  renderHome()
}
