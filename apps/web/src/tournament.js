import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { apiRequest } from './js/api'
import { fetchCsrfToken, getMe } from './js/auth'
import { Toast } from 'bootstrap'

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

function googleCalendarUrl(t) {
  const fmt = d => d ? d.replace(/-/g, '') : null
  const start = fmt(t.start_date)
  const end = t.end_date
    ? new Date(new Date(t.end_date).getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '')
    : start
  if (!start) return null
  const params = new URLSearchParams({
    text: t.name,
    dates: `${start}/${end}`,
    details: t.description || '',
    location: t.location || '',
  })
  return `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toastContainer'
    container.className = 'position-fixed bottom-0 end-0 p-3'
    container.style.zIndex = '1100'
    document.body.appendChild(container)
  }
  const id = `toast-${Date.now()}`
  const bg = type === 'error' ? 'bg-danger' : 'bg-success'
  container.insertAdjacentHTML('beforeend',
    `<div id="${id}" class="toast align-items-center text-white ${bg} border-0"
          role="alert" aria-live="assertive" aria-atomic="true">
       <div class="d-flex">
         <div class="toast-body">${escHtml(message)}</div>
         <button type="button" class="btn-close btn-close-white me-2 m-auto"
                 data-bs-dismiss="toast" aria-label="Close"></button>
       </div>
     </div>`)
  const el = document.getElementById(id)
  new Toast(el, { delay: 4000 }).show()
  el.addEventListener('hidden.bs.toast', () => el.remove())
}

const STATUS_BADGES = {
  upcoming:  'bg-primary',
  active:    'bg-success',
  completed: 'bg-secondary',
  cancelled: 'bg-danger',
}

const slug = new URLSearchParams(window.location.search).get('slug')
const contentEl = document.getElementById('tournament-content')

if (!slug) {
  contentEl.innerHTML = `
    <div class="container px-5 py-5 text-center text-muted">
      <i class="bi bi-exclamation-circle fs-1 mb-3 d-block text-secondary"></i>
      <p class="fw-bold mb-2">No tournament specified.</p>
      <a href="/tournaments.html" class="btn btn-outline-primary btn-sm">Browse all tournaments</a>
    </div>`
} else {
  apiRequest(`/tournaments/${encodeURIComponent(slug)}`)
    .then(function (res) {
      const t = res?.data
      if (!t) throw new Error('empty')
      document.title = `${t.name} | One Doce Pares`
      const badgeCls = STATUS_BADGES[t.status] || 'bg-secondary'
      const regOpen = t.registration_open_at ? fmtDate(t.registration_open_at) : null
      const regClose = t.registration_close_at ? fmtDate(t.registration_close_at) : null

      const now = new Date()
      const winOpen = t.registration_open_at ? new Date(t.registration_open_at) : null
      const winClose = t.registration_close_at ? new Date(t.registration_close_at) : null
      const regWindowOpen = (!winOpen || now >= winOpen) && (!winClose || now <= winClose)
      const canRegister = t.status !== 'cancelled' && t.status !== 'completed' && regWindowOpen

      contentEl.innerHTML = `
        <header class="bg-dark py-4">
          <div class="container px-5">
            <span class="badge ${badgeCls} mb-2">${escHtml(t.status)}</span>
            <h1 class="display-6 fw-bolder text-white mb-1">${escHtml(t.name)}</h1>
            ${t.location ? `<p class="text-white-50 mb-0 small"><i class="bi bi-geo-alt-fill me-1"></i>${escHtml(t.location)}</p>` : ''}
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
                <div id="registration-section"></div>
              </div>
              <div class="col-lg-4">
                <div class="card shadow-sm mb-4">
                  <div class="card-body p-4">
                    <h2 class="h5 fw-bolder mb-3">Details</h2>
                    <dl class="row mb-0 small">
                      ${t.start_date ? `<dt class="col-5 text-muted">Start</dt><dd class="col-7">${escHtml(t.start_date)}</dd>` : ''}
                      ${t.end_date ? `<dt class="col-5 text-muted">End</dt><dd class="col-7">${escHtml(t.end_date)}</dd>` : ''}
                      ${regOpen ? `<dt class="col-5 text-muted">Reg. opens</dt><dd class="col-7">${escHtml(regOpen)}</dd>` : ''}
                      ${regClose ? `<dt class="col-5 text-muted">Reg. closes</dt><dd class="col-7">${escHtml(regClose)}</dd>` : ''}
                      ${t.max_teams ? `<dt class="col-5 text-muted">Max teams</dt><dd class="col-7">${t.max_teams}</dd>` : ''}
                    </dl>
                    ${t.start_date ? `
                    <hr class="my-3">
                    <p class="small fw-semibold text-muted mb-2">Add to calendar</p>
                    <div class="d-grid gap-2">
                      <a href="/api/v1/tournaments/${encodeURIComponent(t.slug)}/calendar.ics"
                         class="btn btn-outline-secondary btn-sm" download>
                        <i class="bi bi-calendar-event me-1"></i> Download .ics
                      </a>
                      ${googleCalendarUrl(t) ? `
                      <a href="${googleCalendarUrl(t)}" target="_blank" rel="noopener noreferrer"
                         class="btn btn-outline-danger btn-sm">
                        <i class="bi bi-google me-1"></i> Add to Google Calendar
                      </a>` : ''}
                    </div>` : ''}
                  </div>
                </div>
              </div>
            </div>
            <a href="/tournaments.html" class="btn btn-outline-secondary btn-sm">
              <i class="bi bi-arrow-left me-1"></i> All tournaments
            </a>
          </div>
        </section>`

      if (canRegister) {
        mountRegistrationSection(t)
      } else if (t.status !== 'cancelled' && t.status !== 'completed') {
        document.getElementById('registration-section').innerHTML = `
          <div class="alert alert-info small">
            <i class="bi bi-info-circle me-1"></i>
            ${winOpen && now < winOpen
              ? `Registration opens ${regOpen || 'soon'}.`
              : `Registration is closed.`}
          </div>`
      }
    })
    .fail(function () {
      contentEl.innerHTML = `
        <div class="container px-5 py-5 text-center text-muted">
          <i class="bi bi-exclamation-triangle fs-1 mb-3 d-block text-secondary"></i>
          <p class="fw-bold mb-2">Tournament not found.</p>
          <a href="/tournaments.html" class="btn btn-outline-primary btn-sm">Browse all tournaments</a>
        </div>`
    })
}

function mountRegistrationSection(tournament) {
  const section = document.getElementById('registration-section')
  if (!section) return

  // Check if user is logged in
  getMe()
    .then(function () {
      // Logged in — fetch CSRF + teams
      return fetchCsrfToken()
        .then(function () {
          return apiRequest('/teams?per_page=100')
        })
        .then(function (res) {
          const teams = res?.data || []
          if (teams.length === 0) {
            section.innerHTML = `
              <div class="card shadow-sm mb-4">
                <div class="card-body p-4 text-muted">
                  <p class="mb-0 small">No active teams available to register.</p>
                </div>
              </div>`
            return
          }
          const options = teams.map(t =>
            `<option value="${t.id}">${escHtml(t.name)}</option>`
          ).join('')
          section.innerHTML = `
            <div class="card shadow-sm mb-4">
              <div class="card-header py-3"><h2 class="h6 m-0 fw-bold text-primary">Register Your Team</h2></div>
              <div class="card-body p-4">
                <form id="regForm" novalidate>
                  <div class="mb-3">
                    <label for="regTeam" class="form-label fw-semibold">Team <span class="text-danger" aria-hidden="true">*</span></label>
                    <select class="form-select" id="regTeam" required>
                      <option value="">— Select your team —</option>
                      ${options}
                    </select>
                    <div class="invalid-feedback">Please select a team.</div>
                  </div>
                  <div class="mb-3">
                    <label for="regNotes" class="form-label fw-semibold">Notes <span class="text-muted small">(optional)</span></label>
                    <textarea class="form-control" id="regNotes" rows="2" placeholder="Any additional information…"></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary" id="btnRegSubmit">
                    <span class="spinner-border spinner-border-sm me-1 d-none" id="regSpinner" role="status"></span>
                    <i class="bi bi-send me-1"></i> Submit Registration
                  </button>
                </form>
              </div>
            </div>`

          $('#regForm').on('submit', function (e) {
            e.preventDefault()
            if (!this.checkValidity()) { this.classList.add('was-validated'); return }

            const teamId = $('#regTeam').val()
            const notes = $('#regNotes').val().trim() || null

            $('#regSpinner').removeClass('d-none')
            $('#btnRegSubmit').prop('disabled', true)

            apiRequest(`/tournaments/${encodeURIComponent(tournament.slug)}/register-team`, {
              method: 'POST',
              data: { team_id: teamId, notes },
            })
              .then(function () {
                section.innerHTML = `
                  <div class="alert alert-success">
                    <i class="bi bi-check-circle-fill me-2"></i>
                    Registration submitted! You will be notified once it is reviewed.
                  </div>`
                showToast('Registration submitted successfully.')
              })
              .fail(function (xhr) {
                const msg = xhr?.responseJSON?.error?.message || 'Registration failed.'
                showToast(msg, 'error')
                $('#regSpinner').addClass('d-none')
                $('#btnRegSubmit').prop('disabled', false)
              })
          })
        })
    })
    .fail(function () {
      // Not authenticated — show login prompt
      section.innerHTML = `
        <div class="card shadow-sm mb-4">
          <div class="card-body p-4 text-center">
            <i class="bi bi-person-lock fs-1 mb-2 d-block text-secondary"></i>
            <p class="fw-bold mb-1">Want to register your team?</p>
            <p class="small text-muted mb-3">You must be logged in to submit a registration.</p>
            <a href="/login.html?next=${encodeURIComponent(window.location.href)}" class="btn btn-primary btn-sm">
              <i class="bi bi-box-arrow-in-right me-1"></i> Log in to register
            </a>
          </div>
        </div>`
    })
}
