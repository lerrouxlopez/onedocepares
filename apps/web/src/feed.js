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
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const EVENT_ICONS = {
  registration_submitted: 'bi-send text-secondary',
  registration_approved:  'bi-check-circle-fill text-success',
  registration_rejected:  'bi-x-circle-fill text-danger',
  leaderboard_rebuilt:    'bi-bar-chart-fill text-primary',
}

function eventIcon(type) {
  const cls = EVENT_ICONS[type] || 'bi-bell text-muted'
  return `<i class="bi ${cls} fs-4"></i>`
}

function renderFeedCard(item) {
  return `
    <div class="card shadow-sm mb-3">
      <div class="card-body d-flex align-items-start gap-3">
        <div class="mt-1">${eventIcon(item.event_type)}</div>
        <div class="flex-grow-1">
          <p class="mb-1 fw-semibold">${escHtml(item.title)}</p>
          ${item.body ? `<p class="mb-1 small text-muted">${escHtml(item.body)}</p>` : ''}
          <div class="d-flex gap-3 small text-muted mt-1">
            <span><i class="bi bi-clock me-1"></i>${fmtDate(item.created_at)}</span>
            ${item.entity_slug ? `<span><i class="bi bi-link-45deg me-1"></i><a href="/tournament.html?slug=${encodeURIComponent(item.entity_slug)}" class="text-decoration-none">${escHtml(item.entity_slug)}</a></span>` : ''}
            ${item.actor_slug ? `<span><i class="bi bi-person me-1"></i><a href="/team.html?slug=${encodeURIComponent(item.actor_slug)}" class="text-decoration-none">${escHtml(item.actor_slug)}</a></span>` : ''}
          </div>
        </div>
        <span class="badge bg-light text-dark border small">${escHtml(item.event_type.replace(/_/g, ' '))}</span>
      </div>
    </div>`
}

const PER_PAGE = 20
let currentPage = 1
let totalPages = 1

function loadFeed(page, append = false) {
  if (!append) {
    document.getElementById('feed-list').innerHTML = `
      <div class="text-center py-5 text-muted">
        <div class="spinner-border text-primary mb-3" role="status"></div>
        <p class="mb-0">Loading activity…</p>
      </div>`
  } else {
    $('#loadMoreSpinner').removeClass('d-none')
    $('#btnLoadMore').prop('disabled', true)
  }

  apiRequest(`/feed?page=${page}&per_page=${PER_PAGE}`)
    .then(function (res) {
      const items = res?.data || []
      const pagination = res?.pagination
      if (pagination) {
        totalPages = pagination.total_pages || 1
        currentPage = pagination.page || 1
      }

      const listEl = document.getElementById('feed-list')
      if (!append) {
        if (items.length === 0) {
          listEl.innerHTML = `
            <div class="text-center py-5 text-muted">
              <i class="bi bi-broadcast display-4 d-block mb-3 text-secondary"></i>
              <p class="fw-bold mb-0">No activity yet.</p>
              <p class="small">Events will appear here as teams register and tournaments progress.</p>
            </div>`
          return
        }
        listEl.innerHTML = items.map(renderFeedCard).join('')
      } else {
        listEl.insertAdjacentHTML('beforeend', items.map(renderFeedCard).join(''))
      }

      if (currentPage < totalPages) {
        $('#feed-load-more').removeClass('d-none')
      } else {
        $('#feed-load-more').addClass('d-none')
      }
    })
    .fail(function () {
      if (!append) {
        document.getElementById('feed-list').innerHTML = `
          <div class="text-center py-5 text-danger">
            <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
            <p class="mb-0">Failed to load feed.</p>
          </div>`
      }
    })
    .always(function () {
      $('#loadMoreSpinner').addClass('d-none')
      $('#btnLoadMore').prop('disabled', false)
    })
}

$('#btnLoadMore').on('click', function () {
  loadFeed(currentPage + 1, true)
})

loadFeed(1)
