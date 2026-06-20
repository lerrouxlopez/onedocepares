const NAV_ITEMS = [
  { key: 'dashboard',     label: 'Dashboard',     icon: 'bi-grid'              },
  { key: 'pages',         label: 'Pages',         icon: 'bi-file-earmark-text' },
  { key: 'media',         label: 'Media',         icon: 'bi-images'            },
  { key: 'teams',         label: 'Teams',         icon: 'bi-people'            },
  { key: 'players',       label: 'Players',       icon: 'bi-person-badge'      },
  { key: 'tournaments',   label: 'Tournaments',   icon: 'bi-trophy'            },
  { key: 'registrations', label: 'Registrations', icon: 'bi-clipboard-check'   },
  { key: 'leaderboard',   label: 'Leaderboard',   icon: 'bi-bar-chart-line'    },
  { key: 'badges',        label: 'Badges',        icon: 'bi-award'             },
  { key: 'settings',      label: 'Settings',      icon: 'bi-sliders'           },
]

// pages route is handled dynamically by admin-router.js + cms.js
const PAGE_VIEWS = {
  dashboard: () => `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Dashboard</h1>
      <a href="/admin/pages" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-file-earmark-plus me-1"></i> Open CMS Pages
      </a>
    </div>
    <div class="row">
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="card border-left-primary shadow h-100 py-2">
          <div class="card-body">
            <div class="row no-gutters align-items-center">
              <div class="col me-2">
                <div class="text-xs fw-bold text-primary text-uppercase mb-1">Phase</div>
                <div class="h5 mb-0 fw-bold text-gray-800">4 — Social &amp; Advanced</div>
              </div>
              <div class="col-auto"><i class="bi bi-people fs-2 text-gray-300"></i></div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="card border-left-success shadow h-100 py-2">
          <div class="card-body">
            <div class="row no-gutters align-items-center">
              <div class="col me-2">
                <div class="text-xs fw-bold text-success text-uppercase mb-1">Status</div>
                <div class="h5 mb-0 fw-bold text-gray-800">Auth + CMS live</div>
              </div>
              <div class="col-auto"><i class="bi bi-shield-check fs-2 text-gray-300"></i></div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="card border-left-info shadow h-100 py-2">
          <div class="card-body">
            <div class="row no-gutters align-items-center">
              <div class="col me-2">
                <div class="text-xs fw-bold text-info text-uppercase mb-1">Next workflow</div>
                <div class="h5 mb-0 fw-bold text-gray-800">Tournaments</div>
              </div>
              <div class="col-auto"><i class="bi bi-trophy fs-2 text-gray-300"></i></div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="card border-left-warning shadow h-100 py-2">
          <div class="card-body">
            <div class="row no-gutters align-items-center">
              <div class="col me-2">
                <div class="text-xs fw-bold text-warning text-uppercase mb-1">Mode</div>
                <div class="h5 mb-0 fw-bold text-gray-800">Admin-first</div>
              </div>
              <div class="col-auto"><i class="bi bi-person-gear fs-2 text-gray-300"></i></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-lg-8 mb-4">
        <div class="card shadow mb-4">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Build roadmap</h6>
          </div>
          <div class="card-body">
            <div class="mb-4">
              <div class="d-flex justify-content-between small mb-1">
                <span class="fw-bold">Auth + Session</span><span class="text-success">Complete</span>
              </div>
              <div class="progress" style="height:8px">
                <div class="progress-bar bg-success" style="width:100%"></div>
              </div>
            </div>
            <div class="mb-4">
              <div class="d-flex justify-content-between small mb-1">
                <span class="fw-bold">CMS Pages + Media</span><span class="text-success">Complete</span>
              </div>
              <div class="progress" style="height:8px">
                <div class="progress-bar bg-success" style="width:100%"></div>
              </div>
            </div>
            <div class="mb-4">
              <div class="d-flex justify-content-between small mb-1">
                <span class="fw-bold">Teams, Players &amp; Tournaments</span><span class="text-success">Complete</span>
              </div>
              <div class="progress" style="height:8px">
                <div class="progress-bar bg-success" style="width:100%"></div>
              </div>
            </div>
            <div class="mb-4">
              <div class="d-flex justify-content-between small mb-1">
                <span class="fw-bold">Registrations + Leaderboards</span><span class="text-success">Complete</span>
              </div>
              <div class="progress" style="height:8px">
                <div class="progress-bar bg-success" style="width:100%"></div>
              </div>
            </div>
            <div class="mb-0">
              <div class="d-flex justify-content-between small mb-1">
                <span class="fw-bold">Badges, Matches, Calendar, Social</span><span class="text-primary">In progress</span>
              </div>
              <div class="progress" style="height:8px">
                <div class="progress-bar bg-primary" style="width:65%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 mb-4">
        <div class="card shadow mb-4">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Quick links</h6>
          </div>
          <div class="card-body">
            <a href="/admin/pages" class="btn btn-primary btn-sm d-block mb-2">
              <i class="bi bi-file-earmark-text me-1"></i> CMS Pages
            </a>
            <a href="/admin/teams" class="btn btn-outline-primary btn-sm d-block mb-2">
              <i class="bi bi-people me-1"></i> Teams
            </a>
            <a href="/admin/players" class="btn btn-outline-primary btn-sm d-block mb-2">
              <i class="bi bi-person-badge me-1"></i> Players
            </a>
            <a href="/admin/tournaments" class="btn btn-outline-primary btn-sm d-block mb-2">
              <i class="bi bi-trophy me-1"></i> Tournaments
            </a>
            <a href="/admin/media" class="btn btn-info btn-sm d-block mb-2 text-white">
              <i class="bi bi-images me-1"></i> Media Library
            </a>
            <a href="/" class="btn btn-outline-dark btn-sm d-block">
              <i class="bi bi-globe me-1"></i> Public site
            </a>
          </div>
        </div>
      </div>
    </div>
  `,

  media: () => `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Media</h1>
      <button class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm" disabled>
        <i class="bi bi-cloud-upload me-1"></i> Upload Assets
      </button>
    </div>
    <div class="row">
      <div class="col-lg-6 mb-4">
        <div class="card shadow">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Planned capabilities</h6>
          </div>
          <div class="card-body">
            <ul class="list-unstyled mb-0">
              <li class="mb-2"><i class="bi bi-arrow-up-circle text-primary me-2"></i>Upload queue with progress and validation</li>
              <li class="mb-2"><i class="bi bi-grid text-primary me-2"></i>Asset grid and detail drawer</li>
              <li class="mb-2"><i class="bi bi-link-45deg text-primary me-2"></i>Usage references across pages, teams, and players</li>
              <li class="mb-0"><i class="bi bi-cloud text-primary me-2"></i>Storage abstraction for S3-compatible backends</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="col-lg-6 mb-4">
        <div class="card shadow">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Design direction</h6>
          </div>
          <div class="card-body">
            <p class="mb-0">Keep the UI operational and browseable first: clear file states, strong filtering, and predictable insertion into editors.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="card shadow">
      <div class="card-body text-center py-5">
        <i class="bi bi-images display-4 d-block mb-3 text-gray-300"></i>
        <p class="fw-bold mb-1 text-gray-800">Media library not yet implemented</p>
        <p class="small text-gray-600 mb-0">Check back when the CMS pages workflow is live.</p>
      </div>
    </div>
  `,

  settings: () => `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Settings</h1>
      <button class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm" disabled>
        <i class="bi bi-floppy me-1"></i> Save Changes
      </button>
    </div>
    <div class="row">
      <div class="col-md-6 mb-4">
        <div class="card shadow h-100">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Brand and identity</h6>
          </div>
          <div class="card-body">
            <p class="text-gray-600 mb-0">Site title, logos, theme accents, and homepage messaging.</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 mb-4">
        <div class="card shadow h-100">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Navigation and SEO</h6>
          </div>
          <div class="card-body">
            <p class="text-gray-600 mb-0">Menu structure, default metadata, social cards, and indexing controls.</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 mb-4">
        <div class="card shadow h-100">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Organization profile</h6>
          </div>
          <div class="card-body">
            <p class="text-gray-600 mb-0">Federation details, contact info, and tournament-facing settings.</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 mb-4">
        <div class="card shadow h-100">
          <div class="card-header py-3">
            <h6 class="m-0 fw-bold text-primary">Permissions</h6>
          </div>
          <div class="card-body">
            <p class="text-gray-600 mb-0">Role-sensitive options surface here only when the auth layer is active.</p>
          </div>
        </div>
      </div>
    </div>
  `,
}

