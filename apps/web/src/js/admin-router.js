import $ from 'jquery'
import { Toast } from 'bootstrap'
import { getCurrentRoute, renderShell, renderPageContent, updateNavActiveState } from './admin-shell'
import { fetchCsrfToken, getMe, logout } from './auth'
import { renderPagesList, renderPageForm, mountPagesList, mountPageForm, unmountCms } from './cms'
import { renderMediaLibrary, mountMediaLibrary, unmountMedia } from './media'
import { renderSettings, mountSettings, unmountSettings } from './settings'
import { renderTeamsList, renderTeamForm, mountTeamsList, mountTeamForm, unmountTeams } from './teams'
import { renderPlayersList, renderPlayerForm, mountPlayersList, mountPlayerForm, unmountPlayers } from './players'
import { renderTournamentsList, renderTournamentForm, mountTournamentsList, mountTournamentForm, unmountTournaments } from './tournaments'
import { renderRegistrationsList, mountRegistrationsList, unmountRegistrations } from './registrations'
import { renderLeaderboardAdmin, mountLeaderboardAdmin, unmountLeaderboardAdmin } from './leaderboard-admin'
import { renderBadgesList, mountBadgesList, unmountBadges } from './badges'
import { renderMatchesList, mountMatchesList, unmountMatches } from './matches'

export function mountAdminApp(root) {
  fetchCsrfToken()
    .then(function () { return getMe() })
    .then(function (user) { bootShell(root, user) })
    .fail(function (xhr) {
      if (xhr && (xhr.status === 401 || xhr.status === 403)) {
        window.location.href = '/login.html'
      } else {
        bootShell(root, null)
      }
    })
}

function showGlobalToast(message, type = 'error') {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const id = `toast-${Date.now()}`
  const bg = type === 'error' ? 'bg-danger' : 'bg-success'
  container.insertAdjacentHTML(
    'beforeend',
    `<div id="${id}" class="toast align-items-center text-white ${bg} border-0"
          role="alert" aria-live="assertive" aria-atomic="true">
       <div class="d-flex">
         <div class="toast-body">${message}</div>
         <button type="button" class="btn-close btn-close-white me-2 m-auto"
                 data-bs-dismiss="toast" aria-label="Close"></button>
       </div>
     </div>`,
  )
  const el = document.getElementById(id)
  const t = new Toast(el, { delay: 4000 })
  el.addEventListener('hidden.bs.toast', () => el.remove())
  t.show()
}

// Parse route segments from the current pathname.
// /admin/                        → { topKey: 'dashboard', subKey: undefined, thirdKey: undefined }
// /admin/pages                   → { topKey: 'pages',     subKey: undefined, thirdKey: undefined }
// /admin/pages/new               → { topKey: 'pages',     subKey: 'new',     thirdKey: undefined }
// /admin/tournaments/:id/matches → { topKey: 'tournaments', subKey: ':id', thirdKey: 'matches' }
function parseRoute() {
  const rest = window.location.pathname.replace(/^\/admin\/?/, '')
  const parts = rest ? rest.split('/') : []
  return { topKey: parts[0] || 'dashboard', subKey: parts[1], thirdKey: parts[2] }
}

function bootShell(root, user) {
  root.innerHTML = renderShell(user)

  // Global API error toast
  document.addEventListener('odp:api-error', function (e) {
    showGlobalToast(e.detail?.message || 'An error occurred.')
  })

  // Sidebar toggle — desktop
  $('#sidebarToggle').on('click', function () {
    $('body').toggleClass('sidebar-toggled')
    $('.sidebar').toggleClass('toggled')
    const toggled = $('.sidebar').hasClass('toggled')
    $('#sidebarToggleIcon')
      .toggleClass('bi-chevron-left', !toggled)
      .toggleClass('bi-chevron-right', toggled)
    if (toggled) $('.sidebar .collapse').collapse('hide')
  })

  // Sidebar toggle — mobile
  $('#sidebarToggleTop').on('click', function () {
    $('body').toggleClass('sidebar-toggled')
    $('.sidebar').toggleClass('toggled')
  })

  // Scroll-to-top visibility
  $(window).on('scroll.admin', function () {
    $('#scrollToTop').toggle($(this).scrollTop() > 100)
  })

  // Logout
  $(document).on('click', '#confirmLogout', function () {
    logout().always(function () {
      window.location.href = '/login.html'
    })
  })

  // Intercept clicks on admin-internal links — use pushState instead of full navigation.
  // Skip links that Bootstrap controls (modal/offcanvas triggers, dismiss buttons).
  $(document).on('click.adminNav', 'a[href^="/admin"]', function (e) {
    if ($(this).is('[data-bs-toggle], [data-bs-dismiss]')) return
    e.preventDefault()
    const href = $(this).attr('href')
    if (href === window.location.pathname) return  // already here
    history.pushState({}, '', href)
    renderRoute()
  })

  // Back/forward browser navigation
  window.addEventListener('popstate', renderRoute)

  // Redirect bare /admin/ to /admin/dashboard on first load
  const path = window.location.pathname
  if (path === '/admin' || path === '/admin/') {
    history.replaceState({}, '', '/admin/dashboard')
  }

  renderRoute()
}

