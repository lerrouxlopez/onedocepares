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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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

export function unmountLeaderboardAdmin() {
  $(document).off('.leaderboard')
}

export function renderLeaderboardAdmin() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Leaderboard</h1>
      <button class="btn btn-sm btn-primary shadow-sm" id="btnRebuild">
        <span class="spinner-border spinner-border-sm me-1 d-none" id="rebuildSpinner" role="status"></span>
        <i class="bi bi-arrow-clockwise me-1"></i> Rebuild Leaderboards
      </button>
    </div>
    <div id="rebuildAlert" class="d-none"></div>

    <ul class="nav nav-tabs mb-4" id="lbTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="tab-teams" data-bs-toggle="tab"
                data-bs-target="#panel-teams" type="button" role="tab">Teams</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tab-players" data-bs-toggle="tab"
                data-bs-target="#panel-players" type="button" role="tab">Players</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tab-feed" data-bs-toggle="tab"
                data-bs-target="#panel-feed" type="button" role="tab">Feed Moderation</button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="tab-comments" data-bs-toggle="tab"
                data-bs-target="#panel-comments" type="button" role="tab">Comments</button>
      </li>
    </ul>

    <div class="tab-content">
      <div class="tab-pane fade show active" id="panel-teams" role="tabpanel">
        ${buildLeaderboardPanel('team')}
      </div>
      <div class="tab-pane fade" id="panel-players" role="tabpanel">
        ${buildLeaderboardPanel('player')}
      </div>
      <div class="tab-pane fade" id="panel-feed" role="tabpanel">
        ${buildFeedPanel()}
      </div>
      <div class="tab-pane fade" id="panel-comments" role="tabpanel">
        ${buildCommentsPanel()}
      </div>
    </div>`
}

function buildLeaderboardPanel(type) {
  return `
    <div class="card shadow mb-4">
      <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">${type === 'team' ? 'Team' : 'Player'} Rankings</h6></div>
      <div class="card-body p-0">
        <div class="text-center py-4 text-muted" id="${type}LbLoading">
          <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>
        <div class="text-center py-4 text-muted d-none" id="${type}LbEmpty">
          <i class="bi bi-bar-chart display-4 d-block mb-2 text-gray-300"></i>
          <p class="small mb-2">No snapshot yet. Click <strong>Rebuild Leaderboards</strong> to generate rankings.</p>
        </div>
        <div class="table-responsive d-none" id="${type}LbTable">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th style="width:48px">Rank</th><th>Name</th><th class="text-end">Points</th><th class="text-end">W</th><th class="text-end">L</th><th class="text-end">D</th></tr>
            </thead>
            <tbody id="${type}LbBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function buildCommentsPanel() {
  return `
    <div class="card shadow mb-4">
      <div class="card-header py-3 d-flex justify-content-between align-items-center">
        <h6 class="m-0 fw-bold text-primary">Pending Comments</h6>
        <button class="btn btn-sm btn-outline-secondary" id="btnRefreshComments">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>
      <div class="card-body p-0">
        <div class="text-center py-4 text-muted" id="commentsLoading">
          <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>
        <div class="text-center py-4 text-muted d-none" id="commentsEmpty">
          <i class="bi bi-chat-check display-4 d-block mb-2 text-gray-300"></i>
          <p class="small mb-0">No pending comments.</p>
        </div>
        <div class="table-responsive d-none" id="commentsTable">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Comment</th><th>Feed item</th><th>Date</th><th class="text-end">Actions</th></tr>
            </thead>
            <tbody id="commentsBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function buildFeedPanel() {
  return `
    <div class="card shadow mb-4">
      <div class="card-header py-3"><h6 class="m-0 fw-bold text-primary">Activity Feed Items</h6></div>
      <div class="card-body p-0">
        <div class="text-center py-4 text-muted" id="feedModLoading">
          <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>
        <div class="text-center py-4 text-muted d-none" id="feedModEmpty">
          <p class="small mb-0">No feed items yet.</p>
        </div>
        <div class="table-responsive d-none" id="feedModTable">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Event</th><th>Title</th><th>Date</th><th>Visible</th><th class="text-end">Action</th></tr>
            </thead>
            <tbody id="feedModBody"></tbody>
          </table>
        </div>
      </div>
    </div>`
}

function loadLeaderboard(type) {
  $(`#${type}LbLoading`).removeClass('d-none')
  $(`#${type}LbTable, #${type}LbEmpty`).addClass('d-none')

  apiRequest(`/leaderboards/${type}s`)
    .then(function (res) {
      $(`#${type}LbLoading`).addClass('d-none')
      const entries = res?.data || []
      if (entries.length === 0) {
        $(`#${type}LbEmpty`).removeClass('d-none')
        return
      }
      $(`#${type}LbTable`).removeClass('d-none')
      document.getElementById(`${type}LbBody`).innerHTML = entries.map(e => `
        <tr>
          <td><span class="badge bg-secondary">#${e.rank}</span></td>
          <td class="fw-medium">
            <a href="/${type === 'team' ? 'team' : 'player'}.html?slug=${encodeURIComponent(e.entity_slug)}" class="text-decoration-none">
              ${escHtml(e.entity_name)}
            </a>
          </td>
          <td class="text-end fw-bold">${e.points}</td>
          <td class="text-end text-success small">${e.wins}</td>
          <td class="text-end text-danger small">${e.losses}</td>
          <td class="text-end text-muted small">${e.draws}</td>
        </tr>`).join('')
    })
    .fail(function () {
      $(`#${type}LbLoading`).addClass('d-none')
      $(`#${type}LbEmpty`).removeClass('d-none')
    })
}

