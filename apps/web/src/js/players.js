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

export function unmountPlayers() {
  $(document).off('.players')
}

// ─── Players List ─────────────────────────────────────────────────────────────

export function renderPlayersList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Players</h1>
      <a href="/admin/players/new" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-plus-lg me-1"></i> New Player
      </a>
    </div>

    <div class="mb-3 d-flex align-items-center gap-3">
      <div class="btn-group btn-group-sm" id="playersFilter" role="group" aria-label="Filter players">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="active">Active</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="inactive">Inactive</button>
      </div>
      <small class="text-muted" id="playersCount"></small>
    </div>

    <div class="card shadow mb-4">
      <div class="card-header py-3">
        <h6 class="m-0 fw-bold text-primary">All Players</h6>
      </div>
      <div class="card-body p-0" id="playersTableWrap">
        <div class="text-center py-5 text-gray-600" id="playersLoading">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
          Loading players…
        </div>
        <div class="text-center py-5 text-gray-600 d-none" id="playersEmpty">
          <i class="bi bi-person-badge display-4 d-block mb-3 text-gray-300"></i>
          <p class="fw-bold mb-1">No players yet</p>
          <p class="small mb-0">Create the first player profile to get started.</p>
          <a href="/admin/players/new" class="btn btn-primary btn-sm mt-3">
            <i class="bi bi-plus-lg me-1"></i> New Player
          </a>
        </div>
        <div class="table-responsive d-none" id="playersTableContainer">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Name</th>
                <th>Nationality</th>
                <th>Belt Rank</th>
                <th>Status</th>
                <th>Created</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="playersTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

const BELT_COLORS = {
  white: 'bg-light text-dark border',
  yellow: 'bg-warning text-dark',
  orange: 'bg-orange text-white',
  green: 'bg-success',
  blue: 'bg-primary',
  purple: 'bg-purple text-white',
  brown: 'bg-secondary',
  red: 'bg-danger',
  black: 'bg-dark',
}

function beltBadge(rank) {
  if (!rank) return '<span class="text-muted small">—</span>'
  const cls = BELT_COLORS[rank.toLowerCase()] || 'bg-secondary'
  return `<span class="badge ${cls}">${escHtml(rank)}</span>`
}

function buildPlayerRow(player) {
  const badge = player.is_active
    ? `<span class="badge bg-success">Active</span>`
    : `<span class="badge bg-secondary">Inactive</span>`
  return `
    <tr>
      <td class="fw-medium">${escHtml(player.name)}</td>
      <td class="text-muted small">${escHtml(player.nationality || '—')}</td>
      <td>${beltBadge(player.belt_rank)}</td>
      <td>${badge}</td>
      <td class="text-muted small">${fmtDate(player.created_at)}</td>
      <td class="text-end">
        <a href="/admin/players/${player.id}" class="btn btn-sm btn-outline-primary me-1" title="Edit">
          <i class="bi bi-pencil"></i>
        </a>
        <button class="btn btn-sm btn-outline-danger btn-delete-player"
                data-id="${player.id}" data-name="${escHtml(player.name)}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>`
}

