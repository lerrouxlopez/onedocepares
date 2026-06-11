import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import $ from 'jquery'
import './css/main.scss'
import { mountAdminApp } from './js/admin-router'

window.$ = $
window.jQuery = $

mountAdminApp(document.querySelector('#app'))
