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

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const slug = new URLSearchParams(window.location.search).get('slug')
const contentEl = document.getElementById('player-content')

if (!slug) {
  contentEl.innerHTML = `
    <div class="container px-5 py-5 text-center text-muted">
      <i class="bi bi-exclamation-circle fs-1 mb-3 d-block text-secondary"></i>
      <p class="fw-bold mb-2">No player specified.</p>
      <a href="/players.html" class="btn btn-outline-primary btn-sm">Browse all players</a>
    </div>`
} else {
  apiRequest(`/players/${encodeURIComponent(slug)}`)
    .then(function (res) {
      const p = res?.data
      if (!p) throw new Error('empty')
      document.title = `${p.name} | One Doce Pares`
      contentEl.innerHTML = `
        <header class="bg-dark py-4">
          <div class="container px-5">
            <div class="d-flex align-items-center gap-4">
              ${p.photo_url ? `<img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" class="rounded-circle" style="width:80px;height:80px;object-fit:cover">` : ''}
              <div>
                <h1 class="display-6 fw-bolder text-white mb-1">${escHtml(p.name)}</h1>
                ${p.nationality ? `<p class="text-white-50 mb-0 small"><i class="bi bi-flag me-1"></i>${escHtml(p.nationality)}</p>` : ''}
              </div>
            </div>
          </div>
        </header>
        <section class="py-5">
          <div class="container px-5">
            <div class="row g-4">
              <div class="col-lg-8">
                ${p.bio ? `
                  <div class="card shadow-sm mb-4">
                    <div class="card-body p-4">
                      <h2 class="h5 fw-bolder mb-3">Bio</h2>
                      <p class="mb-0">${escHtml(p.bio)}</p>
                    </div>
                  </div>` : ''}
              </div>
              <div class="col-lg-4">
                <div class="card shadow-sm mb-4">
                  <div class="card-body p-4">
                    <h2 class="h5 fw-bolder mb-3">Details</h2>
                    <dl class="row mb-0 small">
                      ${p.belt_rank ? `<dt class="col-5 text-muted">Belt rank</dt><dd class="col-7">${escHtml(p.belt_rank)}</dd>` : ''}
                      ${p.weight_class ? `<dt class="col-5 text-muted">Weight</dt><dd class="col-7">${escHtml(p.weight_class)}</dd>` : ''}
                      ${p.date_of_birth ? `<dt class="col-5 text-muted">Born</dt><dd class="col-7">${escHtml(fmtDate(p.date_of_birth))}</dd>` : ''}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <a href="/players.html" class="btn btn-outline-secondary btn-sm">
              <i class="bi bi-arrow-left me-1"></i> All players
            </a>
          </div>
        </section>`
    })
    .fail(function () {
      contentEl.innerHTML = `
        <div class="container px-5 py-5 text-center text-muted">
          <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block text-secondary"></i>
          <p class="fw-bold mb-2">Player not found.</p>
          <a href="/players.html" class="btn btn-outline-primary btn-sm">Browse all players</a>
        </div>`
    })
}
