import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { apiRequest } from './js/api'

window.$ = $
window.jQuery = $

$('#footer-year').text(new Date().getFullYear())

function escHtml(str) {
  return $('<div>').text(String(str ?? '')).html()
}

const slug = new URLSearchParams(window.location.search).get('slug')
const contentEl = document.getElementById('team-content')

if (!slug) {
  contentEl.innerHTML = `
    <div class="container px-5 py-5 text-center text-muted">
      <i class="bi bi-exclamation-circle fs-1 mb-3 d-block text-secondary"></i>
      <p class="fw-bold mb-2">No team specified.</p>
      <a href="/teams.html" class="btn btn-outline-primary btn-sm">Browse all teams</a>
    </div>`
} else {
  apiRequest(`/teams/${encodeURIComponent(slug)}`)
    .then(function (res) {
      const t = res?.data
      if (!t) throw new Error('empty')
      document.title = `${t.name} | One Doce Pares`
      contentEl.innerHTML = `
        <header class="bg-dark py-4">
          <div class="container px-5">
            <div class="d-flex align-items-center gap-3">
              ${t.logo_url ? `<img src="${escHtml(t.logo_url)}" alt="${escHtml(t.name)} logo" style="height:64px;object-fit:contain">` : ''}
              <div>
                <h1 class="display-6 fw-bolder text-white mb-1">${escHtml(t.name)}</h1>
                ${t.city || t.country ? `<p class="text-white-50 mb-0 small"><i class="bi bi-geo-alt-fill me-1"></i>${escHtml([t.city, t.country].filter(Boolean).join(', '))}</p>` : ''}
              </div>
            </div>
          </div>
        </header>
        <section class="py-5">
          <div class="container px-5">
            <div class="row g-4">
              <div class="col-lg-8">
                ${t.description ? `
                  <div class="card shadow-sm mb-4">
                    <div class="card-body p-4">
                      <h2 class="h5 fw-bolder mb-3">About</h2>
                      <p class="mb-0">${escHtml(t.description)}</p>
                    </div>
                  </div>` : ''}
              </div>
              <div class="col-lg-4">
                <div class="card shadow-sm mb-4">
                  <div class="card-body p-4">
                    <h2 class="h5 fw-bolder mb-3">Details</h2>
                    <dl class="row mb-0 small">
                      ${t.founded_year ? `<dt class="col-5 text-muted">Founded</dt><dd class="col-7">${t.founded_year}</dd>` : ''}
                      ${t.website ? `<dt class="col-5 text-muted">Website</dt><dd class="col-7"><a href="${escHtml(t.website)}" target="_blank" rel="noopener">${escHtml(t.website)}</a></dd>` : ''}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <a href="/teams.html" class="btn btn-outline-secondary btn-sm">
              <i class="bi bi-arrow-left me-1"></i> All teams
            </a>
          </div>
        </section>`
    })
    .fail(function () {
      contentEl.innerHTML = `
        <div class="container px-5 py-5 text-center text-muted">
          <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block text-secondary"></i>
          <p class="fw-bold mb-2">Team not found.</p>
          <a href="/teams.html" class="btn btn-outline-primary btn-sm">Browse all teams</a>
        </div>`
    })
}
