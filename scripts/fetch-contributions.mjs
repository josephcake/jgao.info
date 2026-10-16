// Usage: npm run contributions
// Saves daily contribution counts and profile basics for each account to src/contributions.json.
import { writeFile } from 'node:fs/promises'

const ACCOUNTS = [
  { handle: 'josephcake', label: 'Personal' },
  { handle: 'jgaosos', label: 'Work' },
]
const FIRST_YEAR = 2018
const LAST_YEAR = new Date().getFullYear()
const HEADERS = { 'User-Agent': 'jgao-info-portfolio' }

async function fetchYear(handle, year) {
  const url = `https://github.com/users/${handle}/contributions?from=${year}-01-01&to=${year}-12-31`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${url}`)
  const html = await res.text()

  const dates = new Map()
  for (const m of html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)) {
    dates.set(m[2], m[1])
  }
  const days = {}
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const date = dates.get(m[1])
    const count = m[2].match(/^([\d,]+) contributions?/)
    if (date && count) days[date] = Number(count[1].replace(/,/g, ''))
  }
  return days
}

async function fetchProfile(handle) {
  const res = await fetch(`https://api.github.com/users/${handle}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${handle}`)
  const p = await res.json()
  return { name: p.name, avatar: p.avatar_url, repos: p.public_repos, joined: p.created_at.slice(0, 10) }
}

const accounts = []
for (const account of ACCOUNTS) {
  const profile = await fetchProfile(account.handle)
  const days = {}
  for (let year = Math.max(FIRST_YEAR, Number(profile.joined.slice(0, 4))); year <= LAST_YEAR; year++) {
    const yearDays = await fetchYear(account.handle, year)
    const total = Object.values(yearDays).reduce((a, b) => a + b, 0)
    console.log(`${account.handle} ${year}: ${total}`)
    Object.assign(days, yearDays)
  }
  const sorted = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)))
  accounts.push({ ...account, ...profile, days: sorted })
}

const out = { fetchedAt: new Date().toISOString().slice(0, 10), firstYear: FIRST_YEAR, lastYear: LAST_YEAR, accounts }
await writeFile(new URL('../src/contributions.json', import.meta.url), `${JSON.stringify(out, null, 2)}\n`)
console.log('Saved src/contributions.json')
