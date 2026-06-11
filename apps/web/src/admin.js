import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'

window.$ = $
window.jQuery = $

document.querySelector('#app').innerHTML = `
  <main class="container py-4 py-lg-5">
    <section class="shell-hero py-3">
      <div class="row g-4">
        <div class="col-lg-4">
          <div class="shell-card rounded-4 p-4 h-100">
            <div class="text-uppercase small fw-semibold text-secondary mb-2">Admin shell</div>
            <h1 class="h2 mb-3">Operations hub scaffold</h1>
            <p class="text-secondary mb-0">
              This placeholder establishes the future `/admin` surface for CMS, media,
              users, tournaments, and registrations.
            </p>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="shell-card rounded-4 p-4 h-100">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <h2 class="h4 mb-0">Planned admin modules</h2>
              <a class="btn btn-outline-dark" href="/">Back to public site</a>
            </div>
            <div class="row g-3">
              <div class="col-md-6">
                <div class="border rounded-4 p-3 h-100 bg-white">
                  <div class="fw-semibold mb-2">Content management</div>
                  <div class="text-secondary">Pages, posts, media library, menus, SEO, settings.</div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="border rounded-4 p-3 h-100 bg-white">
                  <div class="fw-semibold mb-2">Tournament operations</div>
                  <div class="text-secondary">Teams, players, tournaments, registrations, approvals.</div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="border rounded-4 p-3 h-100 bg-white">
                  <div class="fw-semibold mb-2">Security and auth</div>
                  <div class="text-secondary">Login flow, roles, sessions, CSRF, audit-friendly workflows.</div>
                </div>
              </div>
              <div class="col-md-6">
                <div class="border rounded-4 p-3 h-100 bg-white">
                  <div class="fw-semibold mb-2">Ranking systems</div>
                  <div class="text-secondary">Result entry, leaderboard snapshots, feed generation, rebuild tools.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
`
