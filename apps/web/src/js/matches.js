import $ from 'jquery'
import { apiRequest } from './api'

export function unmountMatches() {
  $(document).off('.matches')
}

export function renderMatchesList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <div>
        <a href="#" id="btnBackToTournament" class="btn btn-sm btn-outline-secondary me-2">
          <i class="bi bi-arrow-left me-1"></i> Back to tournament
        </a>
        <span class="h3 mb-0 text-gray-800" id="matchesTournamentName">Matches</span>
      </div>
      <button id="btnAddMatch" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-plus-circle me-1"></i> Add Match
      </button>
    </div>
    <div id="add-match-form" class="d-none mb-4"></div>
    <div id="result-form-wrap" class="d-none mb-4"></div>
    <div class="card shadow">
      <div class="card-body p-0">
        <div id="matches-table">
          <div class="text-center py-5 text-muted">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <p class="mb-0">Loading matches…</p>
          </div>
        </div>
      </div>
    </div>`
}

function escHtml(str) {
  return $('<div>').text(String(str ?? '')).html()
}

const STATUS_BADGE = {
  scheduled:   'bg-secondary',
  in_progress: 'bg-warning text-dark',
  completed:   'bg-success',
  cancelled:   'bg-danger',
}

function renderMatchesTable(matches) {
  if (!matches.length) {
    return `<div class="text-center py-5 text-muted">
      <i class="bi bi-diagram-3 display-4 d-block mb-3 text-secondary"></i>
      <p class="fw-bold mb-0">No matches yet.</p>
      <p class="small">Add matches to build the bracket.</p>
    </div>`
  }
  return `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr><th>Round</th><th>#</th><th>Team 1</th><th>Team 2</th>
              <th>Status</th><th>Scheduled</th><th class="text-end">Actions</th></tr>
        </thead>
        <tbody>
          ${matches.map(m => {
            const cls = STATUS_BADGE[m.status] || 'bg-secondary'
            const sched = m.scheduled_at
              ? new Date(m.scheduled_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
              : '—'
            return `
              <tr>
                <td>${escHtml(m.round)}</td>
                <td>${escHtml(String(m.match_number))}</td>
                <td>${escHtml(m.team1_name ?? 'TBD')}</td>
                <td>${escHtml(m.team2_name ?? 'TBD')}</td>
                <td><span class="badge ${cls}">${m.status}</span></td>
                <td class="small">${sched}</td>
                <td class="text-end text-nowrap">
                  ${m.status !== 'completed' && m.status !== 'cancelled'
                    ? `<button class="btn btn-sm btn-success btn-record-result me-1"
                               data-id="${m.id}"
                               data-t1="${escHtml(m.team1_name ?? 'Team 1')}"
                               data-t2="${escHtml(m.team2_name ?? 'Team 2')}"
                               data-t1id="${m.team1_id ?? ''}"
                               data-t2id="${m.team2_id ?? ''}">
                        <i class="bi bi-trophy me-1"></i> Result
                      </button>`
                    : ''}
                  <button class="btn btn-sm btn-outline-danger btn-cancel-match" data-id="${m.id}"
                          ${m.status === 'completed' || m.status === 'cancelled' ? 'disabled' : ''}>
                    <i class="bi bi-x"></i>
                  </button>
                </td>
              </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
}

function addMatchFormHtml(tournamentId) {
  return `
    <div class="card shadow border-primary">
      <div class="card-header py-3 d-flex justify-content-between align-items-center">
        <h6 class="m-0 fw-bold text-primary">New Match</h6>
        <button class="btn btn-sm btn-light" id="btnCancelAddMatch">Cancel</button>
      </div>
      <div class="card-body">
        <form id="addMatchForm" data-tournament="${tournamentId}">
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label fw-semibold">Round *</label>
              <input type="text" class="form-control" id="amRound" required
                     placeholder="e.g. Quarter-final" list="roundSuggestions">
              <datalist id="roundSuggestions">
                <option>Round 1</option><option>Round 2</option>
                <option>Quarter-final</option><option>Semi-final</option><option>Final</option>
              </datalist>
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">Match #</label>
              <input type="number" class="form-control" id="amNumber" value="1" min="1">
            </div>
            <div class="col-md-3">
              <label class="form-label fw-semibold">Team 1</label>
              <select class="form-select" id="amTeam1">
                <option value="">TBD</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label fw-semibold">Team 2</label>
              <select class="form-select" id="amTeam2">
                <option value="">TBD</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Scheduled at</label>
              <input type="datetime-local" class="form-control" id="amScheduled">
            </div>
          </div>
          <div class="mt-3">
            <button type="submit" class="btn btn-primary me-2">
              <span class="spinner-border spinner-border-sm me-1 d-none" id="amSpinner"></span>
              Add match
            </button>
            <button type="button" class="btn btn-light" id="btnCancelAddMatch2">Cancel</button>
          </div>
        </form>
      </div>
    </div>`
}

function resultFormHtml(matchId, t1Name, t2Name, t1Id, t2Id) {
  return `
    <div class="card shadow border-success">
      <div class="card-header py-3 d-flex justify-content-between align-items-center bg-success-subtle">
        <h6 class="m-0 fw-bold">Record Result</h6>
        <button class="btn btn-sm btn-light" id="btnCancelResult">Cancel</button>
      </div>
      <div class="card-body">
        <form id="resultForm" data-match="${matchId}" data-t1id="${t1Id}" data-t2id="${t2Id}">
          <p class="mb-2 fw-semibold">${escHtml(t1Name)} vs ${escHtml(t2Name)}</p>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label fw-semibold">Winner</label>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="winner" id="winT1"
                       value="${t1Id}" ${t1Id ? '' : 'disabled'}>
                <label class="form-check-label" for="winT1">${escHtml(t1Name)}</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="winner" id="winT2"
                       value="${t2Id}" ${t2Id ? '' : 'disabled'}>
                <label class="form-check-label" for="winT2">${escHtml(t2Name)}</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="winner" id="winNone" value="">
                <label class="form-check-label" for="winNone">No winner / draw</label>
              </div>
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">${escHtml(t1Name)} score</label>
              <input type="number" class="form-control" id="rfScore1" min="0">
            </div>
            <div class="col-md-2">
              <label class="form-label fw-semibold">${escHtml(t2Name)} score</label>
              <input type="number" class="form-control" id="rfScore2" min="0">
            </div>
            <div class="col-md-4">
              <label class="form-label fw-semibold">Notes</label>
              <input type="text" class="form-control" id="rfNotes">
            </div>
          </div>
          <div class="mt-3">
            <button type="submit" class="btn btn-success fw-semibold">
              <span class="spinner-border spinner-border-sm me-1 d-none" id="rfSpinner"></span>
              Record result
            </button>
          </div>
        </form>
      </div>
    </div>`
}

let allMatches = []
let allTeams = []

export function mountMatchesList(tournamentId) {
  $('#btnBackToTournament').attr('href', `/admin/tournaments/${tournamentId}`)

  // Load tournament name
  apiRequest(`/admin/tournaments/${tournamentId}`)
    .then(function (res) {
      $('#matchesTournamentName').text('Matches — ' + (res?.data?.name ?? ''))
    })
    .fail(function () {})

  loadMatches(tournamentId)
  loadTeams(tournamentId)

  $(document).on('click.matches', '#btnAddMatch', function () {
    $('#add-match-form').html(addMatchFormHtml(tournamentId)).removeClass('d-none')
    $('#result-form-wrap').addClass('d-none')
    populateTeamDropdowns()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $(document).on('click.matches', '#btnCancelAddMatch, #btnCancelAddMatch2', function () {
    $('#add-match-form').addClass('d-none').empty()
  })

  $(document).on('submit.matches', '#addMatchForm', function (e) {
    e.preventDefault()
    const round = $('#amRound').val().trim()
    const matchNum = parseInt($('#amNumber').val(), 10) || 1
    const team1Id = $('#amTeam1').val() || null
    const team2Id = $('#amTeam2').val() || null
    const scheduled = $('#amScheduled').val()
    const payload = {
      round,
      match_number: matchNum,
      team1_id: team1Id,
      team2_id: team2Id,
      scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
    }
    $('#amSpinner').removeClass('d-none')
    apiRequest(`/admin/tournaments/${tournamentId}/matches`, {
      method: 'POST',
      data: JSON.stringify(payload),
    })
      .then(function (res) {
        allMatches = [...allMatches, res.data]
        $('#matches-table').html(renderMatchesTable(allMatches))
        $('#add-match-form').addClass('d-none').empty()
      })
      .fail(function (xhr) { alert(xhr.responseJSON?.error?.message || 'Failed to add match.') })
      .always(function () { $('#amSpinner').addClass('d-none') })
  })

  $(document).on('click.matches', '.btn-record-result', function () {
    const matchId = $(this).data('id')
    const t1Name  = $(this).data('t1')
    const t2Name  = $(this).data('t2')
    const t1Id    = $(this).data('t1id')
    const t2Id    = $(this).data('t2id')
    $('#result-form-wrap').html(resultFormHtml(matchId, t1Name, t2Name, t1Id, t2Id)).removeClass('d-none')
    $('#add-match-form').addClass('d-none')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  $(document).on('click.matches', '#btnCancelResult', function () {
    $('#result-form-wrap').addClass('d-none').empty()
  })

  $(document).on('submit.matches', '#resultForm', function (e) {
    e.preventDefault()
    const matchId  = $(this).data('match')
    const winnerId = $('input[name="winner"]:checked').val() || null
    const score1   = $('#rfScore1').val() !== '' ? parseInt($('#rfScore1').val(), 10) : null
    const score2   = $('#rfScore2').val() !== '' ? parseInt($('#rfScore2').val(), 10) : null
    const notes    = $('#rfNotes').val().trim() || null
    const payload  = { winner_team_id: winnerId, team1_score: score1, team2_score: score2, notes }
    $('#rfSpinner').removeClass('d-none')
    apiRequest(`/admin/matches/${matchId}/result`, { method: 'POST', data: JSON.stringify(payload) })
      .then(function () {
        allMatches = allMatches.map(m => m.id === matchId ? { ...m, status: 'completed' } : m)
        $('#matches-table').html(renderMatchesTable(allMatches))
        $('#result-form-wrap').addClass('d-none').empty()
      })
      .fail(function (xhr) { alert(xhr.responseJSON?.error?.message || 'Failed to record result.') })
      .always(function () { $('#rfSpinner').addClass('d-none') })
  })

  $(document).on('click.matches', '.btn-cancel-match', function () {
    const matchId = $(this).data('id')
    if (!confirm('Cancel this match?')) return
    apiRequest(`/admin/matches/${matchId}`, {
      method: 'PATCH',
      data: JSON.stringify({ status: 'cancelled' }),
    })
      .then(function () {
        allMatches = allMatches.map(m => m.id === matchId ? { ...m, status: 'cancelled' } : m)
        $('#matches-table').html(renderMatchesTable(allMatches))
      })
      .fail(function (xhr) { alert(xhr.responseJSON?.error?.message || 'Failed to cancel match.') })
  })
}

function loadMatches(tournamentId) {
  apiRequest(`/admin/tournaments/${tournamentId}/matches`)
    .then(function (res) {
      allMatches = res?.data || []
      $('#matches-table').html(renderMatchesTable(allMatches))
    })
    .fail(function () {
      $('#matches-table').html(`<div class="text-center py-4 text-danger">Failed to load matches.</div>`)
    })
}

function loadTeams(tournamentId) {
  // Load teams from tournament registrations (approved)
  apiRequest(`/admin/registrations?tournament_id=${tournamentId}`)
    .then(function (res) {
      const regs = (res?.data || []).filter(r => ['approved', 'checked_in', 'completed'].includes(r.status))
      allTeams = regs.map(r => ({ id: r.team_id, name: r.team_name }))
    })
    .fail(function () {
      // Fallback: load all teams
      apiRequest('/admin/teams').then(function (res) {
        allTeams = res?.data || []
      })
    })
}

function populateTeamDropdowns() {
  const opts = '<option value="">TBD</option>' +
    allTeams.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')
  $('#amTeam1').html(opts)
  $('#amTeam2').html(opts)
}
