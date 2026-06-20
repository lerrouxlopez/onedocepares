import $ from 'jquery'
import { apiRequest } from './api'

export function unmountBadges() {
  $(document).off('.badges')
}

export function renderBadgesList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Badges</h1>
      <button id="btnNewBadge" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-plus-circle me-1"></i> New Badge
      </button>
    </div>
    <div id="badge-form-wrap" class="d-none mb-4"></div>
    <div id="award-form-wrap" class="d-none mb-4"></div>
    <div class="card shadow mb-4">
      <div class="card-body p-0">
        <div id="badges-table">
          <div class="text-center py-5 text-muted">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <p class="mb-0">Loading badges…</p>
          </div>
        </div>
      </div>
    </div>`
}

function escHtml(str) {
  return $('<div>').text(String(str ?? '')).html()
}

function renderBadgesTable(badges) {
  if (!badges.length) {
    return `<div class="text-center py-5 text-muted">
      <i class="bi bi-award display-4 d-block mb-3 text-secondary"></i>
      <p class="fw-bold mb-0">No badges yet.</p>
      <p class="small">Create the first badge to start awarding recognition.</p>
    </div>`
  }
  return `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Name</th><th>Category</th><th>Description</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${badges.map(b => `
            <tr>
              <td>
                ${b.icon_url ? `<img src="${escHtml(b.icon_url)}" alt="" width="24" class="me-2 rounded-circle">` : '<i class="bi bi-award me-2 text-warning"></i>'}
                <strong>${escHtml(b.name)}</strong>
                <code class="ms-2 small text-muted">${escHtml(b.slug)}</code>
              </td>
              <td><span class="badge bg-secondary">${escHtml(b.category)}</span></td>
              <td class="small text-muted">${escHtml(b.description ?? '')}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-warning me-1 btn-award"
                        data-id="${b.id}" data-name="${escHtml(b.name)}">
                  <i class="bi bi-gift me-1"></i> Award
                </button>
                <button class="btn btn-sm btn-outline-secondary me-1 btn-edit-badge" data-id="${b.id}">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-delete-badge" data-id="${b.id}">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}

function badgeFormHtml(badge) {
  const isEdit = !!badge
  return `
    <div class="card shadow">
      <div class="card-header py-3 d-flex justify-content-between align-items-center">
        <h6 class="m-0 fw-bold text-primary">${isEdit ? 'Edit' : 'New'} Badge</h6>
        <button class="btn btn-sm btn-light btn-cancel-badge-form">Cancel</button>
      </div>
      <div class="card-body">
        <form id="badgeForm" data-edit-id="${badge?.id ?? ''}">
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Name *</label>
              <input type="text" class="form-control" id="bfName" required
                     value="${escHtml(badge?.name ?? '')}">
            </div>
            <div class="col-md-3">
              <label class="form-label fw-semibold">Slug *</label>
              <input type="text" class="form-control" id="bfSlug" required
                     value="${escHtml(badge?.slug ?? '')}">
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">Category</label>
              <input type="text" class="form-control" id="bfCategory"
                     value="${escHtml(badge?.category ?? 'general')}">
            </div>
            <div class="col-md-3">
              <label class="form-label fw-semibold">Icon URL</label>
              <input type="text" class="form-control" id="bfIconUrl" placeholder="/uploads/badge.png"
                     value="${escHtml(badge?.icon_url ?? '')}">
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Description</label>
              <textarea class="form-control" id="bfDesc" rows="2">${escHtml(badge?.description ?? '')}</textarea>
            </div>
          </div>
          <div class="mt-3">
            <button type="submit" class="btn btn-primary me-2">
              <span class="spinner-border spinner-border-sm me-1 d-none" id="bfSpinner"></span>
              ${isEdit ? 'Save changes' : 'Create badge'}
            </button>
            <button type="button" class="btn btn-light btn-cancel-badge-form">Cancel</button>
          </div>
        </form>
      </div>
    </div>`
}

function awardFormHtml(badgeId, badgeName) {
  return `
    <div class="card shadow border-warning">
      <div class="card-header py-3 d-flex justify-content-between align-items-center bg-warning-subtle">
        <h6 class="m-0 fw-bold">Award "${escHtml(badgeName)}"</h6>
        <button class="btn btn-sm btn-light" id="btnCancelAward">Cancel</button>
      </div>
      <div class="card-body">
        <form id="awardForm" data-badge-id="${badgeId}">
          <div class="row g-3 align-items-end">
            <div class="col-md-3">
              <label class="form-label fw-semibold">Type</label>
              <select class="form-select" id="afType">
                <option value="player">Player</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label fw-semibold">Recipient</label>
              <select class="form-select" id="afEntity">
                <option value="">Loading…</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Notes (optional)</label>
              <input type="text" class="form-control" id="afNotes" placeholder="e.g. Open 2026 champion">
            </div>
          </div>
          <div class="mt-3">
            <button type="submit" class="btn btn-warning fw-semibold">
              <span class="spinner-border spinner-border-sm me-1 d-none" id="afSpinner"></span>
              Award badge
            </button>
          </div>
        </form>
      </div>
    </div>`
}

let allBadges = []
let cache = { player: null, team: null }

export function mountBadgesList() {
  loadBadges()

  $(document).on('click.badges', '#btnNewBadge', function () {
    $('#badge-form-wrap').html(badgeFormHtml(null)).removeClass('d-none')
    $('#award-form-wrap').addClass('d-none')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $(document).on('click.badges', '.btn-cancel-badge-form', function () {
    $('#badge-form-wrap').addClass('d-none').empty()
  })

  $(document).on('input.badges', '#bfName', function () {
    const slug = $(this).val().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!$('#badgeForm').data('edit-id')) $('#bfSlug').val(slug)
  })

  $(document).on('submit.badges', '#badgeForm', function (e) {
    e.preventDefault()
    const editId = $(this).data('edit-id') || null
    const payload = {
      name:        $('#bfName').val().trim(),
      slug:        $('#bfSlug').val().trim(),
      category:    $('#bfCategory').val().trim() || 'general',
      icon_url:    $('#bfIconUrl').val().trim() || null,
      description: $('#bfDesc').val().trim() || null,
    }
    $('#bfSpinner').removeClass('d-none')
    const method = editId ? 'PATCH' : 'POST'
    const url    = editId ? `/admin/badges/${editId}` : '/admin/badges'
    apiRequest(url, { method, data: JSON.stringify(payload) })
      .then(function (res) {
        const badge = res.data
        if (editId) allBadges = allBadges.map(b => b.id === editId ? badge : b)
        else        allBadges = [badge, ...allBadges]
        $('#badges-table').html(renderBadgesTable(allBadges))
        $('#badge-form-wrap').addClass('d-none').empty()
      })
      .fail(function (xhr) {
        alert(xhr.responseJSON?.error?.message || 'Failed to save badge.')
      })
      .always(function () { $('#bfSpinner').addClass('d-none') })
  })

  $(document).on('click.badges', '.btn-edit-badge', function () {
    const id = $(this).data('id')
    const badge = allBadges.find(b => b.id === id)
    if (!badge) return
    $('#badge-form-wrap').html(badgeFormHtml(badge)).removeClass('d-none')
    $('#award-form-wrap').addClass('d-none')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $(document).on('click.badges', '.btn-delete-badge', function () {
    const id = $(this).data('id')
    if (!confirm('Delete this badge and all awards? This cannot be undone.')) return
    apiRequest(`/admin/badges/${id}`, { method: 'DELETE' })
      .then(function () {
        allBadges = allBadges.filter(b => b.id !== id)
        $('#badges-table').html(renderBadgesTable(allBadges))
      })
      .fail(function (xhr) { alert(xhr.responseJSON?.error?.message || 'Failed to delete badge.') })
  })

  $(document).on('click.badges', '.btn-award', function () {
    const badgeId = $(this).data('id')
    const badgeName = $(this).data('name')
    $('#award-form-wrap').html(awardFormHtml(badgeId, badgeName)).removeClass('d-none')
    $('#badge-form-wrap').addClass('d-none')
    loadEntities('player')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $(document).on('click.badges', '#btnCancelAward', function () {
    $('#award-form-wrap').addClass('d-none').empty()
  })

  $(document).on('change.badges', '#afType', function () {
    loadEntities($(this).val())
  })

  $(document).on('submit.badges', '#awardForm', function (e) {
    e.preventDefault()
    const badgeId  = $(this).data('badge-id')
    const type     = $('#afType').val()
    const entityId = $('#afEntity').val()
    const notes    = $('#afNotes').val().trim() || null
    if (!entityId) return alert('Please select a recipient.')
    const url = type === 'player' ? `/admin/players/${entityId}/badges` : `/admin/teams/${entityId}/badges`
    $('#afSpinner').removeClass('d-none')
    apiRequest(url, { method: 'POST', data: JSON.stringify({ badge_id: badgeId, notes }) })
      .then(function () {
        $('#award-form-wrap').addClass('d-none').empty()
        alert('Badge awarded successfully.')
      })
      .fail(function (xhr) { alert(xhr.responseJSON?.error?.message || 'Failed to award badge.') })
      .always(function () { $('#afSpinner').addClass('d-none') })
  })
}

function loadBadges() {
  apiRequest('/badges')
    .then(function (res) {
      allBadges = res?.data || []
      $('#badges-table').html(renderBadgesTable(allBadges))
    })
    .fail(function () {
      $('#badges-table').html(`<div class="text-center py-4 text-danger">Failed to load badges.</div>`)
    })
}

function loadEntities(type) {
  const el = document.getElementById('afEntity')
  if (!el) return
  if (cache[type]) { populateSelect(cache[type]); return }
  el.innerHTML = '<option value="">Loading…</option>'
  const url = type === 'player' ? '/admin/players' : '/admin/teams'
  apiRequest(url)
    .then(function (res) {
      cache[type] = res?.data || []
      populateSelect(cache[type])
    })
    .fail(function () { el.innerHTML = '<option value="">Failed to load</option>' })
}

function populateSelect(items) {
  const el = document.getElementById('afEntity')
  if (!el) return
  el.innerHTML = '<option value="">Select…</option>' +
    items.map(it => `<option value="${it.id}">${escHtml(it.name)}</option>`).join('')
}
