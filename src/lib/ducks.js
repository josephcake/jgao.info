import { useSyncExternalStore } from 'react'

export const DUCK_SPOTS = ['hero', 'court', 'scoreboard', 'calendar', 'footer']

const KEY = 'ducks'
const listeners = new Set()

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((id) => DUCK_SPOTS.includes(id)) : []
  } catch {
    return []
  }
}

let found = load()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(found))
  } catch {
    // Storage can be unavailable in private browsing; progress lasts for this visit.
  }
  listeners.forEach((fn) => fn())
}

export function findDuck(id) {
  if (found.includes(id)) return false
  found = [...found, id]
  save()
  window.dispatchEvent(new CustomEvent('duck:found', { detail: { id, count: found.length } }))
  return true
}

export const isDuckFound = (id) => found.includes(id)

export function resetDucks() {
  found = []
  save()
  window.dispatchEvent(new Event('duck:reset'))
}

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const useDucks = () => useSyncExternalStore(subscribe, () => found)
