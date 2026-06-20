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

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '')
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

export function unmountTournaments() {
  $(document).off('.tournaments')
}

const STATUS_BADGES = {
  upcoming:  'bg-primary',
  active:    'bg-success',
  completed: 'bg-secondary',
  cancelled: 'bg-danger',
}

function statusBadge(status) {
  const cls = STATUS_BADGES[status] || 'bg-secondary'
  return `<span class="badge ${cls}">${escHtml(status)}</span>`
}

// ─── Tournaments List ─────────────────────────────────────────────────────────

export function renderTournamentsList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Tournaments</h1>
      <a href="/admin/tournaments/new" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-plus-lg me-1"></i> New Tournament
      </a>
    </div>

    <div class="mb-3 d-flex align-items-center gap-3">
      <div class="btn-group btn-group-sm" id="tournamentsFilter" role="group" aria-label="Filter by status">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="upcoming">Upcoming</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="active">Active</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="completed">Completed</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="cancelled">Cancelled</button>
      </div>
      <small class="text-muted" id="tournamentsCount"></small>
    </div>

    <div class="card shadow mb-4">
      <div class="card-header py-3">
        <h6 class="m-0 fw-bold text-primary">All Tournaments</h6>
      </div>
      <div class="card-body p-0" id="tournamentsTableWrap">
        <div class="text-center py-5 text-gray-600" id="tournamentsLoading">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
          Loading tournaments…
        </div>
        <div class="text-center py-5 text-gray-600 d-none" id="tournamentsEmpty">
          <i class="bi bi-trophy display-4 d-block mb-3 text-gray-300"></i>
          <p class="fw-bold mb-1">No tournaments yet</p>
          <p class="small mb-0">Create the first tournament to get started.</p>
          <a href="/admin/tournaments/new" class="btn btn-primary btn-sm mt-3">
            <i class="bi bi-plus-lg me-1"></i> New Tournament
          </a>
        </div>
        <div class="table-responsive d-none" id="tournamentsTableContainer">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Start Date</th>
                <th>Location</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="tournamentsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function buildTournamentRow(t) {
  return `
    <tr>
      <td class="fw-medium">${escHtml(t.name)}</td>
      <td>${statusBadge(t.status)}</td>
      <td class="text-muted small">${t.start_date || '—'}</td>
      <td class="text-muted small">${escHtml(t.location || '—')}</td>
      <td class="text-end">
        <a href="/admin/tournaments/${t.id}" class="btn btn-sm btn-outline-primary me-1" title="Edit">
          <i class="bi bi-pencil"></i>
        </a>
        <button class="btn btn-sm btn-outline-danger btn-delete-tournament"
                data-id="${t.id}" data-name="${escHtml(t.name)}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`
}

