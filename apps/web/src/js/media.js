import $ from 'jquery'
import { Modal, Offcanvas, Toast } from 'bootstrap'
import { apiRequest } from './api'

// ─── Utilities ───────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function isImage(mime) { return Boolean(mime?.startsWith('image/')) }

function fileIcon(mime) {
  if (mime?.startsWith('image/'))  return 'bi-file-earmark-image'
  if (mime?.startsWith('video/'))  return 'bi-file-earmark-play'
  if (mime?.includes('pdf'))       return 'bi-file-earmark-pdf'
  if (mime?.includes('word') || mime?.includes('document')) return 'bi-file-earmark-word'
  return 'bi-file-earmark'
}

// Resolve an absolute path stored in url (e.g. "/uploads/foo.jpg") to a full URL
// using the API base origin so it works whether the API is on a different port.
function mediaUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
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

export function unmountMedia() {
  $(document).off('.media')
}

// ─── HTML Template ────────────────────────────────────────────────────────────

export function renderMediaLibrary() {
  return `
    <div class="d-sm-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0 text-gray-800">Media Library</h1>
      <button type="button" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm" id="btnOpenUpload">
        <i class="bi bi-cloud-upload me-1"></i> Upload
      </button>
    </div>

    <!-- Upload drop zone (hidden by default) -->
    <div class="card shadow mb-4 d-none" id="uploadZone">
      <div class="card-body">
        <div id="dropArea"
             class="border border-2 rounded p-5 text-center"
             style="border-style: dashed !important; cursor: pointer;">
          <i class="bi bi-cloud-upload fs-1 text-gray-400 d-block mb-2"></i>
          <p class="mb-1 fw-semibold text-gray-700">Drag &amp; drop files here</p>
          <p class="small text-muted mb-3">or click to browse &mdash; max 10 MB per file</p>
          <input type="file" id="fileInput" multiple
                 accept="image/*,video/*,application/pdf,.doc,.docx"
                 class="d-none" aria-label="Select files to upload">
          <button type="button" class="btn btn-outline-primary btn-sm" id="btnBrowse">
            <i class="bi bi-folder2-open me-1"></i> Browse files
          </button>
        </div>
        <div id="uploadQueue" class="mt-3" aria-live="polite"></div>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="mb-3 d-flex align-items-center gap-3">
      <div class="btn-group btn-group-sm" id="mediaFilter" role="group" aria-label="Filter media by type">
        <button type="button" class="btn btn-outline-secondary active" data-filter="all">All</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="image">Images</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="video">Videos</button>
        <button type="button" class="btn btn-outline-secondary" data-filter="other">Documents</button>
      </div>
      <small class="text-muted" id="mediaCount" aria-live="polite"></small>
    </div>

    <!-- Loading state -->
    <div class="text-center py-5 text-gray-600" id="mediaLoading">
      <div class="spinner-border spinner-border-sm text-primary me-2" role="status" aria-label="Loading"></div>
      Loading media&hellip;
    </div>

    <!-- Empty state -->
    <div class="card shadow d-none" id="mediaEmpty">
      <div class="card-body text-center py-5">
        <i class="bi bi-images display-4 d-block mb-3 text-gray-300"></i>
        <p class="fw-bold mb-1 text-gray-800">No media yet</p>
        <p class="small text-gray-600 mb-3">Upload your first file to get started.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btnOpenUploadEmpty">
          <i class="bi bi-cloud-upload me-1"></i> Upload files
        </button>
      </div>
    </div>

    <!-- Media grid -->
    <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3 d-none"
         id="mediaGrid" aria-label="Media files"></div>

    <!-- Detail offcanvas -->
    <div class="offcanvas offcanvas-end"
         tabindex="-1"
         id="mediaDetailOffcanvas"
         aria-labelledby="mediaDetailLabel"
         style="width: 360px;">
      <div class="offcanvas-header border-bottom">
        <h5 class="offcanvas-title" id="mediaDetailLabel">File details</h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body" id="mediaDetailBody">
        <!-- populated dynamically -->
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div class="modal fade" id="deleteMediaModal" tabindex="-1"
         aria-labelledby="deleteMediaModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="deleteMediaModalLabel">Delete file?</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body small text-gray-700">
            This permanently removes the file. Any pages that reference it will show a broken image.
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger btn-sm" id="confirmDeleteMedia">
              <span class="spinner-border spinner-border-sm me-1 d-none" id="deleteSpinner" role="status"></span>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

// ─── Mount ────────────────────────────────────────────────────────────────────

export function mountMediaLibrary() {
  let allMedia = []
  let activeFilter = 'all'
  let selectedId = null
  let detailOffcanvas = null

  // ── Load ──────────────────────────────────────────────────────────────────

  apiRequest('/admin/media')
    .then(function (res) {
      allMedia = res?.data || []
      $('#mediaLoading').addClass('d-none')
      applyFilter()
    })
    .fail(function () {
      $('#mediaLoading').addClass('d-none')
      $('#mediaGrid')
        .removeClass('d-none')
        .html(`
          <div class="col-12 text-center py-5 text-danger">
            <i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>
            <p class="mb-0">Failed to load media. Please refresh and try again.</p>
          </div>`)
    })

  // ── Filter ────────────────────────────────────────────────────────────────

  function applyFilter() {
    const filtered = activeFilter === 'all'
      ? allMedia
      : allMedia.filter(m => {
          if (activeFilter === 'image') return m.mime_type.startsWith('image/')
          if (activeFilter === 'video') return m.mime_type.startsWith('video/')
          return !m.mime_type.startsWith('image/') && !m.mime_type.startsWith('video/')
        })

    const countEl = document.getElementById('mediaCount')
    if (countEl) countEl.textContent = `${filtered.length} file${filtered.length !== 1 ? 's' : ''}`

    if (filtered.length === 0) {
      $('#mediaGrid').addClass('d-none')
      $('#mediaEmpty').removeClass('d-none')
    } else {
      $('#mediaEmpty').addClass('d-none')
      $('#mediaGrid').removeClass('d-none').html(filtered.map(buildCard).join(''))
    }
  }

  function buildCard(m) {
    const thumb = isImage(m.mime_type)
      ? `<img src="${mediaUrl(m.url)}"
              alt="${escHtml(m.alt_text || m.original_name)}"
              class="w-100 h-100"
              style="object-fit:cover;"
              loading="lazy">`
      : `<div class="d-flex align-items-center justify-content-center h-100">
           <i class="bi ${fileIcon(m.mime_type)} fs-1 text-gray-400"></i>
         </div>`

    return `
      <div class="col">
        <div class="card h-100 shadow-sm media-card"
             role="button"
             tabindex="0"
             aria-label="Open details for ${escHtml(m.original_name)}"
             data-media-id="${m.id}"
             style="cursor:pointer; transition: box-shadow .15s;">
          <div class="card-img-top bg-light overflow-hidden" style="height:120px;">
            ${thumb}
          </div>
          <div class="card-body p-2">
            <p class="small text-truncate mb-0 fw-medium lh-sm"
               title="${escHtml(m.original_name)}">${escHtml(m.original_name)}</p>
            <p class="text-xs text-muted mb-0">${fmtBytes(m.size_bytes)}</p>
          </div>
        </div>
      </div>`
  }

  // ── Filter buttons ────────────────────────────────────────────────────────

  $(document).on('click.media', '#mediaFilter button', function () {
    $('#mediaFilter button').removeClass('active')
    $(this).addClass('active')
    activeFilter = $(this).data('filter')
    applyFilter()
  })

  // ── Upload toggle ─────────────────────────────────────────────────────────

  $(document).on('click.media', '#btnOpenUpload, #btnOpenUploadEmpty', function () {
    $('#uploadZone').removeClass('d-none')
    $('#uploadZone')[0]?.scrollIntoView({ behavior: 'smooth' })
  })

  // ── Browse button ─────────────────────────────────────────────────────────

  $(document).on('click.media', '#btnBrowse', function () {
    document.getElementById('fileInput')?.click()
  })

  // ── File input ────────────────────────────────────────────────────────────

  $(document).on('change.media', '#fileInput', function () {
    handleFiles(this.files)
    this.value = ''
  })

  // ── Drag & drop ───────────────────────────────────────────────────────────

  $(document).on('dragover.media', '#dropArea', function (e) {
    e.preventDefault()
    $(this).addClass('border-primary bg-light')
  })

  $(document).on('dragleave.media', '#dropArea', function () {
    $(this).removeClass('border-primary bg-light')
  })

  $(document).on('drop.media', '#dropArea', function (e) {
    e.preventDefault()
    $(this).removeClass('border-primary bg-light')
    handleFiles(e.originalEvent.dataTransfer.files)
  })

  function handleFiles(fileList) {
    if (!fileList?.length) return
    Array.from(fileList).forEach(uploadFile)
  }

  function uploadFile(file) {
    const queue = document.getElementById('uploadQueue')
    if (!queue) return

    const rowId = `urow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    queue.insertAdjacentHTML(
      'beforeend',
      `<div class="d-flex align-items-center gap-2 mb-2 small" id="${rowId}">
         <i class="bi bi-file-earmark text-muted flex-shrink-0"></i>
         <span class="text-truncate flex-grow-1">${escHtml(file.name)}</span>
         <div class="spinner-border spinner-border-sm text-primary flex-shrink-0"
              role="status" aria-label="Uploading ${escHtml(file.name)}"></div>
       </div>`,
    )

    const fd = new FormData()
    fd.append('file', file)

    apiRequest('/admin/media', { method: 'POST', data: fd })
      .then(function (res) {
        document.getElementById(rowId)?.remove()
        const record = res?.data
        if (record) {
          allMedia.unshift(record)
          applyFilter()
          showToast(`${record.original_name} uploaded.`)
        }
        if (!queue.children.length) $('#uploadZone').addClass('d-none')
      })
      .fail(function () {
        const row = document.getElementById(rowId)
        if (row) {
          const spinner = row.querySelector('.spinner-border')
          if (spinner) {
            const icon = document.createElement('i')
            icon.className = 'bi bi-exclamation-circle text-danger flex-shrink-0'
            icon.title = 'Upload failed'
            spinner.replaceWith(icon)
          }
        }
      })
  }

  // ── Open detail ───────────────────────────────────────────────────────────

  $(document).on('click.media keydown.media', '.media-card', function (e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return
    if (e.type === 'keydown') e.preventDefault()
    const id = $(this).data('media-id')
    const record = allMedia.find(m => m.id === id)
    if (!record) return
    selectedId = id
    openDetail(record)
  })

  function openDetail(record) {
    const body = document.getElementById('mediaDetailBody')
    if (!body) return

    const preview = isImage(record.mime_type)
      ? `<img src="${mediaUrl(record.url)}"
              alt="${escHtml(record.alt_text || record.original_name)}"
              class="img-fluid rounded mb-3 w-100">`
      : `<div class="d-flex align-items-center justify-content-center bg-light rounded mb-3 py-4">
           <i class="bi ${fileIcon(record.mime_type)} display-2 text-gray-400"></i>
         </div>`

    body.innerHTML = `
      ${preview}

      <dl class="small mb-3 row">
        <dt class="col-sm-4 text-muted fw-normal">File</dt>
        <dd class="col-sm-8 text-break fw-medium mb-1">${escHtml(record.original_name)}</dd>
        <dt class="col-sm-4 text-muted fw-normal">Type</dt>
        <dd class="col-sm-8 mb-1">${escHtml(record.mime_type)}</dd>
        <dt class="col-sm-4 text-muted fw-normal">Size</dt>
        <dd class="col-sm-8 mb-1">${fmtBytes(record.size_bytes)}</dd>
        <dt class="col-sm-4 text-muted fw-normal">Uploaded</dt>
        <dd class="col-sm-8 mb-0">${fmtDate(record.created_at)}</dd>
      </dl>

      <div class="mb-3">
        <label for="detailUrl" class="form-label small fw-semibold mb-1">URL</label>
        <div class="input-group input-group-sm">
          <input type="text" class="form-control font-monospace" id="detailUrl"
                 value="${escHtml(record.url)}" readonly aria-label="File URL">
          <button class="btn btn-outline-secondary" type="button" id="btnCopyUrl"
                  title="Copy URL" aria-label="Copy URL to clipboard">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
      </div>

      <div class="mb-3">
        <label for="mediaAltText" class="form-label small fw-semibold mb-1">Alt text</label>
        <input type="text" class="form-control form-control-sm" id="mediaAltText"
               value="${escHtml(record.alt_text || '')}"
               placeholder="Describe for screen readers">
      </div>
      <div class="d-grid mb-3">
        <button type="button" class="btn btn-primary btn-sm" id="btnSaveAlt">
          <span class="spinner-border spinner-border-sm me-1 d-none" id="altSpinner" role="status"></span>
          <i class="bi bi-floppy me-1"></i> Save alt text
        </button>
      </div>

      <hr>

      <div class="d-grid">
        <button type="button" class="btn btn-outline-danger btn-sm"
                id="btnDeleteMedia"
                data-bs-toggle="modal" data-bs-target="#deleteMediaModal">
          <i class="bi bi-trash me-1"></i> Delete file
        </button>
      </div>
    `

    if (!detailOffcanvas) {
      const el = document.getElementById('mediaDetailOffcanvas')
      if (el) detailOffcanvas = new Offcanvas(el)
    }
    detailOffcanvas?.show()
  }

  // ── Copy URL ──────────────────────────────────────────────────────────────

  $(document).on('click.media', '#btnCopyUrl', function () {
    const val = document.getElementById('detailUrl')?.value
    if (!val) return
    const $btn = $(this)
    navigator.clipboard?.writeText(val).then(function () {
      $btn.html('<i class="bi bi-clipboard-check"></i>')
      setTimeout(() => $btn.html('<i class="bi bi-clipboard"></i>'), 2000)
    })
  })

  // ── Save alt text ─────────────────────────────────────────────────────────

  $(document).on('click.media', '#btnSaveAlt', function () {
    if (!selectedId) return
    const alt = $('#mediaAltText').val().trim() || null
    $('#altSpinner').removeClass('d-none')
    $('#btnSaveAlt').prop('disabled', true)

    apiRequest(`/admin/media/${selectedId}`, { method: 'PATCH', data: { alt_text: alt } })
      .then(function (res) {
        const updated = res?.data
        if (updated) {
          const idx = allMedia.findIndex(m => m.id === selectedId)
          if (idx !== -1) allMedia[idx] = updated
          applyFilter()
          showToast('Alt text saved.')
        }
      })
      .always(function () {
        $('#altSpinner').addClass('d-none')
        $('#btnSaveAlt').prop('disabled', false)
      })
  })

  // ── Delete ────────────────────────────────────────────────────────────────

  $(document).on('click.media', '#confirmDeleteMedia', function () {
    if (!selectedId) return
    const id = selectedId
    $('#deleteSpinner').removeClass('d-none')
    $('#confirmDeleteMedia').prop('disabled', true)

    apiRequest(`/admin/media/${id}`, { method: 'DELETE' })
      .then(function () {
        allMedia = allMedia.filter(m => m.id !== id)
        selectedId = null
        applyFilter()

        Modal.getInstance(document.getElementById('deleteMediaModal'))?.hide()
        detailOffcanvas?.hide()
        showToast('File deleted.')
      })
      .fail(function () {
        $('#deleteSpinner').addClass('d-none')
        $('#confirmDeleteMedia').prop('disabled', false)
      })
  })
}
