import { useRef } from 'react'
import useFrame from './useFrame'
import Duck from '../Duck'

// Regulation court at 20.2 px per meter: 23.77 m by 10.97 m doubles.
const X0 = 40
const Y0 = 19
const LEN = 480
const WID = 222
const ALLEY = 28
const NET = X0 + LEN / 2
const SERVICE = 129
const MID = Y0 + WID / 2
const RALLY = 'M70 196 Q 230 40 392 92 Q 452 108 498 64 Q 330 30 186 168 Q 124 210 70 196'
const RALLY_MS = 4200

export default function Court({ drawn }) {
  const pathRef = useRef(null)
  const ballRef = useRef(null)
  const shadowRef = useRef(null)

  useFrame(drawn, (t) => {
    const path = pathRef.current
    const total = path.getTotalLength()
    const phase = (t % RALLY_MS) / RALLY_MS
    const p = path.getPointAtLength(phase * total)
    const half = (phase * 2) % 1
    const lift = Math.sin(half * Math.PI) * 14
    ballRef.current.setAttribute('cx', p.x)
    ballRef.current.setAttribute('cy', p.y - lift)
    shadowRef.current.setAttribute('cx', p.x)
    shadowRef.current.setAttribute('cy', p.y + 3)
    shadowRef.current.setAttribute('rx', 5 - lift / 6)
  })

  return (
    <figure className={`artifact artifact--court ${drawn ? 'is-drawn' : ''}`}>
      <Duck spot="court" />
      <svg className="artifact__svg" viewBox="0 0 560 262" role="img" aria-label="Top-down tennis court with a rally in progress">
        <rect className="fade art-surface" x={X0} y={Y0} width={LEN} height={WID} />
        <g className="art-stroke">
          <rect className="draw" pathLength="1" x={X0} y={Y0} width={LEN} height={WID} />
          <line className="draw" pathLength="1" style={{ '--d': '0.15s' }} x1={X0} y1={Y0 + ALLEY} x2={X0 + LEN} y2={Y0 + ALLEY} />
          <line className="draw" pathLength="1" style={{ '--d': '0.15s' }} x1={X0} y1={Y0 + WID - ALLEY} x2={X0 + LEN} y2={Y0 + WID - ALLEY} />
          <line className="draw" pathLength="1" style={{ '--d': '0.3s' }} x1={NET - SERVICE} y1={Y0 + ALLEY} x2={NET - SERVICE} y2={Y0 + WID - ALLEY} />
          <line className="draw" pathLength="1" style={{ '--d': '0.3s' }} x1={NET + SERVICE} y1={Y0 + ALLEY} x2={NET + SERVICE} y2={Y0 + WID - ALLEY} />
          <line className="draw" pathLength="1" style={{ '--d': '0.45s' }} x1={NET - SERVICE} y1={MID} x2={NET + SERVICE} y2={MID} />
          <line className="draw" pathLength="1" style={{ '--d': '0.45s' }} x1={X0} y1={MID} x2={X0 + 9} y2={MID} />
          <line className="draw" pathLength="1" style={{ '--d': '0.45s' }} x1={X0 + LEN - 9} y1={MID} x2={X0 + LEN} y2={MID} />
        </g>
        <line className="draw art-net" pathLength="1" style={{ '--d': '0.6s' }} x1={NET} y1="2" x2={NET} y2="260" />
        <path ref={pathRef} className="draw art-trail" pathLength="1" style={{ '--d': '0.9s' }} d={RALLY} />
        <circle className="fade art-mark" style={{ '--d': '1.4s' }} cx="392" cy="92" r="4" />
        <circle className="fade art-mark" style={{ '--d': '1.5s' }} cx="186" cy="168" r="4" />
        <ellipse ref={shadowRef} className="fade art-shadow" style={{ '--d': '1.2s' }} cx="70" cy="199" rx="5" ry="2" />
        <circle ref={ballRef} className="fade art-ball" style={{ '--d': '1.2s' }} cx="70" cy="196" r="5.5" />
      </svg>
      <figcaption>Two and a half years of rallies at the Central Park Tennis Center.</figcaption>
    </figure>
  )
}