export function mountTournamentsList() {
  let allTournaments = []
  let activeFilter = 'all'

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allTournaments
      : allTournaments.filter(t => t.status === activeFilter)
    const tbody = document.getElementById('tournamentsTableBody')
    if (!tbody) return
    const countEl = document.getElementById('tournamentsCount')
    if (countEl) countEl.textContent = `${filtered.length} tournament${filtered.length !== 1 ? 's' : ''}`
    if (filtered.length === 0) {
      $('#tournamentsTableContainer').addClass('d-none')
      $('#tournamentsEmpty').removeClass('d-none')
    } else {
      $('#tournamentsEmpty').addClass('d-none')
      $('#tournamentsTableContainer').removeClass('d-none')
      tbody.innerHTML = filtered.map(buildTournamentRow).join('')
    }
  }

  apiRequest('/admin/tournaments')
    .then(function (res) {
      allTournaments = res?.data || []
      $('#tournamentsLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#tournamentsLoading').addClass('d-none')
      document.getElementById('tournamentsTableWrap').innerHTML = `
        <div class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Failed to load tournaments. Please refresh and try again.</p>
        </div>`
    })

  $(document).on('click.tournaments', '#tournamentsFilter button', function () {
    $('#tournamentsFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  $(document).on('click.tournaments', '.btn-delete-tournament', function () {
    const id = $(this).data('id')
    const name = $(this).data('name')
    if (!confirm(`Delete tournament "${name}"? This cannot be undone.`)) return
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/tournaments/${id}`, { method: 'DELETE' })
      .then(function () {
        allTournaments = allTournaments.filter(t => t.id !== id)
        applyFilter()
        showToast('Tournament deleted.')
      })
      .fail(function () {
        showToast('Failed to delete tournament.', 'error')
        $btn.prop('disabled', false)
      })
  })
}

// ─── Tournament Form ──────────────────────────────────────────────────────────

export function renderTournamentForm() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">
        <span class="spinner-border spinner-border-sm text-primary me-2 d-none" id="formLoadSpinner" role="status"></span>
        <span id="formTitle">New Tournament</span>
      </h1>
      <a href="/admin/tournaments" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i> Back to Tournaments
      </a>
    </div>

    <form id="tournamentForm" novalidate>
      <div class="row">
        <div class="col-lg-8">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Tournament Details</h6></div>
            <div class="card-body">
              <div class="mb-3">
                <label for="tName" class="form-label fw-semibold">Name <span class="text-danger" aria-hidden="true">*</span></label>
                <input type="text" class="form-control" id="tName" required placeholder="Tournament name" autocomplete="off">
                <div class="invalid-feedback">Name is required.</div>
              </div>
              <div class="mb-3">
                <label for="tSlug" class="form-label fw-semibold">Slug</label>
                <div class="input-group">
                  <span class="input-group-text text-muted small">/tournaments/</span>
                  <input type="text" class="form-control" id="tSlug" placeholder="auto-generated-from-name" autocomplete="off">
                </div>
                <div class="form-text">Leave blank to auto-generate.</div>
              </div>
              <div class="mb-3">
                <label for="tDescription" class="form-label fw-semibold">Description</label>
                <textarea class="form-control" id="tDescription" rows="4" placeholder="Event overview, rules, format…"></textarea>
              </div>
              <div class="mb-3">
                <label for="tLocation" class="form-label fw-semibold">Location</label>
                <input type="text" class="form-control" id="tLocation" placeholder="Manila Sports Complex">
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="tStartDate" class="form-label fw-semibold">Start Date</label>
                  <input type="date" class="form-control" id="tStartDate">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="tEndDate" class="form-label fw-semibold">End Date</label>
                  <input type="date" class="form-control" id="tEndDate">
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="tRegOpen" class="form-label fw-semibold">Registration Opens</label>
                  <input type="datetime-local" class="form-control" id="tRegOpen">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="tRegClose" class="form-label fw-semibold">Registration Closes</label>
                  <input type="datetime-local" class="form-control" id="tRegClose">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Status &amp; Settings</h6></div>
            <div class="card-body">
              <div class="mb-3">
                <label for="tStatus" class="form-label fw-semibold">Status</label>
                <select class="form-select" id="tStatus">
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="tMaxTeams" class="form-label fw-semibold">Max Teams</label>
                <input type="number" class="form-control" id="tMaxTeams" placeholder="Unlimited" min="1">
              </div>
              <div class="d-grid">
                <button type="submit" class="btn btn-primary" id="btnSave">
                  <span class="spinner-border spinner-border-sm me-1 d-none" id="btnSaveSpinner" role="status"></span>
                  <i class="bi bi-floppy me-1"></i> Save Tournament
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>

    <!-- Manage Matches link (shown when editing) -->
    <div id="matchesLink" class="d-none mb-3">
      <a id="btnManageMatches" href="#" class="btn btn-outline-success btn-sm">
        <i class="bi bi-diagram-3 me-1"></i> Manage Matches
      </a>
    </div>

    <!-- Divisions panel (shown when editing) -->
    <div id="divisionsPanel" class="d-none">
      <hr class="my-2">
      <div class="d-sm-flex align-items-center justify-content-between mb-3">
        <h2 class="h5 mb-0 fw-bold text-gray-800">Divisions</h2>
        <button class="btn btn-sm btn-outline-primary" id="btnToggleAddDivision">
          <i class="bi bi-plus-lg me-1"></i> Add Division
        </button>
      </div>
      <div class="card shadow mb-3 d-none" id="addDivisionCard">
        <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Add Division</h6></div>
        <div class="card-body">
          <div class="row g-3 align-items-end">
            <div class="col-md-4">
              <label for="divName" class="form-label fw-semibold">Name <span class="text-danger" aria-hidden="true">*</span></label>
              <input type="text" class="form-control" id="divName" placeholder="Open Lightweight">
            </div>
            <div class="col-md-5">
              <label for="divDescription" class="form-label fw-semibold">Description</label>
              <input type="text" class="form-control" id="divDescription" placeholder="Optional details…">
            </div>
            <div class="col-md-2">
              <label for="divMaxParticipants" class="form-label fw-semibold">Max</label>
              <input type="number" class="form-control" id="divMaxParticipants" placeholder="∞" min="1">
            </div>
            <div class="col-md-1">
              <button class="btn btn-primary w-100" id="btnConfirmAddDivision">
                <span class="spinner-border spinner-border-sm d-none" id="addDivisionSpinner" role="status"></span>
                <i class="bi bi-check-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="card shadow mb-4">
        <div class="card-body p-0" id="divisionsWrap">
          <div class="text-center py-4 text-muted" id="divisionsLoading">
            <div class="spinner-border spinner-border-sm" role="status"></div>
          </div>
          <div class="text-center py-4 text-muted d-none" id="divisionsEmpty">
            <i class="bi bi-diagram-3 display-4 d-block mb-2 text-gray-300"></i>
            <p class="mb-0 small">No divisions yet. Add one above.</p>
          </div>
          <div class="table-responsive d-none" id="divisionsTable">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th>Division</th><th>Description</th><th>Max</th><th class="text-end">Actions</th></tr>
              </thead>
              <tbody id="divisionsBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`
}

function toLocalDatetimeInput(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function mountTournamentForm(tournamentId) {
  let currentTournament = null
  let slugManuallyEdited = false

  $('#tName').on('input', function () {
    if (!slugManuallyEdited) $('#tSlug').val(slugify(this.value))
  })
  $('#tSlug').on('input', function () {
    slugManuallyEdited = this.value.length > 0
  })

  function populateForm(t) {
    currentTournament = t
    $('#formTitle').text(t.name)
    $('#tName').val(t.name)
    $('#tSlug').val(t.slug)
    $('#tDescription').val(t.description || '')
    $('#tLocation').val(t.location || '')
    $('#tStartDate').val(t.start_date || '')
    $('#tEndDate').val(t.end_date || '')
    $('#tRegOpen').val(toLocalDatetimeInput(t.registration_open_at))
    $('#tRegClose').val(toLocalDatetimeInput(t.registration_close_at))
    $('#tStatus').val(t.status)
    $('#tMaxTeams').val(t.max_teams || '')
    slugManuallyEdited = true
  }

  if (tournamentId) {
    $('#formLoadSpinner').removeClass('d-none')
    apiRequest('/admin/tournaments')
      .then(function (res) {
        const tournament = (res?.data || []).find(t => t.id === tournamentId)
        $('#formLoadSpinner').addClass('d-none')
        if (tournament) {
          populateForm(tournament)
          $('#divisionsPanel').removeClass('d-none')
          $('#matchesLink').removeClass('d-none')
          $('#btnManageMatches').attr('href', `/admin/tournaments/${tournamentId}/matches`)
          loadDivisions(tournamentId)
        } else {
          showToast('Tournament not found.', 'error')
          window.location.href = '/admin/tournaments'
        }
      })
      .fail(function () {
        $('#formLoadSpinner').addClass('d-none')
        showToast('Failed to load tournament.', 'error')
      })
  }

  function isoFromLocalInput(val) {
    if (!val) return null
    return new Date(val).toISOString()
  }

  $(document).on('submit.tournaments', '#tournamentForm', function (e) {
    e.preventDefault()
    if (!this.checkValidity()) { this.classList.add('was-validated'); return }

    const payload = {
      name: $('#tName').val().trim(),
      slug: $('#tSlug').val().trim() || null,
      description: $('#tDescription').val().trim() || null,
      location: $('#tLocation').val().trim() || null,
      start_date: $('#tStartDate').val() || null,
      end_date: $('#tEndDate').val() || null,
      registration_open_at: isoFromLocalInput($('#tRegOpen').val()),
      registration_close_at: isoFromLocalInput($('#tRegClose').val()),
      status: $('#tStatus').val(),
      max_teams: $('#tMaxTeams').val() ? parseInt($('#tMaxTeams').val()) : null,
    }

    $('#btnSaveSpinner').removeClass('d-none')
    $('#btnSave').prop('disabled', true)

    const req = currentTournament
      ? apiRequest(`/admin/tournaments/${currentTournament.id}`, { method: 'PATCH', data: payload })
      : apiRequest('/admin/tournaments', { method: 'POST', data: payload })

    req
      .then(function (res) {
        const saved = res?.data
        if (!saved) return
        const isNew = !currentTournament
        populateForm(saved)
        showToast(isNew ? 'Tournament created.' : 'Tournament saved.')
        if (isNew) {
          history.replaceState(null, '', `/admin/tournaments/${saved.id}`)
          $('#divisionsPanel').removeClass('d-none')
          $('#matchesLink').removeClass('d-none')
          $('#btnManageMatches').attr('href', `/admin/tournaments/${saved.id}/matches`)
          loadDivisions(saved.id)
        }
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Save failed.', 'error')
      })
      .always(function () {
        $('#btnSaveSpinner').addClass('d-none')
        $('#btnSave').prop('disabled', false)
      })
  })

  function loadDivisions(tid) {
    $('#divisionsLoading').removeClass('d-none')
    $('#divisionsTable, #divisionsEmpty').addClass('d-none')
    apiRequest(`/admin/tournaments/${tid}/divisions`)
      .then(function (res) {
        $('#divisionsLoading').addClass('d-none')
        const divisions = res?.data || []
        if (divisions.length === 0) {
          $('#divisionsEmpty').removeClass('d-none')
        } else {
          $('#divisionsTable').removeClass('d-none')
          document.getElementById('divisionsBody').innerHTML = divisions.map(d => `
            <tr>
              <td class="fw-medium">${escHtml(d.name)}</td>
              <td class="text-muted small">${escHtml(d.description || '—')}</td>
              <td class="text-muted small">${d.max_participants ?? '∞'}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger btn-delete-division"
                        data-id="${d.id}" data-name="${escHtml(d.name)}" title="Delete">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`).join('')
        }
      })
      .fail(function () {
        $('#divisionsLoading').addClass('d-none')
        showToast('Failed to load divisions.', 'error')
      })
  }

  $(document).on('click.tournaments', '#btnToggleAddDivision', function () {
    $('#addDivisionCard').toggleClass('d-none')
  })

  $(document).on('click.tournaments', '#btnConfirmAddDivision', function () {
    const name = $('#divName').val().trim()
    if (!name) { showToast('Division name is required.', 'error'); return }
    const tid = currentTournament?.id
    if (!tid) return

    $('#addDivisionSpinner').removeClass('d-none')
    $('#btnConfirmAddDivision').prop('disabled', true)
    apiRequest(`/admin/tournaments/${tid}/divisions`, {
      method: 'POST',
      data: {
        name,
        description: $('#divDescription').val().trim() || null,
        max_participants: $('#divMaxParticipants').val() ? parseInt($('#divMaxParticipants').val()) : null,
      },
    })
      .then(function () {
        $('#divName').val('')
        $('#divDescription').val('')
        $('#divMaxParticipants').val('')
        $('#addDivisionCard').addClass('d-none')
        showToast('Division added.')
        loadDivisions(tid)
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Failed to add division.', 'error')
      })
      .always(function () {
        $('#addDivisionSpinner').addClass('d-none')
        $('#btnConfirmAddDivision').prop('disabled', false)
      })
  })

  $(document).on('click.tournaments', '.btn-delete-division', function () {
    const id = $(this).data('id')
    const name = $(this).data('name')
    const tid = currentTournament?.id
    if (!tid || !confirm(`Delete division "${name}"?`)) return
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/tournaments/${tid}/divisions/${id}`, { method: 'DELETE' })
      .then(function () { showToast('Division deleted.'); loadDivisions(tid) })
      .fail(function () { showToast('Failed to delete division.', 'error'); $btn.prop('disabled', false) })
  })
}
