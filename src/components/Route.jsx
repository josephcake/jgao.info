import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent } from 'motion/react'

const WIDTH = 40
const BEND_EVERY = 240
const SAMPLES = 600

// Deterministic switchbacks so the trail looks the same on every visit.
const swing = (i) => 7 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 7

function trail(nodes) {
  const pts = [nodes[0]]
  let bend = 0
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]
    const b = nodes[i + 1]
    const bends = Math.max(2, Math.round((b.y - a.y) / BEND_EVERY))
    for (let k = 1; k < bends; k++) {
      const t = k / bends
      const side = bend++ % 2 ? 1 : -1
      const fade = Math.sin(t * Math.PI)
      pts.push({ x: a.x + (b.x - a.x) * t + side * swing(bend) * (0.4 + fade * 0.6), y: a.y + (b.y - a.y) * t })
    }
    pts.push(b)
  }
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

export default function Route({ trackRef, chapterRefs, progress }) {
  const [geo, setGeo] = useState(null)
  const doneRef = useRef(null)
  const markerRef = useRef(null)
  const samples = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    const measure = () => {
      const box = track.getBoundingClientRect()
      const nodes = chapterRefs.current
        .map((el) => el?.querySelector('.chapter__node'))
        .filter(Boolean)
        .map((node) => {
          const r = node.getBoundingClientRect()
          return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }
        })
      if (nodes.length > 1) setGeo({ height: track.offsetHeight, d: trail(nodes) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [trackRef, chapterRefs])

  const place = (v) => {
    const path = doneRef.current
    const table = samples.current
    if (!path || !table || !geo) return
    const y = Math.max(0, Math.min(1, v)) * geo.height
    let lo = 0
    let hi = table.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (table[mid].y < y) lo = mid + 1
      else hi = mid
    }
    const at = table[lo]
    path.style.strokeDashoffset = `${table.total - at.len}`
    markerRef.current.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`)
  }

  useEffect(() => {
    const path = doneRef.current
    if (!path || !geo) return
    const total = path.getTotalLength()
    const table = []
    let maxY = -Infinity
    for (let i = 0; i <= SAMPLES; i++) {
      const len = (i / SAMPLES) * total
      const p = path.getPointAtLength(len)
      maxY = Math.max(maxY, p.y)
      table.push({ len, x: p.x, y: maxY })
    }
    table.total = total
    samples.current = table
    path.style.strokeDasharray = `${total} ${total}`
    place(progress.get())
  }, [geo])

  useMotionValueEvent(progress, 'change', place)

  if (!geo) return null

  return (
    <svg
      className="route"
      width={WIDTH}
      height={geo.height}
      viewBox={`0 0 ${WIDTH} ${geo.height}`}
      aria-hidden="true"
    >
      <path className="route__planned" d={geo.d} />
      <path ref={doneRef} className="route__done" d={geo.d} />
      <g ref={markerRef} className="route__marker">
        <circle className="route__halo" r="13" />
        <circle className="route__dot" r="7" />
      </g>
    </svg>
  )
}
