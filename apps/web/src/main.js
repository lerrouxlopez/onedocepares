import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { apiRequest } from './js/api'

window.$ = $
window.jQuery = $

$('#footer-year').text(new Date().getFullYear())

apiRequest('/tournaments?status=upcoming&per_page=3')
  .then(function (res) {
    const tournaments = res.data || []
    if (tournaments.length === 0) return

    $('#tournaments-placeholder').remove()
    $('#tournaments-list').html(
      tournaments
        .map(
          (t) => `
        <div class="col-lg-4">
          <div class="card mb-4">
            <div class="card-body p-4">
              <h5 class="card-title fw-bolder">${$('<div>').text(t.name).html()}</h5>
              <p class="text-muted small mb-2"><i class="bi bi-calendar3 me-1"></i>${t.start_date || 'TBA'}</p>
              <p class="text-muted small mb-3"><i class="bi bi-geo-alt-fill me-1"></i>${$('<div>').text(t.location || 'TBA').html()}</p>
              <a class="btn btn-outline-primary btn-sm" href="/tournament.html?slug=${encodeURIComponent(t.slug)}">View details</a>
            </div>
          </div>
        </div>
      `,
        )
        .join(''),
    )
  })
  .fail(function () {
    // API unavailable — static placeholder already visible
  })
