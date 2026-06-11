const adminSections = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'grid',
    summary: 'Program pulse, milestone readiness, and quick links.',
  },
  {
    key: 'pages',
    label: 'Pages',
    icon: 'file-earmark-text',
    summary: 'Drafts, publishing workflow, and future page search.',
  },
  {
    key: 'media',
    label: 'Media',
    icon: 'images',
    summary: 'Asset library, uploads, and storage pipeline planning.',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'sliders',
    summary: 'Site identity, menus, SEO defaults, and org-level config.',
  },
]

const routeViews = {
  dashboard: {
    eyebrow: 'Admin overview',
    title: 'Operations dashboard',
    description:
      'Use this shell as the landing surface for CMS, tournament, and platform operations as Phase 1 comes online.',
    actions: `
      <a class="btn btn-primary" href="#/pages">Open CMS pages</a>
      <a class="btn btn-outline-dark" href="/">Public site</a>
    `,
    body: `
      <div class="row g-4">
        <div class="col-xl-8">
          <div class="shell-card rounded-4 p-4 h-100">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <div class="text-uppercase small fw-semibold text-secondary mb-2">Current foundation</div>
                <h2 class="h4 mb-1">Phase 0 is live and ready to extend</h2>
                <p class="text-secondary mb-0">The next frontend focus is auth and CMS workflows inside this admin shell.</p>
              </div>
              <span class="status-pill"><span class="status-dot"></span>Scaffold healthy</span>
            </div>
            <div class="row g-3">
              <div class="col-md-4">
                <div class="admin-metric rounded-4 p-3 h-100">
                  <div class="admin-metric__label">Priority</div>
                  <div class="admin-metric__value">Auth</div>
                  <div class="text-secondary small">Login, session, CSRF, and route protection.</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="admin-metric rounded-4 p-3 h-100">
                  <div class="admin-metric__label">First workflow</div>
                  <div class="admin-metric__value">CMS Pages</div>
                  <div class="text-secondary small">Pages list, editor, preview, publish states.</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="admin-metric rounded-4 p-3 h-100">
                  <div class="admin-metric__label">Platform mode</div>
                  <div class="admin-metric__value">Admin-first</div>
                  <div class="text-secondary small">Reliable internal tooling before self-service flows.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-xl-4">
          <div class="shell-card rounded-4 p-4 h-100">
            <div class="text-uppercase small fw-semibold text-secondary mb-3">Recommended order</div>
            <div class="d-grid gap-3">
              <div class="admin-step">
                <div class="admin-step__number">1</div>
                <div>
                  <div class="fw-semibold">Login and session checks</div>
                  <div class="text-secondary small">Connect the shell to auth state before adding protected screens.</div>
                </div>
              </div>
              <div class="admin-step">
                <div class="admin-step__number">2</div>
                <div>
                  <div class="fw-semibold">Pages list</div>
                  <div class="text-secondary small">Launch the first CRUD table with draft and publish signals.</div>
                </div>
              </div>
              <div class="admin-step">
                <div class="admin-step__number">3</div>
                <div>
                  <div class="fw-semibold">Page editor</div>
                  <div class="text-secondary small">Create the core content form and preview affordances.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  pages: {
    eyebrow: 'CMS workspace',
    title: 'Pages module',
    description:
      'This section is the first concrete admin workflow and will grow into the pages index, filters, and editing actions.',
    actions: `
      <a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>
      <button class="btn btn-outline-dark" type="button" disabled>Create page</button>
    `,
    body: `
      <div class="shell-card rounded-4 p-4">
        <div class="row g-4">
          <div class="col-lg-7">
            <h2 class="h4 mb-3">What this route should own next</h2>
            <div class="d-grid gap-3">
              <div class="admin-list-item">
                <div class="fw-semibold">Table and empty state</div>
                <div class="text-secondary">Draft, published, scheduled, and archived statuses with search.</div>
              </div>
              <div class="admin-list-item">
                <div class="fw-semibold">Page metadata</div>
                <div class="text-secondary">Slug, author, updated time, publish state, and preview link.</div>
              </div>
              <div class="admin-list-item">
                <div class="fw-semibold">Quick actions</div>
                <div class="text-secondary">Create, edit, preview, publish, unpublish, and archive actions.</div>
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="admin-callout rounded-4 p-4 h-100">
              <div class="text-uppercase small fw-semibold mb-2">Phase 1 fit</div>
              <p class="mb-3">Pages are the best first CRUD screen because they prove auth, forms, and public rendering without tournament complexity.</p>
              <a class="btn btn-dark" href="#/settings">See related settings</a>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  media: {
    eyebrow: 'Asset operations',
    title: 'Media module',
    description:
      'The media area will manage uploads, asset metadata, and eventually object storage integration for logos, photos, and CMS content.',
    actions: `
      <a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>
      <button class="btn btn-outline-dark" type="button" disabled>Upload assets</button>
    `,
    body: `
      <div class="row g-4">
        <div class="col-lg-6">
          <div class="shell-card rounded-4 p-4 h-100">
            <h2 class="h4 mb-3">Planned capabilities</h2>
            <ul class="admin-bullet-list">
              <li>Upload queue with progress and validation</li>
              <li>Asset grid and detail drawer</li>
              <li>Usage references across pages, teams, and players</li>
              <li>Storage abstraction for S3-compatible backends</li>
            </ul>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="shell-card rounded-4 p-4 h-100">
            <h2 class="h4 mb-3">Design direction</h2>
            <p class="text-secondary mb-0">Keep the UI operational and browseable first: clear file states, strong filtering, and predictable insertion into editors.</p>
          </div>
        </div>
      </div>
    `,
  },
  settings: {
    eyebrow: 'Platform configuration',
    title: 'Settings module',
    description:
      'This route will hold site-wide configuration like branding, menus, SEO defaults, and future organizational metadata.',
    actions: `
      <a class="btn btn-primary" href="#/dashboard">Back to dashboard</a>
      <button class="btn btn-outline-dark" type="button" disabled>Save settings</button>
    `,
    body: `
      <div class="shell-card rounded-4 p-4">
        <div class="row g-4">
          <div class="col-md-6">
            <div class="admin-list-item h-100">
              <div class="fw-semibold mb-2">Brand and identity</div>
              <div class="text-secondary">Site title, logos, theme accents, and homepage messaging.</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="admin-list-item h-100">
              <div class="fw-semibold mb-2">Navigation and SEO</div>
              <div class="text-secondary">Menu structure, default metadata, social cards, and indexing controls.</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="admin-list-item h-100">
              <div class="fw-semibold mb-2">Organization profile</div>
              <div class="text-secondary">Federation details, contact info, and tournament-facing settings.</div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="admin-list-item h-100">
              <div class="fw-semibold mb-2">Permissions touchpoints</div>
              <div class="text-secondary">Role-sensitive options should surface here only when the auth layer is active.</div>
            </div>
          </div>
        </div>
      </div>
    `,
  },
}

function icon(iconName) {
  return `<span class="admin-nav__icon" aria-hidden="true">${iconName.slice(0, 1).toUpperCase()}</span>`
}

export function getCurrentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return routeViews[hash] ? hash : 'dashboard'
}

