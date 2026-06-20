import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { login } from './js/auth'

window.$ = $
window.jQuery = $

$('#login-form').on('submit', function (e) {
  e.preventDefault()

  const $form = $(this)
  const email = $('#email').val().trim()
  const password = $('#password').val()
  const $btn = $('#submit-btn')
  const $alert = $('#login-alert')

  if (!email || !password) {
    $form[0].classList.add('was-validated')
    return
  }

  $btn.prop('disabled', true).text('Signing in…')
  $alert.addClass('d-none').text('')

  login(email, password)
    .then(function () {
      window.location.href = '/admin/'
    })
    .fail(function (xhr) {
      const msg =
        xhr.responseJSON?.error?.message || 'Invalid credentials. Please try again.'
      $alert.removeClass('d-none').text(msg)
      $btn.prop('disabled', false).text('Sign in')
    })
})
