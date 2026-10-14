// The icon shown on the browser tab. Deep green is the default (it is what
// index.html ships with); "cream" is an optional per-device choice in Settings.
// The installed-app / home-screen icon is fixed when the app is installed, so
// this only changes the tab.

const KEY = 'pelikn_tab_icon'

export const TAB_ICONS = {
  green: { label: 'Green',  svg: '/icons/icon.svg',       png16: '/icons/favicon-16.png',       png32: '/icons/favicon-32.png' },
  cream: { label: 'Cream',  svg: '/icons/icon-cream.svg', png16: '/icons/favicon-cream-16.png', png32: '/icons/favicon-cream-32.png' },
}

export function getTabIcon() {
  try {
    const v = localStorage.getItem(KEY)
    return v && TAB_ICONS[v] ? v : 'green'
  } catch {
    return 'green'
  }
}

/** Point the page's <link rel="icon"> tags at the chosen style. */
export function applyTabIcon(id = getTabIcon()) {
  const icon = TAB_ICONS[id] ?? TAB_ICONS.green
  const links = document.querySelectorAll('link[rel="icon"]')
  links.forEach(link => {
    const sizes = link.getAttribute('sizes')
    const type = link.getAttribute('type')
    if (type === 'image/svg+xml') link.setAttribute('href', icon.svg)
    else if (sizes === '16x16') link.setAttribute('href', icon.png16)
    else if (sizes === '32x32') link.setAttribute('href', icon.png32)
  })
}

export function setTabIcon(id) {
  try { localStorage.setItem(KEY, id) } catch { /* private mode: still apply for this visit */ }
  applyTabIcon(id)
}
