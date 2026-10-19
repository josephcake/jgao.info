import Duck from './Duck'
import { useEffect, useRef } from 'react'
import { animate, useInView } from 'motion/react'
import contributions from '../contributions.json'
import { workDays } from '../lib/workDays'
import { repoDays } from '../data'
import { THEMES } from '../lib/theme'

const YEAR = 365.25 * 86400000
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const allDays = [
  ...contributions.accounts.flatMap((a) => Object.entries(a.days)),
  ...Object.entries(workDays),
]
const totalContributions = allDays.reduce((sum, [, n]) => sum + n, 0)
const byYear = allDays.reduce((acc, [date, n]) => {
  const y = date.slice(0, 4)
  acc[y] = (acc[y] || 0) + n
  return acc
}, {})
const [bestYear, bestYearCount] = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0]
const repoCount = Object.values(repoDays).reduce((a, b) => a + b, 0)
const codingYears = Math.floor((Date.now() - Date.UTC(2018, 2, 1)) / YEAR)
const rapidsosYears = Math.floor((Date.now() - Date.UTC(2020, 3, 1)) / YEAR)

const STATS = [
  {
    value: codingYears,
    suffix: '+',
    unit: 'years of code',
    text: `including ${WORDS[rapidsosYears] ?? rapidsosYears} building 9-1-1 maps at RapidSOS.`,
  },
  {
    value: THEMES.length,
    unit: 'custom themes',
    text: `on this site, down to the contour lines. Rumor has it there is a ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][THEMES.length]}.`,
  },
  {
    value: repoCount,
    unit: 'repos',
    text: 'in five months after leaving the tennis court. Nearly one a day.',
  },
  {
    value: totalContributions,
    unit: 'contributions',
    text: `across personal and work, ${bestYearCount.toLocaleString()} of them in ${bestYear}.`,
  },
]

function Count({ value, suffix = '', run }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.textContent = `${value.toLocaleString()}${suffix}`
      return
    }
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        ref.current.textContent = `${Math.round(v).toLocaleString()}${suffix}`
      },
    })
    return () => controls.stop()
  }, [run, value, suffix])

  return <span ref={ref}>0{suffix}</span>
}

export default function Scoreboard() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })

  return (
    <section ref={ref} className="section scoreboard" id="scoreboard" aria-labelledby="scoreboard-title">
      <div className="section__head">
        <div>
          <h2 id="scoreboard-title" className="section__title">The scoreboard</h2>
        </div>
      </div>
      <ol className={`scoreboard__grid ${inView ? 'is-in' : ''}`}>
        {STATS.map((s, i) => (
          <li key={s.unit} className="scoreboard__stat" style={{ '--d': `${i * 0.12}s` }}>
            <p className="scoreboard__value">
              <Count value={s.value} suffix={s.suffix} run={inView} />
              <span className="scoreboard__unit">{s.unit}</span>
            </p>
            <p className="scoreboard__text">{s.text}</p>
            {i === STATS.length - 1 && <Duck spot="scoreboard" />}
          </li>
        ))}
      </ol>
    </section>
  )
}
