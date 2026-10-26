import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import data from '../contributions.json'
import { ESTIMATED_AFTER, workDays } from '../lib/workDays'

const CELL = 9
const GAP = 2
const ROW = 15
const ROW_GAP = 7
const LEFT = 38
const WEEKS = 54
const RIGHT = 46
const MIN_TOTAL = 20
const DAY = 86400000
// How far from where the ball lands a cell still gets filled, in screen pixels
const HIT_R = 12
const LAST_YEAR = Math.max(data.lastYear, new Date().getUTCFullYear())
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PERSONAL = data.accounts[0]
const WORK = { ...data.accounts[1], days: { ...data.accounts[1].days } }
for (const [date, count] of Object.entries(workDays)) {
  WORK.days[date] = Math.max(WORK.days[date] || 0, count)
}

const MODES = [
  { id: 'both', label: 'Both' },
  { id: PERSONAL.handle, label: PERSONAL.label },
  { id: WORK.handle, label: WORK.label },
]

const DESCRIPTIONS = {
  [PERSONAL.handle]: `Personal projects, back to my first commit. Joined ${new Date(PERSONAL.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}.`,
  [WORK.handle]: 'Work at RapidSOS, since April 2020.',
}

const AVATARS = {
  [PERSONAL.handle]: `${PERSONAL.avatar}&s=96`,
  [WORK.handle]: '/rapidsos.png',
}