export function renderAdminShell(routeKey) {
  const route = routeViews[routeKey]

  return `
    <div class="admin-app">
      <aside class="admin-sidebar">
        <div>
          <a class="admin-brand" href="#/dashboard">
            <span class="admin-brand__crest">ODP</span>
            <span>
              <span class="admin-brand__name">One Doce Pares</span>
              <span class="admin-brand__sub">Admin console</span>
            </span>
          </a>
          <nav class="admin-nav" aria-label="Admin sections">
            ${adminSections
              .map(
                (section) => `
                  <a
                    class="admin-nav__link ${section.key === routeKey ? 'is-active' : ''}"
                    href="#/${section.key}"
                    data-route="${section.key}"
                  >
                    ${icon(section.icon)}
                    <span>
                      <span class="admin-nav__label">${section.label}</span>
                      <span class="admin-nav__summary">${section.summary}</span>
                    </span>
                  </a>
                `,
              )
              .join('')}
          </nav>
        </div>
        <div class="admin-sidebar__footer">
          <div class="text-uppercase small fw-semibold text-secondary mb-2">Current track</div>
          <p class="mb-0 text-secondary small">Phase 1 frontend foundation: shell, auth, CMS pages, and settings scaffolding.</p>
        </div>
      </aside>
      <div class="admin-main">
        <header class="admin-topbar">
          <div>
            <div class="text-uppercase small fw-semibold text-secondary mb-2">${route.eyebrow}</div>
            <h1 class="h2 mb-2">${route.title}</h1>
            <p class="text-secondary mb-0">${route.description}</p>
          </div>
          <div class="d-flex flex-wrap gap-2">${route.actions}</div>
        </header>
        <div class="admin-flash" role="status">
          Shell routing is live. Each section now has a stable entry point for Phase 1 screens.
        </div>
        <main class="admin-content">
          ${route.body}
        </main>
      </div>
    </div>
  `
}