export function mountPlayersList() {
  let allPlayers = []
  let activeFilter = 'all'

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allPlayers
      : activeFilter === 'active'
        ? allPlayers.filter(p => p.is_active)
        : allPlayers.filter(p => !p.is_active)
    const tbody = document.getElementById('playersTableBody')
    if (!tbody) return
    const countEl = document.getElementById('playersCount')
    if (countEl) countEl.textContent = `${filtered.length} player${filtered.length !== 1 ? 's' : ''}`
    if (filtered.length === 0) {
      $('#playersTableContainer').addClass('d-none')
      $('#playersEmpty').removeClass('d-none')
    } else {
      $('#playersEmpty').addClass('d-none')
      $('#playersTableContainer').removeClass('d-none')
      tbody.innerHTML = filtered.map(buildPlayerRow).join('')
    }
  }

  apiRequest('/admin/players')
    .then(function (res) {
      allPlayers = res?.data || []
      $('#playersLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#playersLoading').addClass('d-none')
      document.getElementById('playersTableWrap').innerHTML = `
        <div class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Failed to load players. Please refresh and try again.</p>
        </div>`
    })

  $(document).on('click.players', '#playersFilter button', function () {
    $('#playersFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  $(document).on('click.players', '.btn-delete-player', function () {
    const id = $(this).data('id')
    const name = $(this).data('name')
    if (!confirm(`Delete player "${name}"? This cannot be undone.`)) return
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/players/${id}`, { method: 'DELETE' })
      .then(function () {
        allPlayers = allPlayers.filter(p => p.id !== id)
        applyFilter()
        showToast('Player deleted.')
      })
      .fail(function () {
        showToast('Failed to delete player.', 'error')
        $btn.prop('disabled', false)
      })
  })
}

// ─── Player Form ──────────────────────────────────────────────────────────────

export function renderPlayerForm() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">
        <span class="spinner-border spinner-border-sm text-primary me-2 d-none" id="formLoadSpinner" role="status"></span>
        <span id="formTitle">New Player</span>
      </h1>
      <a href="/admin/players" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i> Back to Players
      </a>
    </div>

    <form id="playerForm" novalidate>
      <div class="row">
        <div class="col-lg-8">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Player Details</h6></div>
            <div class="card-body">
              <div class="mb-3">
                <label for="playerName" class="form-label fw-semibold">Name <span class="text-danger" aria-hidden="true">*</span></label>
                <input type="text" class="form-control" id="playerName" required placeholder="Full name" autocomplete="off">
                <div class="invalid-feedback">Name is required.</div>
              </div>
              <div class="mb-3">
                <label for="playerSlug" class="form-label fw-semibold">Slug</label>
                <div class="input-group">
                  <span class="input-group-text text-muted small">/players/</span>
                  <input type="text" class="form-control" id="playerSlug" placeholder="auto-generated-from-name" autocomplete="off">
                </div>
                <div class="form-text">Leave blank to auto-generate.</div>
              </div>
              <div class="mb-3">
                <label for="playerBio" class="form-label fw-semibold">Bio</label>
                <textarea class="form-control" id="playerBio" rows="4" placeholder="Short bio…"></textarea>
              </div>
              <div class="mb-3">
                <label for="playerPhotoUrl" class="form-label fw-semibold">Photo URL</label>
                <input type="url" class="form-control" id="playerPhotoUrl" placeholder="https://…">
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="playerDob" class="form-label fw-semibold">Date of Birth</label>
                  <input type="date" class="form-control" id="playerDob">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="playerNationality" class="form-label fw-semibold">Nationality</label>
                  <input type="text" class="form-control" id="playerNationality" placeholder="Philippines">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="playerWeightClass" class="form-label fw-semibold">Weight Class</label>
                  <input type="text" class="form-control" id="playerWeightClass" placeholder="Lightweight">
                </div>
              </div>
              <div class="mb-0">
                <label for="playerBeltRank" class="form-label fw-semibold">Belt Rank</label>
                <select class="form-select" id="playerBeltRank">
                  <option value="">— Select —</option>
                  <option value="white">White</option>
                  <option value="yellow">Yellow</option>
                  <option value="orange">Orange</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="purple">Purple</option>
                  <option value="brown">Brown</option>
                  <option value="red">Red</option>
                  <option value="black">Black</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card shadow mb-4">
            <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Visibility</h6></div>
            <div class="card-body">
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="playerIsActive" checked>
                <label class="form-check-label fw-semibold" for="playerIsActive">Active</label>
              </div>
              <p class="form-text mb-3">Inactive players are hidden from the public directory.</p>
              <div class="d-grid">
                <button type="submit" class="btn btn-primary" id="btnSave">
                  <span class="spinner-border spinner-border-sm me-1 d-none" id="btnSaveSpinner" role="status"></span>
                  <i class="bi bi-floppy me-1"></i> Save Player
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>`
}

export function mountPlayerForm(playerId) {
  let currentPlayer = null
  let slugManuallyEdited = false

  $('#playerName').on('input', function () {
    if (!slugManuallyEdited) $('#playerSlug').val(slugify(this.value))
  })
  $('#playerSlug').on('input', function () {
    slugManuallyEdited = this.value.length > 0
  })

  function populateForm(player) {
    currentPlayer = player
    $('#formTitle').text(player.name)
    $('#playerName').val(player.name)
    $('#playerSlug').val(player.slug)
    $('#playerBio').val(player.bio || '')
    $('#playerPhotoUrl').val(player.photo_url || '')
    $('#playerDob').val(player.date_of_birth || '')
    $('#playerNationality').val(player.nationality || '')
    $('#playerWeightClass').val(player.weight_class || '')
    $('#playerBeltRank').val(player.belt_rank || '')
    $('#playerIsActive').prop('checked', player.is_active)
    slugManuallyEdited = true
  }

  if (playerId) {
    $('#formLoadSpinner').removeClass('d-none')
    apiRequest('/admin/players')
      .then(function (res) {
        const player = (res?.data || []).find(p => p.id === playerId)
        $('#formLoadSpinner').addClass('d-none')
        if (player) {
          populateForm(player)
        } else {
          showToast('Player not found.', 'error')
          window.location.href = '/admin/players'
        }
      })
      .fail(function () {
        $('#formLoadSpinner').addClass('d-none')
        showToast('Failed to load player.', 'error')
      })
  }

  $(document).on('submit.players', '#playerForm', function (e) {
    e.preventDefault()
    if (!this.checkValidity()) { this.classList.add('was-validated'); return }

    const payload = {
      name: $('#playerName').val().trim(),
      slug: $('#playerSlug').val().trim() || null,
      bio: $('#playerBio').val().trim() || null,
      photo_url: $('#playerPhotoUrl').val().trim() || null,
      date_of_birth: $('#playerDob').val() || null,
      nationality: $('#playerNationality').val().trim() || null,
      weight_class: $('#playerWeightClass').val().trim() || null,
      belt_rank: $('#playerBeltRank').val() || null,
      is_active: $('#playerIsActive').prop('checked'),
    }

    $('#btnSaveSpinner').removeClass('d-none')
    $('#btnSave').prop('disabled', true)

    const req = currentPlayer
      ? apiRequest(`/admin/players/${currentPlayer.id}`, { method: 'PATCH', data: payload })
      : apiRequest('/admin/players', { method: 'POST', data: payload })

    req
      .then(function (res) {
        const saved = res?.data
        if (!saved) return
        const isNew = !currentPlayer
        populateForm(saved)
        showToast(isNew ? 'Player created.' : 'Player saved.')
        if (isNew) history.replaceState(null, '', `/admin/players/${saved.id}`)
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Save failed.', 'error')
      })
      .always(function () {
        $('#btnSaveSpinner').addClass('d-none')
        $('#btnSave').prop('disabled', false)
      })
  })
}
