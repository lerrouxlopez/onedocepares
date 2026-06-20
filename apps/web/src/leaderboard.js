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

function rankIcon(rank) {
  if (rank === 1) return '<span class="text-warning fs-5" title="1st">🥇</span>'
  if (rank === 2) return '<span class="text-secondary fs-5" title="2nd">🥈</span>'
  if (rank === 3) return '<span class="text-warning-dark fs-5" title="3rd">🥉</span>'
  return `<span class="badge bg-secondary rounded-pill">#${rank}</span>`
}

function renderLeaderboard(entries, type) {
  const linkPrefix = type === 'team' ? '/team.html' : '/player.html'
  if (entries.length === 0) {
    return `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-bar-chart display-4 d-block mb-3 text-secondary"></i>
        <p class="fw-bold mb-1">No rankings yet</p>
        <p class="small mb-0">Rankings will appear after the first tournament cycle and leaderboard rebuild.</p>
      </div>`
  }

  const rows = entries.map(e => `
    <tr>
      <td class="text-center" style="width:56px">${rankIcon(e.rank)}</td>
      <td>
        <a class="fw-bold text-decoration-none" href="${linkPrefix}?slug=${encodeURIComponent(e.entity_slug)}">
          ${escHtml(e.entity_name)}
        </a>
      </td>
      <td class="text-end fw-bold fs-5">${e.points}</td>
      <td class="text-end text-success">${e.wins}</td>
      <td class="text-end text-danger">${e.losses}</td>
      <td class="text-end text-muted">${e.draws}</td>
    </tr>`).join('')

  return `
    <div class="card shadow-sm">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th class="text-center">Rank</th>
                <th>${type === 'team' ? 'Team' : 'Player'}</th>
                <th class="text-end">Points</th>
                <th class="text-end"><abbr title="Wins">W</abbr></th>
                <th class="text-end"><abbr title="Losses">L</abbr></th>
                <th class="text-end"><abbr title="Draws">D</abbr></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`
}

function loadLeaderboard(type, containerId) {
  apiRequest(`/leaderboards/${type}s`)
    .then(function (res) {
      document.getElementById(containerId).innerHTML =
        renderLeaderboard(res?.data || [], type)
    })
    .fail(function () {
      document.getElementById(containerId).innerHTML = `
        <div class="text-center py-5 text-danger">
          <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
          <p class="mb-0">Failed to load rankings.</p>
        </div>`
    })
}

loadLeaderboard('team', 'teams-leaderboard')
loadLeaderboard('player', 'players-leaderboard')
