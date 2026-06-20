import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/admin.scss'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { mountAdminApp } from './js/admin-router'

window.$ = $
window.jQuery = $

mountAdminApp(document.querySelector('#app'))
