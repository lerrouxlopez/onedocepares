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

export function unmountTeams() {
  $(document).off('.teams')
}

// ─── Teams List ───────────────────────────────────────────────────────────────

export function renderTeamsList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Teams</h1>
      <a href="/admin/teams/new" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-plus-lg me-1"></i> New Team
      </a>
    </div>

    <div class="mb-3 d-flex align-items-center gap-3">
      <div class="btn-group btn-group-sm" id="teamsFilter" role="group" aria-label="Filter teams">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="active">Active</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="inactive">Inactive</button>
      </div>
      <small class="text-muted" id="teamsCount"></small>
    </div>

    <div class="card shadow mb-4">
      <div class="card-header py-3 d-flex align-items-center justify-content-between">
        <h6 class="m-0 fw-bold text-primary">All Teams</h6>
      </div>
      <div class="card-body p-0" id="teamsTableWrap">
        <div class="text-center py-5 text-gray-600" id="teamsLoading">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
          Loading teams…
        </div>
        <div class="text-center py-5 text-gray-600 d-none" id="teamsEmpty">
          <i class="bi bi-people display-4 d-block mb-3 text-gray-300"></i>
          <p class="fw-bold mb-1">No teams yet</p>
          <p class="small mb-0">Create your first team to get started.</p>
          <a href="/admin/teams/new" class="btn btn-primary btn-sm mt-3">
            <i class="bi bi-plus-lg me-1"></i> New Team
          </a>
        </div>
        <div class="table-responsive d-none" id="teamsTableContainer">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="teamsTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function buildTeamRow(team) {
  const location = [team.city, team.country].filter(Boolean).join(', ') || '—'
  const badge = team.is_active
    ? `<span class="badge bg-success">Active</span>`
    : `<span class="badge bg-secondary">Inactive</span>`
  return `
    <tr>
      <td class="fw-medium">${escHtml(team.name)}</td>
      <td class="text-muted small">${escHtml(location)}</td>
      <td>${badge}</td>
      <td class="text-muted small">${fmtDate(team.created_at)}</td>
      <td class="text-end">
        <a href="/admin/teams/${team.id}" class="btn btn-sm btn-outline-primary me-1" title="Edit">
          <i class="bi bi-pencil"></i>
        </a>
        <button class="btn btn-sm btn-outline-danger btn-delete-team" data-id="${team.id}" data-name="${escHtml(team.name)}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`
}

