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

const STATUS_BADGES = {
  upcoming:  'bg-primary',
  active:    'bg-success',
  completed: 'bg-secondary',
  cancelled: 'bg-danger',
}

let allTournaments = []
let activeFilter = 'all'

function renderTournaments() {
  const filtered = activeFilter === 'all'
    ? allTournaments
    : allTournaments.filter(t => t.status === activeFilter)
  const grid = document.getElementById('tournaments-grid')
  if (!grid) return

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="bi bi-trophy fs-1 mb-3 d-block text-secondary"></i>
        <p class="fw-bold mb-0">No tournaments found.</p>
      </div>`
    return
  }

  grid.innerHTML = filtered.map(t => {
    const badgeCls = STATUS_BADGES[t.status] || 'bg-secondary'
    return `
      <div class="col-sm-6 col-lg-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body p-4">
            <span class="badge ${badgeCls} mb-2">${escHtml(t.status)}</span>
            <h5 class="card-title fw-bolder mb-2">${escHtml(t.name)}</h5>
            ${t.start_date ? `<p class="text-muted small mb-1"><i class="bi bi-calendar3 me-1"></i>${escHtml(t.start_date)}${t.end_date && t.end_date !== t.start_date ? ` – ${escHtml(t.end_date)}` : ''}</p>` : ''}
            ${t.location ? `<p class="text-muted small mb-2"><i class="bi bi-geo-alt-fill me-1"></i>${escHtml(t.location)}</p>` : ''}
            ${t.description ? `<p class="card-text small text-muted mb-3">${escHtml(t.description)}</p>` : ''}
          </div>
          <div class="card-footer bg-transparent border-top-0 pt-0 pb-3 px-4">
            <a class="btn btn-outline-primary btn-sm" href="/tournament.html?slug=${encodeURIComponent(t.slug)}">View details</a>
          </div>
        </div>
      </div>`
  }).join('')
}

apiRequest('/tournaments?per_page=100')
  .then(function (res) {
    allTournaments = res?.data || []
    renderTournaments()
  })
  .fail(function () {
    const grid = document.getElementById('tournaments-grid')
    if (grid) grid.innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block"></i>
        <p class="mb-0">Failed to load tournaments. Please try again later.</p>
      </div>`
  })

$(document).on('click', '#tournaments-filter button', function () {
  $('#tournaments-filter button').removeClass('active btn-dark').addClass('btn-outline-secondary')
  $(this).removeClass('btn-outline-secondary').addClass('active btn-dark')
  activeFilter = $(this).data('filter')
  renderTournaments()
})
