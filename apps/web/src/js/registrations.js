import $ from 'jquery'
import { Toast } from 'bootstrap'
import { apiRequest } from './api'

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer')
  if (!container) return
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
  new Toast(el, { delay: 3500 }).show()
  el.addEventListener('hidden.bs.toast', () => el.remove())
}

export function unmountRegistrations() {
  $(document).off('.registrations')
}

const STATUS_BADGES = {
  pending:    'bg-warning text-dark',
  approved:   'bg-success',
  rejected:   'bg-danger',
  checked_in: 'bg-info',
  completed:  'bg-primary',
  cancelled:  'bg-secondary',
}

function statusBadge(status) {
  const cls = STATUS_BADGES[status] || 'bg-secondary'
  return `<span class="badge ${cls}">${escHtml(status.replace('_', ' '))}</span>`
}

function nextActions(status) {
  const map = {
    pending:    [{ label: 'Approve', next: 'approved', cls: 'btn-success' }, { label: 'Reject', next: 'rejected', cls: 'btn-danger' }, { label: 'Cancel', next: 'cancelled', cls: 'btn-outline-secondary' }],
    approved:   [{ label: 'Check In', next: 'checked_in', cls: 'btn-info' }, { label: 'Cancel', next: 'cancelled', cls: 'btn-outline-secondary' }],
    checked_in: [{ label: 'Complete', next: 'completed', cls: 'btn-primary' }, { label: 'Cancel', next: 'cancelled', cls: 'btn-outline-secondary' }],
    rejected:   [],
    completed:  [],
    cancelled:  [],
  }
  return map[status] || []
}

export function renderRegistrationsList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Registrations</h1>
    </div>

    <div class="mb-3 d-flex align-items-center gap-3 flex-wrap">
      <div class="btn-group btn-group-sm" id="regsFilter" role="group" aria-label="Filter by status">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="pending">Pending</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="approved">Approved</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="checked_in">Checked In</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="completed">Completed</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="rejected">Rejected</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="cancelled">Cancelled</button>
      </div>
      <small class="text-muted" id="regsCount"></small>
    </div>

    <div class="card shadow mb-4">
      <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">All Registrations</h6></div>
      <div class="card-body p-0" id="regsTableWrap">
        <div class="text-center py-5 text-gray-600" id="regsLoading">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
          Loading registrations…
        </div>
        <div class="text-center py-5 text-gray-600 d-none" id="regsEmpty">
          <i class="bi bi-clipboard-x display-4 d-block mb-3 text-gray-300"></i>
          <p class="fw-bold mb-0">No registrations found.</p>
        </div>
        <div class="table-responsive d-none" id="regsTableContainer">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Tournament</th>
                <th>Team</th>
                <th>Status</th>
                <th>Registered</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="regsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function buildRegRow(reg) {
  const actions = nextActions(reg.status)
  const btns = actions.map(a =>
    `<button class="btn btn-sm ${a.cls} btn-reg-action ms-1"
             data-id="${reg.id}" data-next="${a.next}" data-name="${escHtml(reg.team_name)}" data-tournament="${escHtml(reg.tournament_name)}">
       ${escHtml(a.label)}
     </button>`
  ).join('')
  return `
    <tr>
      <td class="fw-medium">${escHtml(reg.tournament_name)}</td>
      <td>${escHtml(reg.team_name)}</td>
      <td>${statusBadge(reg.status)}</td>
      <td class="text-muted small">${fmtDate(reg.created_at)}</td>
      <td class="text-end">${btns || '<span class="text-muted small">—</span>'}</td>
    </tr>`
}

export function mountRegistrationsList() {
  let allRegs = []
  let activeFilter = 'all'

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allRegs
      : allRegs.filter(r => r.status === activeFilter)
    const tbody = document.getElementById('regsTableBody')
    if (!tbody) return
    const countEl = document.getElementById('regsCount')
    if (countEl) countEl.textContent = `${filtered.length} registration${filtered.length !== 1 ? 's' : ''}`
    if (filtered.length === 0) {
      $('#regsTableContainer').addClass('d-none')
      $('#regsEmpty').removeClass('d-none')
    } else {
      $('#regsEmpty').addClass('d-none')
      $('#regsTableContainer').removeClass('d-none')
      tbody.innerHTML = filtered.map(buildRegRow).join('')
    }
  }

  apiRequest('/admin/registrations')
    .then(function (res) {
      allRegs = res?.data || []
      $('#regsLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#regsLoading').addClass('d-none')
      document.getElementById('regsTableWrap').innerHTML = `
        <div class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Failed to load registrations.</p>
        </div>`
    })

  $(document).on('click.registrations', '#regsFilter button', function () {
    $('#regsFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  $(document).on('click.registrations', '.btn-reg-action', function () {
    const id = $(this).data('id')
    const next = $(this).data('next')
    const teamName = $(this).data('name')
    const tournamentName = $(this).data('tournament')
    const label = $(this).text().trim()

    if (!confirm(`${label} "${teamName}" for "${tournamentName}"?`)) return
    const $btn = $(this).prop('disabled', true)

    apiRequest(`/admin/registrations/${id}`, { method: 'PATCH', data: { status: next } })
      .then(function (res) {
        const updated = res?.data
        if (!updated) return
        const idx = allRegs.findIndex(r => r.id === id)
        if (idx !== -1) allRegs[idx] = updated
        applyFilter()
        showToast(`Registration ${next.replace('_', ' ')}.`)
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Failed to update status.', 'error')
        $btn.prop('disabled', false)
      })
  })
}
