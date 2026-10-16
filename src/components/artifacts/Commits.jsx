import { useState } from 'react'
import { repoDays } from '../../data'

const START = Date.UTC(2018, 9, 28)
const FIRST = Date.UTC(2018, 10, 1)
const LAST = Date.UTC(2019, 3, 30)
const WEEKS = 27
const CELL = 13
const GAP = 4
const LEFT = 30
const TOP = 22
const DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 8 ? 3 : 4)
const describe = (cell) => {
  const d = new Date(cell.time)
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
  if (!cell.count) return `${date}: nothing new`
  return `${date}: ${cell.count} new ${cell.count === 1 ? 'repository' : 'repositories'}`
}

const cells = []
const monthLabels = []
for (let w = 0; w < WEEKS; w++) {
  for (let d = 0; d < 7; d++) {
    const time = START + (w * 7 + d) * DAY
    if (time < FIRST || time > LAST) continue
    const key = new Date(time).toISOString().slice(0, 10)
    cells.push({ key, time, w, d, count: repoDays[key] || 0 })
    const date = new Date(time)
    if (date.getUTCDate() === 1) monthLabels.push({ w, label: MONTHS[date.getUTCMonth()] })
  }
}
const total = cells.reduce((sum, c) => sum + c.count, 0)

export default function Commits({ drawn }) {
  const [hovered, setHovered] = useState(null)
  const scrub = (e) => {
    if (e.pointerType === 'mouse') return
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-i]')
    if (cell) setHovered(cells[Number(cell.dataset.i)])
  }

  return (
    <figure className={`artifact ${drawn ? 'is-drawn' : ''}`}>
      <svg
        className="artifact__svg artifact__svg--calendar"
        viewBox={`0 0 ${LEFT + WEEKS * (CELL + GAP)} ${TOP + 7 * (CELL + GAP)}`}
        role="img"
        aria-label={`Calendar of new GitHub repositories from November 2018 to April 2019, ${total} in total`}
        onMouseLeave={() => setHovered(null)}
        onPointerDown={scrub}
        onPointerMove={scrub}
      >
        {monthLabels.map((m) => (
          <text key={m.label} className="art-label" x={LEFT + m.w * (CELL + GAP)} y="12">{m.label}</text>
        ))}
        {[['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([label, d]) => (
          <text key={label} className="art-label" x="0" y={TOP + d * (CELL + GAP) + 10}>{label}</text>
        ))}
        {cells.map((c, i) => (
          <rect
            key={c.key}
            className={`cal cal--${level(c.count)} ${hovered?.key === c.key ? 'is-hovered' : ''}`}
            style={{ '--d': `${c.w * 0.035}s` }}
            x={LEFT + c.w * (CELL + GAP)}
            y={TOP + c.d * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx="2.5"
            data-i={i}
            onMouseEnter={() => setHovered(c)}
          />
        ))}
      </svg>
      <figcaption className="swap" aria-live="polite">
        <span className={hovered ? 'is-hidden' : ''}>
          {total} new repositories in six months, pulled from my GitHub. The 14 on December 8 were one long Saturday.
        </span>
        <span className={hovered ? '' : 'is-hidden'}>{hovered ? describe(hovered) : '\u00a0'}</span>
      </figcaption>
    </figure>
  )
}
