import { useMemo } from 'react'
import { motion, useTransform } from 'motion/react'

const W = 260
const H = 104
const PAD_TOP = 10
const PAD_BOTTOM = 22

// Cosine-smoothed climb through each chapter, with a little trail texture.
function elevationAt(x, stops) {
  if (x <= stops[0].x) return stops[0].e
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1)
      const s = (1 - Math.cos(t * Math.PI)) / 2
      return a.e + (b.e - a.e) * s
    }
  }
  return stops[stops.length - 1].e
}

export default function Profile({ chapters, positions, progress, active }) {
  const { line, area, sample, stops } = useMemo(() => {
    const stops = chapters.map((c, i) => ({
      x: positions[i] ?? i / (chapters.length - 1),
      e: c.elevation / 10,
    }))
    const toY = (e) => H - PAD_BOTTOM - (e / 100) * (H - PAD_TOP - PAD_BOTTOM)
    const sample = (x) => {
      const wiggle = Math.sin(x * 47) * 1.6 + Math.sin(x * 113) * 0.9
      return toY(elevationAt(x, stops) + wiggle)
    }
    const pts = []
    for (let i = 0; i <= 120; i++) {
      const x = i / 120
      pts.push([x * W, sample(x)])
    }
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    const area = `${line} L${W} ${H - PAD_BOTTOM} L0 ${H - PAD_BOTTOM} Z`
    return { line, area, sample, stops }
  }, [chapters, positions])

  const clipWidth = useTransform(progress, (v) => Math.max(0, Math.min(1, v)) * W)
  const dotX = useTransform(progress, (v) => Math.max(0, Math.min(1, v)) * W)
  const dotY = useTransform(progress, (v) => sample(Math.max(0, Math.min(1, v))))

  return (
    <svg className="profile" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <clipPath id="profile-progress">
          <motion.rect x="0" y="0" height={H} width={clipWidth} />
        </clipPath>
      </defs>
      <line className="profile__base" x1="0" y1={H - PAD_BOTTOM} x2={W} y2={H - PAD_BOTTOM} />
      <path className="profile__line" d={line} />
      <g clipPath="url(#profile-progress)">
        <path className="profile__area" d={area} />
        <path className="profile__line profile__line--done" d={line} />
      </g>
      {stops.map((s, i) => (
        <g key={chapters[i].id} className={i <= active ? 'profile__stop is-reached' : 'profile__stop'}>
          <line x1={s.x * W} y1={H - PAD_BOTTOM} x2={s.x * W} y2={H - PAD_BOTTOM + 4} />
          <text x={s.x * W} y={H - 6} textAnchor={i === 0 ? 'start' : i === stops.length - 1 ? 'end' : 'middle'}>
            {typeof chapters[i].year === 'number' ? `’${String(chapters[i].year).slice(2)}` : chapters[i].year}
          </text>
        </g>
      ))}
      <motion.circle className="profile__dot" r="4.5" cx={dotX} cy={dotY} />
    </svg>
  )
}