function buildNavItems(activeKey) {
  return NAV_ITEMS.map(item => `
    <li class="nav-item${item.key === activeKey ? ' active' : ''}">
      <a class="nav-link" href="/admin/${item.key}">
        <i class="bi ${item.icon} me-2"></i>
        <span>${item.label}</span>
      </a>
    </li>
  `).join('')
}

export function getCurrentRoute() {
  const rest = window.location.pathname.replace(/^\/admin\/?/, '')
  const topKey = rest.split('/')[0] || 'dashboard'
  return PAGE_VIEWS[topKey] ? topKey : 'dashboard'
}

export function renderShell(user) {
  const year = new Date().getFullYear()
  const displayName = user?.data?.name || 'Admin'

  return `
    <div id="wrapper">
      <ul class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">
        <a class="sidebar-brand d-flex align-items-center justify-content-center" href="/admin/dashboard">
          <div class="sidebar-brand-icon">
            <i class="bi bi-shield-fill"></i>
          </div>
          <div class="sidebar-brand-text mx-3">ODP Admin</div>
        </a>
        <hr class="sidebar-divider my-0">
        ${buildNavItems('dashboard')}
        <hr class="sidebar-divider d-none d-md-block">
        <div class="text-center d-none d-md-inline">
          <button class="rounded-circle border-0" id="sidebarToggle">
            <i class="bi bi-chevron-left" id="sidebarToggleIcon"></i>
          </button>
        </div>
      </ul>

      <div id="content-wrapper" class="d-flex flex-column">
        <div id="content">
          <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow">
            <button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle me-3">
              <i class="bi bi-list fs-5"></i>
            </button>
            <ul class="navbar-nav ms-auto">
              <div class="topbar-divider d-none d-sm-block"></div>
              <li class="nav-item dropdown no-arrow">
                <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button"
                   data-bs-toggle="dropdown" aria-expanded="false">
                  <span class="me-2 d-none d-lg-inline text-gray-600 small">${displayName}</span>
                  <i class="bi bi-person-circle fs-5 text-gray-600"></i>
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow animated--grow-in" aria-labelledby="userDropdown">
                  <li>
                    <a class="dropdown-item" href="/admin/settings">
                      <i class="bi bi-gear me-2 text-gray-400"></i>Settings
                    </a>
                  </li>
                  <li><hr class="dropdown-divider"></li>
                  <li>
                    <a class="dropdown-item" href="#" data-bs-toggle="modal" data-bs-target="#logoutModal">
                      <i class="bi bi-box-arrow-right me-2 text-gray-400"></i>Logout
                    </a>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>

          <div class="container-fluid" id="page-content"></div>
        </div>

        <footer class="sticky-footer bg-white">
          <div class="container my-auto">
            <div class="copyright text-center my-auto">
              <span>Copyright &copy; One Doce Pares ${year}</span>
            </div>
          </div>
        </footer>
      </div>
    </div>

    <a class="scroll-to-top rounded" id="scrollToTop" href="#page-top" style="display:none">
      <i class="bi bi-chevron-up"></i>
    </a>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:1100"
         id="toastContainer" aria-live="polite" aria-atomic="true"></div>

    <div class="modal fade" id="logoutModal" tabindex="-1" aria-labelledby="logoutModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="logoutModalLabel">Ready to leave?</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">Select "Logout" to end your session.</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmLogout">Logout</button>
          </div>
        </div>
      </div>
    </div>
  `
}

export function renderPageContent(routeKey) {
  return (PAGE_VIEWS[routeKey] || PAGE_VIEWS.dashboard)()
}

export function updateNavActiveState(routeKey) {
  document.querySelectorAll('#accordionSidebar .nav-item').forEach(el => {
    const link = el.querySelector('.nav-link')
    if (!link) return
    const isActive = link.getAttribute('href') === `/admin/${routeKey}`
    el.classList.toggle('active', isActive)
  })
}
