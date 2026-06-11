import { getCurrentRoute, renderAdminShell } from './admin-shell'

export function mountAdminApp(root) {
  function render() {
    const route = getCurrentRoute()
    root.innerHTML = renderAdminShell(route)
    document.title = `One Doce Pares Admin | ${route.charAt(0).toUpperCase()}${route.slice(1)}`
  }

  window.addEventListener('hashchange', render)

  if (!window.location.hash) {
    window.location.hash = '#/dashboard'
    return
  }

  render()
}
