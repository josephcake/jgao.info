export const THEMES = [
  { id: 'survey', name: 'Survey' },
  { id: 'night', name: 'Night shift' },
  // { id: 'hardcourt', name: 'Hardcourt' },
  // { id: 'clay', name: 'Roland Garros' },
  // { id: 'grass', name: 'Wimbledon' },
]

export function currentTheme() {
  return document.documentElement.dataset.theme || 'survey'
}

export function lastTheme() {
  try {
    return localStorage.getItem('theme-last')
  } catch {
    return null
  }
}

export function themeBefore(theme, themes) {
  const last = lastTheme()
  if (last && last !== theme && themes.some((t) => t.id === last)) return themes.find((t) => t.id === last)
  return themes.find((t) => t.id === (theme === THEMES[0].id ? 'night' : THEMES[0].id))
}

export function syncThemeColor() {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper)
}

export function applyTheme(id) {
  const prev = currentTheme()
  document.documentElement.dataset.theme = id
  syncThemeColor()
  try {
    if (prev !== id) localStorage.setItem('theme-last', prev)
    localStorage.setItem('theme', id)
  } catch {
    // Storage can be unavailable in private browsing; the theme still applies for this visit.
  }
  window.dispatchEvent(new Event('themechange'))
}

export function readVars(names) {
  const styles = getComputedStyle(document.documentElement)
  return Object.fromEntries(names.map((n) => [n, styles.getPropertyValue(`--${n}`).trim()]))
}

export function onThemeChange(fn) {
  window.addEventListener('themechange', fn)
  return () => window.removeEventListener('themechange', fn)
}