const yearStart = (year) => Date.UTC(year, 0, 1)
const weekIndex = (time) => {
  const year = new Date(time).getUTCFullYear()
  const offset = new Date(yearStart(year)).getUTCDay()
  return Math.floor(((time - yearStart(year)) / DAY + offset) / 7)
}
const weekTime = (year, week) => {
  const offset = new Date(yearStart(year)).getUTCDay()
  return Math.max(yearStart(year), yearStart(year) + (week * 7 - offset) * DAY)
}
const formatDate = (time) => {
  const d = new Date(time)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

function buildRows() {
  const rows = []
  for (let year = data.firstYear; year <= LAST_YEAR; year++) {
    rows.push({ year, personal: new Array(WEEKS).fill(0), work: new Array(WEEKS).fill(0) })
  }
  const fill = (account, key) => {
    for (const [date, count] of Object.entries(account.days)) {
      const time = Date.parse(`${date}T00:00:00Z`)
      const row = rows[new Date(time).getUTCFullYear() - data.firstYear]
      if (row) row[key][weekIndex(time)] += count
    }
  }
  fill(PERSONAL, 'personal')
  fill(WORK, 'work')
  return rows
}

function buildView(mode, rows) {
  const value = (row, w) =>
    mode === 'both' ? row.personal[w] + row.work[w] : mode === PERSONAL.handle ? row.personal[w] : row.work[w]
  const joined =
    mode === 'both'
      ? Math.min(Date.parse(PERSONAL.joined), Date.parse(WORK.joined))
      : Date.parse((mode === PERSONAL.handle ? PERSONAL : WORK).joined)

  let total = 0
  let busiest = null
  const perYear = []
  const active = []
  for (const row of rows) {
    let yearTotal = 0
    for (let w = 0; w < WEEKS; w++) {
      const v = value(row, w)
      if (!v) continue
      yearTotal += v
      active.push(v)
      if (!busiest || v > busiest.count) busiest = { count: v, time: weekTime(row.year, w) }
    }
    total += yearTotal
    perYear.push(yearTotal)
  }
  active.sort((a, b) => a - b)
  const q = (p) => active[Math.floor((active.length - 1) * p)] || 0
  const levels = [q(0.3), q(0.6), q(0.85)]
  const level = (n) => (n === 0 ? 0 : n <= levels[0] ? 1 : n <= levels[1] ? 2 : n <= levels[2] ? 3 : 4)
  const bestYear = data.firstYear + perYear.indexOf(Math.max(...perYear))
  const view = { value, joined, total, busiest, perYear, level, bestYear }
  return { ...view, caption: captionFor(view) }
}

function captionFor(view) {
  if (view.total < MIN_TOTAL) {
    const personalTotal = Object.values(PERSONAL.days).reduce((a, b) => a + b, 0)
    return `Switch to ${PERSONAL.label} to see ${plural(personalTotal, 'public contribution')}.`
  }
  return `${plural(view.total, 'contribution')} since ${new Date(view.joined).getUTCFullYear()}. Busiest week: ${formatDate(view.busiest.time)}, with ${view.busiest.count}. Most active year: ${view.bestYear}.`
}

export default function GitHubActivity() {
  const [mode, setMode] = useState('both')
  const [hovered, setHovered] = useState(null)
  const scrub = (e) => {
    if (e.pointerType === 'mouse') return
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-w]')
    if (cell) setHovered({ ri: Number(cell.dataset.ri), w: Number(cell.dataset.w) })
  }
  const figureRef = useRef(null)
  const svgRef = useRef(null)
  const inView = useInView(figureRef, { once: true, margin: '-15% 0px' })

  // In Break it mode a ball fills in the weeks it lands on instead of smashing the chart
  const [filled, setFilled] = useState(() => new Set())
  useEffect(() => {
    const svg = svgRef.current
    const onHit = (e) => {
      e.preventDefault()
      const { x, y } = e.detail
      const reach = HIT_R
      const hits = []
      let nearest = null
      let nearestD = Infinity
      for (const cell of svg.querySelectorAll('[data-w]')) {
        const r = cell.getBoundingClientRect()
        const dx = Math.max(r.left - x, 0, x - r.right)
        const dy = Math.max(r.top - y, 0, y - r.bottom)
        const d = Math.hypot(dx, dy)
        const key = `${cell.dataset.ri}-${cell.dataset.w}`
        if (d <= reach) hits.push(key)
        if (d < nearestD) {
          nearest = key
          nearestD = d
        }
      }
      // a ball that lands in a gap still fills the week it was nearest to
      if (!hits.length && nearest && nearestD <= reach * 3) hits.push(nearest)
      if (hits.length) setFilled((f) => new Set([...f, ...hits]))
    }
    const onFix = () => setFilled(new Set())
    svg.addEventListener('break:hit', onHit)
    window.addEventListener('break:fix', onFix)
    return () => {
      svg.removeEventListener('break:hit', onHit)
      window.removeEventListener('break:fix', onFix)
    }
  }, [])
  const rows = useMemo(buildRows, [])

  const views = useMemo(() => Object.fromEntries(MODES.map((m) => [m.id, buildView(m.id, rows)])), [rows])
  const view = views[mode]

  const empty = view.total < MIN_TOTAL
  const width = LEFT + WEEKS * (CELL + GAP) + RIGHT
  const height = rows.length * (ROW + ROW_GAP)
  const accounts = mode === 'both' ? [PERSONAL, WORK] : [mode === PERSONAL.handle ? PERSONAL : WORK]

  let hoverCaption = '\u00a0'
  if (hovered) {
    const row = rows[hovered.ri]
    const p = row.personal[hovered.w]
    const k = row.work[hovered.w]
    const when = `Week of ${formatDate(weekTime(row.year, hovered.w))}`
    hoverCaption =
      mode === 'both'
        ? `${when}: ${p} personal, ${k} work`
        : `${when}: ${plural(mode === PERSONAL.handle ? p : k, 'contribution')}`
  }

  return (
    <section className="section github" id="github" aria-labelledby="github-title">
      <div className="section__head">
        <div>
          <h2 id="github-title" className="section__title">On GitHub</h2>
        </div>
        <p className="section__lede">
          Two accounts: personal projects, and my work at RapidSOS.
        </p>
      </div>

      <div className="github__bar">
        <div className="segmented" role="group" aria-label="GitHub account">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="segmented__option"
              aria-pressed={mode === m.id}
              onClick={() => {
                setMode(m.id)
                setHovered(null)
              }}
            >
              {mode === m.id && (
                <motion.span
                  layoutId="segmented-pill"
                  className="segmented__pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="segmented__label">{m.label}</span>
            </button>
          ))}
        </div>

        <ul className="github__accounts">
          {[PERSONAL, WORK].map((a) => (
            <li
              key={a.handle}
              className={`account account--${a === WORK ? 'work' : 'personal'} ${accounts.includes(a) ? '' : 'is-off'}`}
            >
              <img className="account__avatar" src={AVATARS[a.handle]} alt="" width="40" height="40" loading="lazy" />
              <div>
                {a === WORK ? (
                  <span className="account__handle">{a.handle}</span>
                ) : (
                  <a className="account__handle" href={`https://github.com/${a.handle}`} target="_blank" rel="noreferrer">
                    {a.handle}
                  </a>
                )}
                <p className="account__meta">
                  {DESCRIPTIONS[a.handle]}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <figure ref={figureRef} className={`github__figure ${inView ? 'is-drawn' : ''} ${empty ? 'is-empty' : ''}`}>
        <div className="github__grid" data-unbreakable>
          <svg
            ref={svgRef}
            className="github__svg"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`GitHub contributions by week for ${mode === 'both' ? 'both accounts' : mode}, one row per year`}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={scrub}
            onPointerMove={scrub}
          >
            {rows.map((row, ri) => {
              const y = ri * (ROW + ROW_GAP)
              return (
                <g key={row.year}>
                  <text className="art-label" x="0" y={y + ROW - 4}>{row.year}</text>
                  {row.personal.map((_, w) => {
                    const time = weekTime(row.year, w)
                    if (new Date(time).getUTCFullYear() !== row.year) return null
                    const v = view.value(row, w)
                    const owner = mode === 'both' ? (row.work[w] > row.personal[w] ? 'work' : 'personal') : mode === WORK.handle ? 'work' : 'personal'
                    const before = time + 7 * DAY < view.joined
                    const hit = filled.has(`${ri}-${w}`)
                    return (
                      <rect
                        key={w}
                        className={`gh-cell gh-cell--${hit ? 4 : view.level(v)} gh-cell--${owner} ${before && !hit ? 'is-before' : ''} ${hit ? 'is-filled' : ''} ${hovered?.ri === ri && hovered?.w === w ? 'is-hovered' : ''}`}
                        style={{ '--d': `${w * 0.006 + ri * 0.05}s` }}
                        x={LEFT + w * (CELL + GAP)}
                        y={y}
                        width={CELL}
                        height={ROW}
                        rx="2"
                        data-ri={ri}
                        data-w={w}
                        onMouseEnter={() => setHovered({ ri, w })}
                      />
                    )
                  })}
                  <text className="art-label github__total" x={width} y={y + ROW - 4} textAnchor="end">
                    {view.perYear[ri] ? view.perYear[ri].toLocaleString() : ''}
                  </text>
                </g>
              )
            })}
          </svg>

          {empty && (
            <div className="github__empty">
              <p className="github__empty-title">Work happens in private repositories</p>
              <p>
                RapidSOS code is private, so GitHub doesn’t publish this activity.
              </p>
            </div>
          )}
        </div>

        <div className="github__legend">
          <figcaption className="swap" aria-live="polite">
            {MODES.map((m) => (
              <span key={m.id} className={hovered || m.id !== mode ? 'is-hidden' : ''} aria-hidden={m.id !== mode}>
                {views[m.id].caption}
              </span>
            ))}
            <span className={hovered ? '' : 'is-hidden'}>{hoverCaption}</span>
          </figcaption>
          <div className="swap github__keys">
            <ul className={`github__key ${mode === 'both' ? '' : 'is-hidden'}`}>
              <li><span className="swatch swatch--toward" />Mostly personal</li>
              <li><span className="swatch swatch--away" />Mostly work</li>
            </ul>
            <ul className={`github__key ${mode === 'both' ? 'is-hidden' : ''}`}>
              <li>
                Fewer
                {[1, 2, 3, 4].map((l) => (
                  <span key={l} className={`github__step gh-step--${l} gh-cell--${mode === WORK.handle ? 'work' : 'personal'}`} />
                ))}
                More
              </li>
            </ul>
          </div>
        </div>
        <p className={`github__note ${mode === PERSONAL.handle ? 'is-off' : ''}`}>
          Work activity comes from my private calendar through {formatDate(Date.parse(`${ESTIMATED_AFTER}T00:00:00Z`))}.
          Daily counts are estimated, and later days follow my usual pace.
        </p>
      </figure>
    </section>
  )
}