export function mountTeamsList() {
  let allTeams = []
  let activeFilter = 'all'

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allTeams
      : activeFilter === 'active'
        ? allTeams.filter(t => t.is_active)
        : allTeams.filter(t => !t.is_active)
    const tbody = document.getElementById('teamsTableBody')
    if (!tbody) return
    const countEl = document.getElementById('teamsCount')
    if (countEl) countEl.textContent = `${filtered.length} team${filtered.length !== 1 ? 's' : ''}`
    if (filtered.length === 0) {
      $('#teamsTableContainer').addClass('d-none')
      $('#teamsEmpty').removeClass('d-none')
    } else {
      $('#teamsEmpty').addClass('d-none')
      $('#teamsTableContainer').removeClass('d-none')
      tbody.innerHTML = filtered.map(buildTeamRow).join('')
    }
  }

  apiRequest('/admin/teams')
    .then(function (res) {
      allTeams = res?.data || []
      $('#teamsLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#teamsLoading').addClass('d-none')
      document.getElementById('teamsTableWrap').innerHTML = `
        <div class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Failed to load teams. Please refresh and try again.</p>
        </div>`
    })

  $(document).on('click.teams', '#teamsFilter button', function () {
    $('#teamsFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  $(document).on('click.teams', '.btn-delete-team', function () {
    const id = $(this).data('id')
    const name = $(this).data('name')
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/teams/${id}`, { method: 'DELETE' })
      .then(function () {
        allTeams = allTeams.filter(t => t.id !== id)
        applyFilter()
        showToast('Team deleted.')
      })
      .fail(function () {
        showToast('Failed to delete team.', 'error')
        $btn.prop('disabled', false)
      })
  })
}

// ─── Team Form ────────────────────────────────────────────────────────────────

export function renderTeamForm() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">
        <span class="spinner-border spinner-border-sm text-primary me-2 d-none" id="formLoadSpinner" role="status"></span>
        <span id="formTitle">New Team</span>
      </h1>
      <a href="/admin/teams" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i> Back to Teams
      </a>
    </div>

    <form id="teamForm" novalidate>
      <div class="row">
        <div class="col-lg-8">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Team Details</h6></div>
            <div class="card-body">
              <div class="mb-3">
                <label for="teamName" class="form-label fw-semibold">Name <span class="text-danger" aria-hidden="true">*</span></label>
                <input type="text" class="form-control" id="teamName" name="name" required placeholder="Team name" autocomplete="off">
                <div class="invalid-feedback">Name is required.</div>
              </div>
              <div class="mb-3">
                <label for="teamSlug" class="form-label fw-semibold">Slug</label>
                <div class="input-group">
                  <span class="input-group-text text-muted small">/teams/</span>
                  <input type="text" class="form-control" id="teamSlug" name="slug" placeholder="auto-generated-from-name" autocomplete="off">
                </div>
                <div class="form-text">Leave blank to auto-generate.</div>
              </div>
              <div class="mb-3">
                <label for="teamDescription" class="form-label fw-semibold">Description</label>
                <textarea class="form-control" id="teamDescription" name="description" rows="4" placeholder="Short team bio or history…"></textarea>
              </div>
              <div class="mb-3">
                <label for="teamLogoUrl" class="form-label fw-semibold">Logo URL</label>
                <input type="url" class="form-control" id="teamLogoUrl" name="logo_url" placeholder="https://…">
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="teamCity" class="form-label fw-semibold">City</label>
                  <input type="text" class="form-control" id="teamCity" placeholder="Manila">
                </div>
                <div class="col-md-6 mb-3">
                  <label for="teamCountry" class="form-label fw-semibold">Country</label>
                  <input type="text" class="form-control" id="teamCountry" placeholder="Philippines">
                </div>
              </div>
              <div class="row">
                <div class="col-md-6 mb-0">
                  <label for="teamFoundedYear" class="form-label fw-semibold">Founded Year</label>
                  <input type="number" class="form-control" id="teamFoundedYear" placeholder="2000" min="1900" max="2099">
                </div>
                <div class="col-md-6 mb-0">
                  <label for="teamWebsite" class="form-label fw-semibold">Website</label>
                  <input type="url" class="form-control" id="teamWebsite" placeholder="https://…">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Visibility</h6></div>
            <div class="card-body">
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="teamIsActive" checked>
                <label class="form-check-label fw-semibold" for="teamIsActive">Active</label>
              </div>
              <p class="form-text mb-3">Inactive teams are hidden from the public directory.</p>
              <div class="d-grid">
                <button type="submit" class="btn btn-primary" id="btnSave">
                  <span class="spinner-border spinner-border-sm me-1 d-none" role="status" id="btnSaveSpinner"></span>
                  <i class="bi bi-floppy me-1"></i> Save Team
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>

    <div id="membersPanel" class="d-none">
      <hr class="my-2">
      <div class="d-sm-flex align-items-center justify-content-between mb-3">
        <h2 class="h5 mb-0 fw-bold text-gray-800">Team Members</h2>
        <button class="btn btn-sm btn-outline-primary" id="btnToggleAddMember">
          <i class="bi bi-person-plus me-1"></i> Add Member
        </button>
      </div>
      <div class="card shadow mb-3 d-none" id="addMemberCard">
        <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Add Member</h6></div>
        <div class="card-body">
          <div class="row align-items-end g-3">
            <div class="col-md-5">
              <label for="memberPlayerSearch" class="form-label fw-semibold">Player</label>
              <input type="text" class="form-control" id="memberPlayerSearch"
                     list="playerOptions" placeholder="Type player name…" autocomplete="off">
              <datalist id="playerOptions"></datalist>
            </div>
            <div class="col-md-2">
              <div class="form-check mt-4 pt-2">
                <input class="form-check-input" type="checkbox" id="memberIsCaptain">
                <label class="form-check-label" for="memberIsCaptain">Captain</label>
              </div>
            </div>
            <div class="col-md-3">
              <label for="memberJoinedAt" class="form-label fw-semibold">Joined</label>
              <input type="date" class="form-control" id="memberJoinedAt">
            </div>
            <div class="col-md-2">
              <button class="btn btn-primary w-100" id="btnConfirmAddMember">
                <span class="spinner-border spinner-border-sm me-1 d-none" id="addMemberSpinner" role="status"></span>Add
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="card shadow mb-4">
        <div class="card-body p-0" id="membersWrap">
          <div class="text-center py-4 text-muted" id="membersLoading">
            <div class="spinner-border spinner-border-sm" role="status"></div>
          </div>
          <div class="text-center py-4 text-muted d-none" id="membersEmpty">
            <i class="bi bi-people display-4 d-block mb-2 text-gray-300"></i>
            <p class="mb-0 small">No members yet.</p>
          </div>
          <div class="table-responsive d-none" id="membersTable">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr><th>Player</th><th>Role</th><th>Joined</th><th class="text-end">Actions</th></tr>
              </thead>
              <tbody id="membersBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`
}

export function mountTeamForm(teamId) {
  let currentTeam = null
  let playerLookup = {}
  let slugManuallyEdited = false

  $('#teamName').on('input', function () {
    if (!slugManuallyEdited) $('#teamSlug').val(slugify(this.value))
  })
  $('#teamSlug').on('input', function () {
    slugManuallyEdited = this.value.length > 0
  })

  function populateForm(team) {
    currentTeam = team
    $('#formTitle').text(team.name)
    $('#teamName').val(team.name)
    $('#teamSlug').val(team.slug)
    $('#teamDescription').val(team.description || '')
    $('#teamLogoUrl').val(team.logo_url || '')
    $('#teamCity').val(team.city || '')
    $('#teamCountry').val(team.country || '')
    $('#teamFoundedYear').val(team.founded_year || '')
    $('#teamWebsite').val(team.website || '')
    $('#teamIsActive').prop('checked', team.is_active)
    slugManuallyEdited = true
  }

  if (teamId) {
    $('#formLoadSpinner').removeClass('d-none')
    apiRequest('/admin/teams')
      .then(function (res) {
        const team = (res?.data || []).find(t => t.id === teamId)
        $('#formLoadSpinner').addClass('d-none')
        if (team) {
          populateForm(team)
          $('#membersPanel').removeClass('d-none')
          loadMembers(teamId)
          loadAllPlayers()
        } else {
          showToast('Team not found.', 'error')
          window.location.href = '/admin/teams'
        }
      })
      .fail(function () {
        $('#formLoadSpinner').addClass('d-none')
        showToast('Failed to load team.', 'error')
      })
  }

  $(document).on('submit.teams', '#teamForm', function (e) {
    e.preventDefault()
    if (!this.checkValidity()) { this.classList.add('was-validated'); return }

    const payload = {
      name: $('#teamName').val().trim(),
      slug: $('#teamSlug').val().trim() || null,
      description: $('#teamDescription').val().trim() || null,
      logo_url: $('#teamLogoUrl').val().trim() || null,
      city: $('#teamCity').val().trim() || null,
      country: $('#teamCountry').val().trim() || null,
      founded_year: $('#teamFoundedYear').val() ? parseInt($('#teamFoundedYear').val()) : null,
      website: $('#teamWebsite').val().trim() || null,
      is_active: $('#teamIsActive').prop('checked'),
    }

    $('#btnSaveSpinner').removeClass('d-none')
    $('#btnSave').prop('disabled', true)

    const req = currentTeam
      ? apiRequest(`/admin/teams/${currentTeam.id}`, { method: 'PATCH', data: payload })
      : apiRequest('/admin/teams', { method: 'POST', data: payload })

    req
      .then(function (res) {
        const saved = res?.data
        if (!saved) return
        const isNew = !currentTeam
        populateForm(saved)
        showToast(isNew ? 'Team created.' : 'Team saved.')
        if (isNew) {
          history.replaceState(null, '', `/admin/teams/${saved.id}`)
          $('#membersPanel').removeClass('d-none')
          loadMembers(saved.id)
          loadAllPlayers()
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

  function loadAllPlayers() {
    apiRequest('/admin/players')
      .then(function (res) {
        const players = res?.data || []
        playerLookup = {}
        const datalist = document.getElementById('playerOptions')
        if (datalist) {
          datalist.innerHTML = players.map(p => {
            playerLookup[p.name] = p.id
            return `<option value="${escHtml(p.name)}"></option>`
          }).join('')
        }
      })
  }

  function loadMembers(tid) {
    $('#membersLoading').removeClass('d-none')
    $('#membersTable, #membersEmpty').addClass('d-none')
    apiRequest(`/admin/teams/${tid}/members`)
      .then(function (res) {
        $('#membersLoading').addClass('d-none')
        const members = res?.data || []
        if (members.length === 0) {
          $('#membersEmpty').removeClass('d-none')
        } else {
          $('#membersTable').removeClass('d-none')
          document.getElementById('membersBody').innerHTML = members.map(m => `
            <tr>
              <td>
                <span class="fw-medium">${escHtml(m.player_name)}</span>
                <code class="d-block small text-muted">${escHtml(m.player_slug)}</code>
              </td>
              <td>${m.is_captain ? '<span class="badge bg-primary">Captain</span>' : '<span class="text-muted small">Member</span>'}</td>
              <td class="text-muted small">${m.joined_at || '—'}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-danger btn-remove-member"
                        data-player-id="${m.player_id}" title="Remove">
                  <i class="bi bi-person-dash"></i>
                </button>
              </td>
            </tr>`).join('')
        }
      })
      .fail(function () {
        $('#membersLoading').addClass('d-none')
        showToast('Failed to load members.', 'error')
      })
  }

  $(document).on('click.teams', '#btnToggleAddMember', function () {
    $('#addMemberCard').toggleClass('d-none')
  })

  $(document).on('click.teams', '#btnConfirmAddMember', function () {
    const playerName = $('#memberPlayerSearch').val().trim()
    const playerId = playerLookup[playerName]
    if (!playerId) { showToast('Select a valid player from the list.', 'error'); return }
    const tid = currentTeam?.id
    if (!tid) return

    $('#addMemberSpinner').removeClass('d-none')
    $('#btnConfirmAddMember').prop('disabled', true)
    apiRequest(`/admin/teams/${tid}/members`, {
      method: 'POST',
      data: {
        player_id: playerId,
        is_captain: $('#memberIsCaptain').prop('checked'),
        joined_at: $('#memberJoinedAt').val() || null,
      },
    })
      .then(function () {
        $('#memberPlayerSearch').val('')
        $('#memberIsCaptain').prop('checked', false)
        $('#memberJoinedAt').val('')
        $('#addMemberCard').addClass('d-none')
        showToast('Member added.')
        loadMembers(tid)
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Failed to add member.', 'error')
      })
      .always(function () {
        $('#addMemberSpinner').addClass('d-none')
        $('#btnConfirmAddMember').prop('disabled', false)
      })
  })

  $(document).on('click.teams', '.btn-remove-member', function () {
    const playerId = $(this).data('player-id')
    const tid = currentTeam?.id
    if (!tid || !confirm('Remove this member from the team?')) return
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/teams/${tid}/members/${playerId}`, { method: 'DELETE' })
      .then(function () { showToast('Member removed.'); loadMembers(tid) })
      .fail(function () { showToast('Failed to remove member.', 'error'); $btn.prop('disabled', false) })
  })
}
