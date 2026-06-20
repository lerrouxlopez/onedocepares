import $ from 'jquery'
import { Toast } from 'bootstrap'
import { apiRequest } from './api'

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusBadge(status) {
  const colours = { published: 'success', draft: 'secondary', archived: 'dark' }
  const cls = colours[status] || 'secondary'
  return `<span class="badge bg-${cls}">${escHtml(status)}</span>`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function showToast(message, type = 'success') {
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

// ─── Clean up delegated listeners between route changes ───────────────────────

export function unmountCms() {
  $(document).off('.cms')
}

// ─── Pages List ───────────────────────────────────────────────────────────────

export function renderPagesList() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Pages</h1>
      <a href="/admin/pages/new" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">
        <i class="bi bi-file-earmark-plus me-1"></i> New Page
      </a>
    </div>

    <div class="mb-3 d-flex align-items-center gap-3">
      <div class="btn-group btn-group-sm" id="statusFilter" role="group" aria-label="Filter pages by status">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="draft">Draft</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="published">Published</button>
      </div>
      <small class="text-muted" id="pagesCount"></small>
    </div>

    <div class="card shadow mb-4">
      <div class="card-header py-3">
        <h6 class="m-0 fw-bold text-primary">CMS Pages</h6>
      </div>
      <div class="card-body p-0" id="pagesTableWrap">

        <div class="text-center py-5 text-gray-600" id="pagesLoading">
          <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
          Loading pages…
        </div>

        <div class="text-center py-5 text-gray-600 d-none" id="pagesEmpty">
          <i class="bi bi-file-earmark-text display-4 d-block mb-3 text-gray-300"></i>
          <p class="fw-bold mb-1">No pages yet</p>
          <p class="small mb-0">Create your first page to get started.</p>
          <a href="/admin/pages/new" class="btn btn-primary btn-sm mt-3">
            <i class="bi bi-file-earmark-plus me-1"></i> New Page
          </a>
        </div>

        <div class="table-responsive d-none" id="pagesTableContainer">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Updated</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>
            <tbody id="pagesTableBody"></tbody>
          </table>
        </div>

      </div>
    </div>`
}

function buildPageRow(page) {
  const actionBtn = page.status === 'published'
    ? `<button class="btn btn-sm btn-outline-warning btn-unpublish"
              data-id="${page.id}" title="Unpublish">
         <i class="bi bi-eye-slash"></i>
       </button>`
    : `<button class="btn btn-sm btn-outline-success btn-publish"
              data-id="${page.id}" title="Publish">
         <i class="bi bi-eye"></i>
       </button>`

  return `
    <tr data-page-id="${page.id}">
      <td class="fw-medium">${escHtml(page.title)}</td>
      <td><code class="small text-muted">${escHtml(page.slug)}</code></td>
      <td>${statusBadge(page.status)}</td>
      <td class="text-muted small">${fmtDate(page.updated_at)}</td>
      <td class="text-end">
        <a href="/admin/pages/${page.id}" class="btn btn-sm btn-outline-primary me-1" title="Edit">
          <i class="bi bi-pencil"></i>
        </a>
        ${actionBtn}
      </td>
    </tr>`
}

export function mountPagesList() {
  let allPages = []
  let activeFilter = 'all'

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allPages
      : allPages.filter(p => p.status === activeFilter)

    const tbody = document.getElementById('pagesTableBody')
    if (!tbody) return

    const countEl = document.getElementById('pagesCount')
    if (countEl) countEl.textContent = `${filtered.length} page${filtered.length !== 1 ? 's' : ''}`

    if (filtered.length === 0) {
      $('#pagesTableContainer').addClass('d-none')
      $('#pagesEmpty').removeClass('d-none')
    } else {
      $('#pagesEmpty').addClass('d-none')
      $('#pagesTableContainer').removeClass('d-none')
      tbody.innerHTML = filtered.map(buildPageRow).join('')
    }
  }

  apiRequest('/admin/cms/pages')
    .then(function (res) {
      allPages = res?.data || []
      $('#pagesLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#pagesLoading').addClass('d-none')
      const wrap = document.getElementById('pagesTableWrap')
      if (wrap) {
        wrap.innerHTML = `
          <div class="text-center py-5 text-danger">
            <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
            <p class="mb-0">Failed to load pages. Please refresh and try again.</p>
          </div>`
      }
    })

  $(document).on('click.cms', '#statusFilter button', function () {
    $('#statusFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  $(document).on('click.cms', '.btn-publish', function () {
    const id = $(this).data('id')
    const $btn = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status"></span>')
    apiRequest(`/admin/cms/pages/${id}/publish`, { method: 'POST' })
      .then(function (res) {
        const updated = res?.data
        if (updated) {
          const idx = allPages.findIndex(p => p.id === id)
          if (idx !== -1) allPages[idx] = updated
          applyFilter()
          showToast('Page published.')
        }
      })
      .fail(function () {
        $btn.prop('disabled', false).html('<i class="bi bi-eye"></i>')
      })
  })

  $(document).on('click.cms', '.btn-unpublish', function () {
    const id = $(this).data('id')
    const $btn = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status"></span>')
    apiRequest(`/admin/cms/pages/${id}/unpublish`, { method: 'POST' })
      .then(function (res) {
        const updated = res?.data
        if (updated) {
          const idx = allPages.findIndex(p => p.id === id)
          if (idx !== -1) allPages[idx] = updated
          applyFilter()
          showToast('Page moved to draft.')
        }
      })
      .fail(function () {
        $btn.prop('disabled', false).html('<i class="bi bi-eye-slash"></i>')
      })
  })
}

// ─── Page Form ────────────────────────────────────────────────────────────────

export function renderPageForm() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800" id="formHeading">
        <span class="spinner-border spinner-border-sm text-primary me-2 d-none" id="formLoadSpinner" role="status"></span>
        <span id="formTitle">New Page</span>
      </h1>
      <a href="/admin/pages" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i> Back to Pages
      </a>
    </div>

    <form id="pageForm" novalidate>
      <div class="row">

        <!-- Main column -->
        <div class="col-lg-8">
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">Content</h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="pageTitle" class="form-label fw-semibold">
                  Title <span class="text-danger" aria-hidden="true">*</span>
                </label>
                <input type="text" class="form-control" id="pageTitle" name="title"
                       required placeholder="Page title" autocomplete="off">
                <div class="invalid-feedback">Title is required.</div>
              </div>
              <div class="mb-3">
                <label for="pageSlug" class="form-label fw-semibold">Slug</label>
                <div class="input-group">
                  <span class="input-group-text text-muted small">/</span>
                  <input type="text" class="form-control" id="pageSlug" name="slug"
                         placeholder="auto-generated-from-title" autocomplete="off">
                </div>
                <div class="form-text">Leave blank to auto-generate from title.</div>
              </div>
              <div class="mb-3">
                <label for="pageBody" class="form-label fw-semibold">Body</label>
                <textarea class="form-control font-monospace" id="pageBody" name="body"
                          rows="16" placeholder="Page content — HTML is supported"></textarea>
              </div>
              <div class="mb-0">
                <label for="pageExcerpt" class="form-label fw-semibold">Excerpt</label>
                <textarea class="form-control" id="pageExcerpt" name="excerpt" rows="3"
                          placeholder="Short summary displayed in listings (optional)"></textarea>
              </div>
            </div>
          </div>

          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">SEO</h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="pageSeoTitle" class="form-label fw-semibold">SEO Title</label>
                <input type="text" class="form-control" id="pageSeoTitle" name="seo_title"
                       placeholder="Defaults to page title if blank">
                <div class="form-text"><span id="seoTitleCount">0</span> / 60 characters</div>
              </div>
              <div class="mb-0">
                <label for="pageSeoDesc" class="form-label fw-semibold">Meta Description</label>
                <textarea class="form-control" id="pageSeoDesc" name="seo_description" rows="3"
                          placeholder="Search engine summary — aim for 150–160 characters"></textarea>
                <div class="form-text"><span id="seoDescCount">0</span> / 160 characters</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar column -->
        <div class="col-lg-4">
          <div class="card shadow mb-4">
            <div class="card-header py-3">
              <h6 class="m-0 fw-bold text-primary">Publish</h6>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <label for="pageStatus" class="form-label fw-semibold">Status</label>
                <select class="form-select" id="pageStatus" name="status">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div class="mb-3 d-none" id="publishedAtWrap">
                <small class="text-muted">
                  <i class="bi bi-calendar-check me-1"></i>Published <span id="publishedAtLabel"></span>
                </small>
              </div>
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary" id="btnSave">
                  <span class="spinner-border spinner-border-sm me-1 d-none" role="status" id="btnSaveSpinner"></span>
                  <i class="bi bi-floppy me-1"></i> Save
                </button>
                <button type="button" class="btn btn-success d-none" id="btnPublish">
                  <span class="spinner-border spinner-border-sm me-1 d-none" role="status" id="btnPublishSpinner"></span>
                  <i class="bi bi-eye me-1"></i> Publish
                </button>
                <button type="button" class="btn btn-outline-warning d-none" id="btnUnpublish">
                  <span class="spinner-border spinner-border-sm me-1 d-none" role="status" id="btnUnpublishSpinner"></span>
                  <i class="bi bi-eye-slash me-1"></i> Unpublish
                </button>
              </div>
            </div>
          </div>

          <div class="card shadow d-none" id="previewCard">
            <div class="card-body">
              <a href="#" target="_blank" rel="noopener noreferrer"
                 class="btn btn-sm btn-outline-info d-block" id="previewLink">
                <i class="bi bi-box-arrow-up-right me-1"></i> View on site
              </a>
            </div>
          </div>
        </div>

      </div>
    </form>`
}

export function mountPageForm(pageId) {
  let currentPage = null
  let slugManuallyEdited = false

  // SEO character counters
  $('#pageSeoTitle').on('input', function () { $('#seoTitleCount').text(this.value.length) })
  $('#pageSeoDesc').on('input', function () { $('#seoDescCount').text(this.value.length) })

  // Auto-slug from title when slug field is untouched
  $('#pageTitle').on('input', function () {
    if (!slugManuallyEdited) $('#pageSlug').val(slugify(this.value))
  })
  $('#pageSlug').on('input', function () {
    slugManuallyEdited = this.value.length > 0
  })

  function syncButtons(status) {
    if (!currentPage) {
      $('#btnPublish, #btnUnpublish').addClass('d-none')
      return
    }
    if (status === 'published') {
      $('#btnPublish').addClass('d-none')
      $('#btnUnpublish').removeClass('d-none')
    } else {
      $('#btnUnpublish').addClass('d-none')
      $('#btnPublish').removeClass('d-none')
    }
  }

  function populateForm(page) {
    currentPage = page
    $('#formTitle').text(page.title)
    $('#pageTitle').val(page.title)
    $('#pageSlug').val(page.slug)
    $('#pageBody').val(page.body)
    $('#pageExcerpt').val(page.excerpt || '')
    $('#pageSeoTitle').val(page.seo_title || '')
    $('#pageSeoDesc').val(page.seo_description || '')
    $('#pageStatus').val(page.status)
    $('#seoTitleCount').text((page.seo_title || '').length)
    $('#seoDescCount').text((page.seo_description || '').length)

    if (page.published_at) {
      $('#publishedAtLabel').text(fmtDate(page.published_at))
      $('#publishedAtWrap').removeClass('d-none')
    }

    $('#previewCard').removeClass('d-none')
    $('#previewLink').attr('href', `/page.html?slug=${encodeURIComponent(page.slug)}`)

    slugManuallyEdited = true
    syncButtons(page.status)
  }

  // Load existing page from list endpoint (no single-page GET exists yet)
  if (pageId) {
    $('#formLoadSpinner').removeClass('d-none')
    apiRequest('/admin/cms/pages')
      .then(function (res) {
        const page = (res?.data || []).find(p => p.id === pageId)
        $('#formLoadSpinner').addClass('d-none')
        if (page) {
          populateForm(page)
        } else {
          showToast('Page not found.', 'error')
          window.location.href = '/admin/pages'
        }
      })
      .fail(function () {
        $('#formLoadSpinner').addClass('d-none')
        showToast('Failed to load page.', 'error')
      })
  } else {
    syncButtons('draft')
  }

  // Save (form submit)
  $(document).on('submit.cms', '#pageForm', function (e) {
    e.preventDefault()
    const form = this
    if (!form.checkValidity()) {
      form.classList.add('was-validated')
      return
    }

    const payload = {
      title: $('#pageTitle').val().trim(),
      slug: $('#pageSlug').val().trim() || null,
      body: $('#pageBody').val(),
      excerpt: $('#pageExcerpt').val().trim() || null,
      seo_title: $('#pageSeoTitle').val().trim() || null,
      seo_description: $('#pageSeoDesc').val().trim() || null,
      status: $('#pageStatus').val(),
    }

    $('#btnSaveSpinner').removeClass('d-none')
    $('#btnSave').prop('disabled', true)

    const req = currentPage
      ? apiRequest(`/admin/cms/pages/${currentPage.id}`, { method: 'PATCH', data: payload })
      : apiRequest('/admin/cms/pages', { method: 'POST', data: payload })

    req
      .then(function (res) {
        const saved = res?.data
        if (!saved) return
        const isNew = !currentPage
        populateForm(saved)
        showToast(isNew ? 'Page created.' : 'Page saved.')
        if (isNew) {
          // Reflect new URL without re-triggering route render
          history.replaceState(null, '', `/admin/pages/${saved.id}`)
        }
      })
      .always(function () {
        $('#btnSaveSpinner').addClass('d-none')
        $('#btnSave').prop('disabled', false)
      })
  })

  // Publish
  $(document).on('click.cms', '#btnPublish', function () {
    if (!currentPage) { showToast('Save the page before publishing.', 'error'); return }
    $('#btnPublishSpinner').removeClass('d-none')
    $('#btnPublish').prop('disabled', true)
    apiRequest(`/admin/cms/pages/${currentPage.id}/publish`, { method: 'POST' })
      .then(function (res) { if (res?.data) { populateForm(res.data); showToast('Page published.') } })
      .always(function () { $('#btnPublishSpinner').addClass('d-none'); $('#btnPublish').prop('disabled', false) })
  })

  // Unpublish
  $(document).on('click.cms', '#btnUnpublish', function () {
    if (!currentPage) return
    $('#btnUnpublishSpinner').removeClass('d-none')
    $('#btnUnpublish').prop('disabled', true)
    apiRequest(`/admin/cms/pages/${currentPage.id}/unpublish`, { method: 'POST' })
      .then(function (res) { if (res?.data) { populateForm(res.data); showToast('Page moved to draft.') } })
      .always(function () { $('#btnUnpublishSpinner').addClass('d-none'); $('#btnUnpublish').prop('disabled', false) })
  })
}
