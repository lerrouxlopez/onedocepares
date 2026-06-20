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

const BELT_COLORS = {
  white: '#f8f9fa', yellow: '#ffc107', orange: '#fd7e14',
  green: '#198754', blue: '#0d6efd', purple: '#6f42c1',
  brown: '#6c757d', red: '#dc3545', black: '#212529',
}

function beltDot(rank) {
  if (!rank) return ''
  const color = BELT_COLORS[rank.toLowerCase()] || '#6c757d'
  return `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,.2);vertical-align:middle;margin-right:4px"></span>${escHtml(rank)}`
}

apiRequest('/players?per_page=100')
  .then(function (res) {
    const players = res?.data || []
    const grid = document.getElementById('players-grid')
    if (!grid) return

    if (players.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
          <i class="bi bi-person-badge fs-1 mb-3 d-block text-secondary"></i>
          <p class="fw-bold mb-0">No players yet.</p>
        </div>`
      return
    }

    grid.innerHTML = players.map(p => `
      <div class="col-sm-6 col-lg-4 col-xl-3">
        <div class="card h-100 shadow-sm">
          ${p.photo_url ? `<img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" class="card-img-top" style="height:200px;object-fit:cover">` : ''}
          <div class="card-body p-4">
            <h5 class="card-title fw-bolder mb-1">${escHtml(p.name)}</h5>
            ${p.nationality ? `<p class="text-muted small mb-1"><i class="bi bi-flag me-1"></i>${escHtml(p.nationality)}</p>` : ''}
            ${p.belt_rank ? `<p class="small mb-1">${beltDot(p.belt_rank)}</p>` : ''}
            ${p.weight_class ? `<p class="text-muted small mb-0">${escHtml(p.weight_class)}</p>` : ''}
          </div>
          <div class="card-footer bg-transparent border-top-0 pt-0 pb-3 px-4">
            <a class="btn btn-outline-primary btn-sm" href="/player.html?slug=${encodeURIComponent(p.slug)}">View profile</a>
          </div>
        </div>
      </div>`).join('')
  })
  .fail(function () {
    const grid = document.getElementById('players-grid')
    if (grid) grid.innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
        <p class="mb-0">Failed to load players. Please try again later.</p>
      </div>`
  })
