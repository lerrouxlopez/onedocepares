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

let allTeams = []
let activeFilter = 'all'

function renderTeams() {
  const filtered = activeFilter === 'all'
    ? allTeams
    : activeFilter === 'active'
      ? allTeams.filter(t => t.is_active)
      : allTeams.filter(t => !t.is_active)

  const grid = document.getElementById('teams-grid')
  if (!grid) return

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="bi bi-people fs-1 mb-3 d-block text-secondary"></i>
        <p class="fw-bold mb-1">No teams found</p>
        <p class="small mb-0">Try a different filter.</p>
      </div>`
    return
  }

  grid.innerHTML = filtered.map(t => `
    <div class="col-sm-6 col-lg-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body p-4">
          ${t.logo_url ? `<img src="${escHtml(t.logo_url)}" alt="${escHtml(t.name)} logo" class="mb-3 rounded" style="height:48px;object-fit:contain">` : ''}
          <h5 class="card-title fw-bolder mb-1">${escHtml(t.name)}</h5>
          ${t.city || t.country ? `<p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill me-1"></i>${escHtml([t.city, t.country].filter(Boolean).join(', '))}</p>` : ''}
          ${t.founded_year ? `<p class="text-muted small mb-2"><i class="bi bi-calendar3 me-1"></i>Est. ${t.founded_year}</p>` : ''}
          ${t.description ? `<p class="card-text small text-muted mb-3">${escHtml(t.description)}</p>` : ''}
        </div>
        <div class="card-footer bg-transparent border-top-0 pt-0 pb-3 px-4">
          <a class="btn btn-outline-primary btn-sm" href="/team.html?slug=${encodeURIComponent(t.slug)}">View team</a>
        </div>
      </div>
    </div>`).join('')
}

apiRequest('/teams?per_page=100')
  .then(function (res) {
    allTeams = res?.data || []
    renderTeams()
  })
  .fail(function () {
    const grid = document.getElementById('teams-grid')
    if (grid) grid.innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
        <p class="mb-0">Failed to load teams. Please try again later.</p>
      </div>`
  })
