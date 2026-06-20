import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './css/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { apiRequest } from './js/api'

document.getElementById('footer-year').textContent = new Date().getFullYear()

const slug = new URLSearchParams(window.location.search).get('slug')

if (!slug) {
  showNotFound()
} else {
  apiRequest(`/cms/pages/${encodeURIComponent(slug)}`)
    .then(function (res) {
      const page = res?.data
      if (!page) { showNotFound(); return }

      document.title = `${page.seo_title || page.title} — One Doce Pares`

      const descEl = document.querySelector('meta[name="description"]')
      if (descEl && page.seo_description) descEl.setAttribute('content', page.seo_description)

      document.getElementById('page-heading').textContent = page.title
      // body is HTML stored by the CMS editor
      document.getElementById('page-body').innerHTML = page.body || ''

      document.getElementById('page-loading').classList.add('d-none')
      document.getElementById('page-content').classList.remove('d-none')
    })
    .fail(function (xhr) {
      if (xhr.status === 404) {
        showNotFound()
      } else {
        showError()
      }
    })
}

function showNotFound() {
  document.getElementById('page-loading').classList.add('d-none')
  document.getElementById('page-not-found').classList.remove('d-none')
  document.title = 'Page Not Found — One Doce Pares'
}

function showError() {
  document.getElementById('page-loading').classList.add('d-none')
  document.getElementById('page-error').classList.remove('d-none')
}