let allComments = []
let allFeedItems = []

function loadFeedItems() {
  $('#feedModLoading').removeClass('d-none')
  $('#feedModTable, #feedModEmpty').addClass('d-none')

  apiRequest('/feed?per_page=50')
    .then(function (res) {
      $('#feedModLoading').addClass('d-none')
      allFeedItems = res?.data || []
      renderFeedItems()
    })
    .fail(function () {
      $('#feedModLoading').addClass('d-none')
    })
}

function renderFeedItems() {
  const tbody = document.getElementById('feedModBody')
  if (!tbody) return
  if (allFeedItems.length === 0) {
    $('#feedModEmpty').removeClass('d-none')
    return
  }
  $('#feedModTable').removeClass('d-none')
  tbody.innerHTML = allFeedItems.map(f => `
    <tr>
      <td><span class="badge bg-light text-dark border small">${escHtml(f.event_type)}</span></td>
      <td class="small">${escHtml(f.title)}</td>
      <td class="text-muted small">${fmtDate(f.created_at)}</td>
      <td>${f.is_visible ? '<span class="badge bg-success">Visible</span>' : '<span class="badge bg-secondary">Hidden</span>'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary btn-toggle-feed"
                data-id="${f.id}" data-visible="${f.is_visible ? 'true' : 'false'}">
          ${f.is_visible ? 'Hide' : 'Show'}
        </button>
      </td>
    </tr>`).join('')
}

function loadComments() {
  $('#commentsLoading').removeClass('d-none')
  $('#commentsTable, #commentsEmpty').addClass('d-none')

  apiRequest('/admin/comments')
    .then(function (res) {
      $('#commentsLoading').addClass('d-none')
      allComments = res?.data || []
      renderComments()
    })
    .fail(function () {
      $('#commentsLoading').addClass('d-none')
    })
}

function renderComments() {
  const tbody = document.getElementById('commentsBody')
  if (!tbody) return
  if (allComments.length === 0) {
    $('#commentsEmpty').removeClass('d-none')
    return
  }
  $('#commentsTable').removeClass('d-none')
  tbody.innerHTML = allComments.map(c => `
    <tr>
      <td class="small" style="max-width:300px">${escHtml(c.body)}</td>
      <td class="text-muted small">${escHtml(c.feed_item_id ?? '—')}</td>
      <td class="text-muted small">${fmtDate(c.created_at)}</td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-success btn-approve-comment me-1" data-id="${c.id}">
          <i class="bi bi-check-lg me-1"></i> Approve
        </button>
        <button class="btn btn-sm btn-outline-danger btn-reject-comment" data-id="${c.id}">
          <i class="bi bi-x-lg me-1"></i> Reject
        </button>
      </td>
    </tr>`).join('')
}

export function mountLeaderboardAdmin() {
  loadLeaderboard('team')
  loadLeaderboard('player')
  loadFeedItems()
  loadComments()

  $(document).on('click.leaderboard', '#btnRebuild', function () {
    if (!confirm('Rebuild both team and player leaderboards from current stats? This creates new snapshots.')) return
    $('#rebuildSpinner').removeClass('d-none')
    $('#btnRebuild').prop('disabled', true)
    apiRequest('/admin/leaderboards/rebuild', { method: 'POST' })
      .then(function () {
        showToast('Leaderboards rebuilt successfully.')
        loadLeaderboard('team')
        loadLeaderboard('player')
      })
      .fail(function (xhr) {
        showToast(xhr?.responseJSON?.error?.message || 'Rebuild failed.', 'error')
      })
      .always(function () {
        $('#rebuildSpinner').addClass('d-none')
        $('#btnRebuild').prop('disabled', false)
      })
  })

  $(document).on('click.leaderboard', '.btn-toggle-feed', function () {
    const id = $(this).data('id')
    const isCurrentlyVisible = $(this).data('visible') === 'true'
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/feed/${id}`, {
      method: 'PATCH',
      data: { is_visible: !isCurrentlyVisible },
    })
      .then(function (res) {
        const updated = res?.data
        if (!updated) return
        const idx = allFeedItems.findIndex(f => f.id === id)
        if (idx !== -1) allFeedItems[idx] = updated
        renderFeedItems()
        showToast(updated.is_visible ? 'Feed item shown.' : 'Feed item hidden.')
      })
      .fail(function () {
        showToast('Failed to update feed item.', 'error')
        $btn.prop('disabled', false)
      })
  })

  $(document).on('click.leaderboard', '#btnRefreshComments', function () {
    loadComments()
  })

  $(document).on('click.leaderboard', '.btn-approve-comment, .btn-reject-comment', function () {
    const id = $(this).data('id')
    const status = $(this).hasClass('btn-approve-comment') ? 'approved' : 'rejected'
    const $btn = $(this).prop('disabled', true)
    apiRequest(`/admin/comments/${id}`, { method: 'PATCH', data: { status } })
      .then(function () {
        allComments = allComments.filter(c => c.id !== id)
        renderComments()
        showToast(`Comment ${status}.`)
      })
      .fail(function () {
        showToast('Failed to update comment.', 'error')
        $btn.prop('disabled', false)
      })
  })
}
