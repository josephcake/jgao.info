import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { elevationAt, wiggle } from '../lib/elevation'

const W = 1000
const H = 300
const FIRST = 0.06
const SPAN = 0.86
const DRAW = 2.4
const ease = [0.22, 1, 0.36, 1]

const label = (year) => (typeof year === 'number' ? `’${String(year).slice(2)}` : year)

export default function Summit({ chapters }) {
  const reduce = useReducedMotion()

  const { land, ridge, stops } = useMemo(() => {
    const stops = chapters.map((c, i) => ({
      x: FIRST + (SPAN * i) / (chapters.length - 1),
      e: c.elevation / 10,
    }))
    const curve = [{ x: 0, e: 4 }, ...stops, { x: 1, e: 62 }]
    const height = (x) => 0.06 + ((elevationAt(x, curve) + wiggle(x)) / 100) * 0.84
    const pts = []
    for (let i = 0; i <= 200; i++) {
      const x = i / 200
      pts.push([x * W, H * (1 - height(x))])
    }
    const ridge = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    return {
      ridge,
      land: `${ridge} L${W} ${H} L0 ${H} Z`,
      stops: stops.map((s) => ({ ...s, h: height(s.x) })),
    }
  }, [chapters])

  const view = { once: true, margin: '0px 0px -15% 0px' }

  return (
    <div className="summit">
      <svg className="summit__land" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="summit-walked">
            <motion.rect
              x="0"
              y="0"
              height={H}
              initial={{ width: reduce ? W : 0 }}
              whileInView={{ width: W }}
              viewport={view}
              transition={{ duration: DRAW, ease: 'easeInOut' }}
            />
          </clipPath>
        </defs>
        <path className="summit__fill" d={land} />
        <path className="summit__trail" d={ridge} clipPath="url(#summit-walked)" />
      </svg>

      <ol className="summit__stops" aria-label="The route so far">
        {chapters.map((c, i) => {
          const s = stops[i]
          const top = i === chapters.length - 1
          return (
            <motion.li
              key={c.id}
              className={`summit__stop ${top ? 'is-top' : ''}`}
              style={{ left: `${s.x * 100}%`, bottom: `${s.h * 100}%` }}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={view}
              transition={{ duration: 0.6, ease, delay: reduce ? 0 : s.x * DRAW * 0.9 }}
            >
              <a href={`#chapter-${c.id}`} aria-label={`${c.year}: ${c.title}`}>
                <span className="summit__year">{label(c.year)}</span>
                <span className="summit__title">{c.title}</span>
              </a>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