function renderRoute() {
  unmountCms()
  unmountMedia()
  unmountSettings()
  unmountTeams()
  unmountPlayers()
  unmountTournaments()
  unmountRegistrations()
  unmountLeaderboardAdmin()
  unmountBadges()
  unmountMatches()

  const { topKey, subKey, thirdKey } = parseRoute()
  const el = document.getElementById('page-content')
  if (!el) return

  if (topKey === 'pages') {
    if (subKey !== undefined) {
      el.innerHTML = renderPageForm()
      mountPageForm(subKey === 'new' ? null : subKey)
    } else {
      el.innerHTML = renderPagesList()
      mountPagesList()
    }
    updateNavActiveState('pages')
    document.title = 'ODP Admin | Pages'
    return
  }

  if (topKey === 'media') {
    el.innerHTML = renderMediaLibrary()
    mountMediaLibrary()
    updateNavActiveState('media')
    document.title = 'ODP Admin | Media'
    return
  }

  if (topKey === 'settings') {
    el.innerHTML = renderSettings()
    mountSettings()
    updateNavActiveState('settings')
    document.title = 'ODP Admin | Settings'
    return
  }

  if (topKey === 'teams') {
    if (subKey !== undefined) {
      el.innerHTML = renderTeamForm()
      mountTeamForm(subKey === 'new' ? null : subKey)
    } else {
      el.innerHTML = renderTeamsList()
      mountTeamsList()
    }
    updateNavActiveState('teams')
    document.title = 'ODP Admin | Teams'
    return
  }

  if (topKey === 'players') {
    if (subKey !== undefined) {
      el.innerHTML = renderPlayerForm()
      mountPlayerForm(subKey === 'new' ? null : subKey)
    } else {
      el.innerHTML = renderPlayersList()
      mountPlayersList()
    }
    updateNavActiveState('players')
    document.title = 'ODP Admin | Players'
    return
  }

  if (topKey === 'tournaments') {
    if (subKey !== undefined && thirdKey === 'matches') {
      el.innerHTML = renderMatchesList()
      mountMatchesList(subKey)
      updateNavActiveState('tournaments')
      document.title = 'ODP Admin | Matches'
    } else if (subKey !== undefined) {
      el.innerHTML = renderTournamentForm()
      mountTournamentForm(subKey === 'new' ? null : subKey)
      updateNavActiveState('tournaments')
      document.title = 'ODP Admin | Tournaments'
    } else {
      el.innerHTML = renderTournamentsList()
      mountTournamentsList()
      updateNavActiveState('tournaments')
      document.title = 'ODP Admin | Tournaments'
    }
    return
  }

  if (topKey === 'registrations') {
    el.innerHTML = renderRegistrationsList()
    mountRegistrationsList()
    updateNavActiveState('registrations')
    document.title = 'ODP Admin | Registrations'
    return
  }

  if (topKey === 'leaderboard') {
    el.innerHTML = renderLeaderboardAdmin()
    mountLeaderboardAdmin()
    updateNavActiveState('leaderboard')
    document.title = 'ODP Admin | Leaderboard'
    return
  }

  if (topKey === 'badges') {
    el.innerHTML = renderBadgesList()
    mountBadgesList()
    updateNavActiveState('badges')
    document.title = 'ODP Admin | Badges'
    return
  }

  const route = getCurrentRoute()
  el.innerHTML = renderPageContent(route)
  updateNavActiveState(route)
  document.title = `ODP Admin | ${route.charAt(0).toUpperCase()}${route.slice(1)}`
}
