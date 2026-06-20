import $ from 'jquery'
import { Toast } from 'bootstrap'
import { apiRequest } from './api'

// ─── Utilities ───────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const id = `toast-${Date.now()}`
  const bg = type === 'error' ? 'bg-danger' : 'bg-success'
  container.insertAdjacentHTML(
    'beforeend',
    `<div id="${id}" class="toast align-items-center text-white ${bg} border-0"
          role="alert" aria-live="assertive" aria-atomic="true">
       <div class="d-flex">
         <div class="toast-body">${escHtml(message)}</div>
         <button type="button" class="btn-close btn-close-white me-2 m-auto"
                 data-bs-dismiss="toast" aria-label="Close"></button>
       </div>
     </div>`,
  )
  const el = document.getElementById(id)
  const t = new Toast(el, { delay: 3500 })
  el.addEventListener('hidden.bs.toast', () => el.remove())
  t.show()
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function unmountSettings() {
  $(document).off('.settings')
}

// ─── HTML Template ────────────────────────────────────────────────────────────

export function renderSettings() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Settings</h1>
      <button type="button"
              class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm"
              id="btnSaveSettings">
        <span class="spinner-border spinner-border-sm me-1 d-none" id="saveSettingsSpinner" role="status"></span>
        <i class="bi bi-floppy me-1"></i> Save changes
      </button>
    </div>

    <!-- API availability notice (shown when backend endpoint not yet live) -->
    <div class="alert alert-info alert-dismissible d-none mb-4" id="settingsApiNotice" role="alert">
      <i class="bi bi-info-circle me-2"></i>
      <strong>Settings API not yet available.</strong>
      The form is shown for preview. Values will persist once the backend endpoint is wired up.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>

    <!-- Loading state -->
    <div class="text-center py-4 text-gray-600" id="settingsLoading">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
      Loading settings&hellip;
    </div>

    <form id="settingsForm" novalidate class="d-none">
      <div class="row">

        <!-- Left column -->
        <div class="col-lg-8">

          <!-- Brand & Identity -->
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">
                <i class="bi bi-shield-fill me-2 text-primary"></i>Brand &amp; Identity
              </h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="siteName" class="form-label fw-semibold">
                  Site name <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input type="text" class="form-control" id="siteName" name="site_name"
                       required placeholder="One Doce Pares"
                       autocomplete="organization">
                <div class="invalid-feedback">Site name is required.</div>
              </div>
              <div class="mb-0">
                <label for="siteTagline" class="form-label fw-semibold">Tagline</label>
                <input type="text" class="form-control" id="siteTagline" name="site_tagline"
                       placeholder="A short description shown in browser tabs and social cards">
                <div class="form-text">Keep it under 60 characters.</div>
              </div>
            </div>
          </div>

          <!-- Contact -->
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">
                <i class="bi bi-envelope me-2 text-primary"></i>Contact
              </h6>
            </div>
            <div class="card-body">
              <div class="mb-0">
                <label for="contactEmail" class="form-label fw-semibold">Contact email</label>
                <input type="email" class="form-control" id="contactEmail" name="contact_email"
                       placeholder="info@example.com"
                       autocomplete="email">
                <div class="form-text">Shown on the public contact page and used for notification replies.</div>
              </div>
            </div>
          </div>

          <!-- Social links -->
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">
                <i class="bi bi-share me-2 text-primary"></i>Social links
              </h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="socialFacebook" class="form-label fw-semibold">Facebook URL</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-facebook"></i></span>
                  <input type="url" class="form-control" id="socialFacebook" name="social_facebook"
                         placeholder="https://facebook.com/yourpage">
                </div>
              </div>
              <div class="mb-0">
                <label for="socialInstagram" class="form-label fw-semibold">Instagram URL</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-instagram"></i></span>
                  <input type="url" class="form-control" id="socialInstagram" name="social_instagram"
                         placeholder="https://instagram.com/yourhandle">
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Right column -->
        <div class="col-lg-4">

          <!-- Save actions -->
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">Actions</h6>
            </div>
            <div class="card-body">
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary" id="btnSaveSettingsSidebar">
                  <span class="spinner-border spinner-border-sm me-1 d-none" id="saveSettingsSpinnerSidebar" role="status"></span>
                  <i class="bi bi-floppy me-1"></i> Save changes
                </button>
              </div>
              <hr class="my-3">
              <p class="small text-muted mb-0">
                <i class="bi bi-info-circle me-1"></i>
                Changes take effect immediately after saving.
              </p>
            </div>
          </div>

          <!-- Planned settings -->
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">Coming soon</h6>
            </div>
            <div class="card-body p-0">
              <ul class="list-group list-group-flush small">
                <li class="list-group-item d-flex align-items-center gap-2 text-muted">
                  <i class="bi bi-image text-gray-400"></i> Site logo &amp; favicon
                </li>
                <li class="list-group-item d-flex align-items-center gap-2 text-muted">
                  <i class="bi bi-globe text-gray-400"></i> Default SEO metadata
                </li>
                <li class="list-group-item d-flex align-items-center gap-2 text-muted">
                  <i class="bi bi-list-nested text-gray-400"></i> Navigation menus
                </li>
                <li class="list-group-item d-flex align-items-center gap-2 text-muted">
                  <i class="bi bi-envelope-open text-gray-400"></i> Email notifications
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </form>
  `
}

// ─── Mount ────────────────────────────────────────────────────────────────────

// Known setting keys — defines load/save order
const SETTING_KEYS = [
  'site_name',
  'site_tagline',
  'contact_email',
  'social_facebook',
  'social_instagram',
]

// Map setting key → form field id
const KEY_TO_FIELD = {
  site_name:        'siteName',
  site_tagline:     'siteTagline',
  contact_email:    'contactEmail',
  social_facebook:  'socialFacebook',
  social_instagram: 'socialInstagram',
}

export function mountSettings() {
  let apiAvailable = true

  // ── Load ──────────────────────────────────────────────────────────────────

  apiRequest('/admin/settings')
    .then(function (res) {
      const settings = res?.data || {}
      $('#settingsLoading').addClass('d-none')
      populateForm(settings)
      $('#settingsForm').removeClass('d-none')
    })
    .fail(function (xhr) {
      $('#settingsLoading').addClass('d-none')
      apiAvailable = false

      if (xhr?.status === 404 || xhr?.status === 0 || !xhr?.status) {
        // Endpoint not yet implemented — show form in preview mode
        $('#settingsApiNotice').removeClass('d-none')
        populateForm({})
        $('#settingsForm').removeClass('d-none')
      } else {
        // Unexpected error
        document.getElementById('settingsLoading')?.closest('.container-fluid')
          ?.insertAdjacentHTML('beforeend', `
            <div class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle me-2"></i>
              Failed to load settings. Please refresh and try again.
            </div>`)
      }
    })

  function populateForm(settings) {
    SETTING_KEYS.forEach(key => {
      const fieldId = KEY_TO_FIELD[key]
      if (fieldId && settings[key] !== undefined) {
        $(`#${fieldId}`).val(settings[key])
      }
    })
  }

  function collectForm() {
    const out = {}
    SETTING_KEYS.forEach(key => {
      const fieldId = KEY_TO_FIELD[key]
      if (fieldId) out[key] = $(`#${fieldId}`).val().trim()
    })
    return out
  }

  function setSubmitting(busy) {
    $('#saveSettingsSpinner, #saveSettingsSpinnerSidebar').toggleClass('d-none', !busy)
    $('#btnSaveSettings, #btnSaveSettingsSidebar').prop('disabled', busy)
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  $(document).on('submit.settings', '#settingsForm', function (e) {
    e.preventDefault()
    const form = this
    if (!form.checkValidity()) {
      form.classList.add('was-validated')
      return
    }

    if (!apiAvailable) {
      showToast('Settings API not yet available — changes not persisted.', 'error')
      return
    }

    setSubmitting(true)
    apiRequest('/admin/settings', { method: 'PATCH', data: collectForm() })
      .then(function () {
        showToast('Settings saved.')
      })
      .fail(function (xhr) {
        if (xhr?.status === 404) {
          apiAvailable = false
          $('#settingsApiNotice').removeClass('d-none')
          showToast('Settings API not yet available.', 'error')
        }
      })
      .always(function () {
        setSubmitting(false)
      })
  })

  // Top-bar save button delegates to form submit
  $(document).on('click.settings', '#btnSaveSettings', function () {
    document.getElementById('settingsForm')?.requestSubmit()
  })
}
