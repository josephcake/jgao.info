import workCalendar from '../contributions-work.json'

const DAY = 86400000
const iso = (time) => new Date(time).toISOString().slice(0, 10)
const real = workCalendar.days
const lastReal = Object.keys(real).sort().at(-1)

// Days after the last calendar screenshot are filled with a stable estimate drawn from the
// past year's pace, one weekday at a time, and only up to today so the grid never runs ahead.
export const ESTIMATED_AFTER = lastReal

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100000) / 100000
}

function paceByWeekday() {
  const end = Date.parse(`${lastReal}T00:00:00Z`)
  const pace = Array.from({ length: 7 }, () => ({ days: 0, counts: [] }))
  for (let t = end - 364 * DAY; t <= end; t += DAY) {
    const p = pace[new Date(t).getUTCDay()]
    p.days += 1
    const n = real[iso(t)]
    if (n) p.counts.push(n)
  }
  pace.forEach((p) => p.counts.sort((a, b) => a - b))
  return pace
}

function withEstimates() {
  const days = { ...real }
  const today = iso(Date.now())
  if (!lastReal || today <= lastReal) return days
  const pace = paceByWeekday()
  for (let t = Date.parse(`${lastReal}T00:00:00Z`) + DAY; iso(t) <= today; t += DAY) {
    const date = iso(t)
    const p = pace[new Date(t).getUTCDay()]
    if (!p.counts.length || hash(`${date}:on`) >= p.counts.length / p.days) continue
    days[date] = p.counts[Math.floor(hash(`${date}:n`) * p.counts.length)]
  }
  return days
}

export const workDays = withEstimates()
