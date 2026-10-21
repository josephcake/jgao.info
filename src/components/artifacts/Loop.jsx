import { useRef } from 'react'
import useFrame from './useFrame'

const LAP_MS = 7000
const R = 70
const STRAIGHT = 300
const TOTAL = 2 * STRAIGHT + 2 * Math.PI * R
const ARC = Math.PI * R
const LOOP = `M150 35 H450 A${R} ${R} 0 0 1 450 175 H150 A${R} ${R} 0 0 1 150 35 Z`

const STATIONS = [
  { name: 'Decide', x: 300, y: 35, at: STRAIGHT / 2, lx: 300, ly: 20, anchor: 'middle' },
  { name: 'Design', x: 520, y: 105, at: STRAIGHT + ARC / 2, lx: 534, ly: 109, anchor: 'start' },
  { name: 'Ship', x: 300, y: 175, at: STRAIGHT * 1.5 + ARC, lx: 300, ly: 200, anchor: 'middle' },
  { name: 'Learn', x: 80, y: 105, at: STRAIGHT * 2 + ARC * 1.5, lx: 66, ly: 109, anchor: 'end' },
]

export default function Loop({ drawn }) {
  const pathRef = useRef(null)
  const dotRef = useRef(null)
  const lapRef = useRef(null)
  const stationRefs = useRef([])

  useFrame(drawn, (t) => {
    const along = ((t % LAP_MS) / LAP_MS) * TOTAL
    const p = pathRef.current.getPointAtLength(along)
    dotRef.current.setAttribute('cx', p.x)
    dotRef.current.setAttribute('cy', p.y)
    STATIONS.forEach((s, i) => {
      const gap = Math.abs(along - s.at)
      stationRefs.current[i].classList.toggle('is-lit', Math.min(gap, TOTAL - gap) < 45)
    })
    lapRef.current.textContent = `Iteration ${Math.floor(t / LAP_MS) + 1}`
  })

  return (
    <figure className={`artifact ${drawn ? 'is-drawn' : ''}`}>
      <svg className="artifact__svg" viewBox="0 0 600 215" role="img" aria-label="A loop of four steps around Terrin.io: decide, design, ship, and learn">
        <path ref={pathRef} className="draw loop__track" pathLength="1" d={LOOP} />
        <path className="fade loop__flow" style={{ '--d': '0.9s' }} d={LOOP} />

        {STATIONS.map((s, i) => (
          <g
            key={s.name}
            ref={(el) => (stationRefs.current[i] = el)}
            className="fade loop__station"
            style={{ '--d': `${0.5 + i * 0.15}s` }}
          >
            <circle cx={s.x} cy={s.y} r="7" />
            <text className="art-label" x={s.lx} y={s.ly} textAnchor={s.anchor}>{s.name}</text>
          </g>
        ))}

        <circle ref={dotRef} className="art-ball" cx="150" cy="35" r="4.5" />

        <g className="fade" style={{ '--d': '1.1s' }}>
          <text className="art-figure" x="300" y="106" textAnchor="middle">Terrin.io</text>
          <text ref={lapRef} className="art-label" x="300" y="126" textAnchor="middle">Iteration 1</text>
        </g>
      </svg>
      <figcaption>How I build on my own time: decide what to make, design it, ship it, learn, and go around again.</figcaption>
    </figure>
  )
}
