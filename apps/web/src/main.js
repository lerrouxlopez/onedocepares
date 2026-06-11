import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import { getHealth } from './js/api'

window.$ = $
window.jQuery = $

const app = document.querySelector('#app')

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
            <span class="status-pill"><span class="status-dot"></span><span id="api-status-label">Checking API health...</span></span>
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

async function renderHealth() {
  const label = document.querySelector('#api-status-label')

  try {
    const health = await getHealth()
    label.textContent = `${health.status} | ${health.service} ${health.version}`
  } catch (error) {
    label.textContent = 'API unavailable'
    console.error(error)
  }
}

renderHealth()
