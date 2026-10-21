import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { onThemeChange, readVars } from '../lib/theme'
import { CLICKABLE, EXIT, FLOORS, H, VERTICAL, W, areaAt, directions, route } from '../lib/indoor'

const COLOR_VARS = ['paper', 'ink', 'muted', 'contour', 'contour-strong', 'signal', 'display']
const MODES = [
  { id: 'stairs', label: 'Stairs' },
  { id: 'elevator', label: 'Elevator' },
]
// The view: the plan turned and tipped, the upper floor lifted clear of the lower one
const A = 0.6
const CA = Math.cos(A)
const SA = Math.sin(A)
const TILT = 0.52
const GAP = 15.5
const WALL = 0.75
const SLAB = 0.35
const ROOMS = FLOORS.flatMap((F, f) => F.areas.map((a, k) => ({ f, k, a })).filter(({ a }) => CLICKABLE.has(a.kind)))

const rgb = (c) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim())
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [n >> 16, (n >> 8) & 255, n & 255]
  }
  const parts = c.match(/[\d.]+/g)
  return parts ? parts.slice(0, 3).map(Number) : [128, 128, 128]
}
const mix = (a, b, t) => {
  const x = rgb(a)
  const y = rgb(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}
const clock = () => new Date().toLocaleTimeString([], { hour12: false })

export default function IndoorNav() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const seq = useRef(1)
  const asked = useRef(null)
  const view = useRef({ pick: null, hover: null, route: null, shown: 1, redraw: () => {} })
  const [mode, setMode] = useState('stairs')
  const [pick, setPick] = useState(null)
  const [result, setResult] = useState(null)
  const [log, setLog] = useState([{ id: 0, at: clock(), text: 'Plan loaded: 2 floors, 1 m grid.' }])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const v = view.current
    let colors = readVars(COLOR_VARS)
    let tones = null
    let width = 0
    let height = 0
    let s = 1
    let cx = 0
    let cy = 0
    let frame = 0
    let startAt = 0

    const P = (x, y, z) => [cx + (x * CA - y * SA) * s, cy + ((x * SA + y * CA) * TILT - z) * s]
    const floorZ = (f) => f * GAP
    // The plan point under a point on the screen, on a floor
    const unproject = (px, py, z) => {
      const u = (px - cx) / s
      const w = ((py - cy) / s + z) / TILT
      return [u * CA + w * SA, -u * SA + w * CA]
    }

    const theme = () => {
      const { paper, ink, signal } = colors
      tones = {
        slab: mix(paper, ink, 0.05),
        side: [mix(paper, ink, 0.22), mix(paper, ink, 0.3)],
        room: mix(paper, ink, 0.02),
        hall: mix(paper, ink, 0.09),
        open: mix(paper, ink, 0.05),
        core: mix(paper, ink, 0.13),
        hover: mix(paper, signal, 0.14),
        pick: mix(paper, signal, 0.3),
        wall: [mix(paper, ink, 0.32), mix(paper, ink, 0.2)],
        wallTop: mix(paper, ink, 0.8),
        furniture: [mix(paper, ink, 0.26), mix(paper, ink, 0.16), mix(paper, ink, 0.1)],
        tread: mix(paper, ink, 0.34),
      }
    }

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = wrapRef.current.clientWidth
      // The building's outline on the screen, at unit scale, to fit it to the canvas
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      for (const z of [-SLAB, GAP + WALL + 1.2]) {
        for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) {
          const u = x * CA - y * SA
          const w = (x * SA + y * CA) * TILT - z
          x0 = Math.min(x0, u)
          x1 = Math.max(x1, u)
          y0 = Math.min(y0, w)
          y1 = Math.max(y1, w + 1.8)
        }
      }
      const pad = 28
      s = (width - pad * 2) / (x1 - x0)
      height = Math.round((y1 - y0) * s + pad * 2)
      cx = pad - x0 * s
      cy = pad - y0 * s
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const quad = (pts, fill, stroke, lw = 1) => {
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      if (fill) {
        ctx.fillStyle = fill
        ctx.fill()
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = lw
        ctx.stroke()
      }
    }
    const rectAt = (x, y, w, h, z) => [P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)]
    const box = (x, y, w, h, z, tall) => {
      // The two sides that face the camera, then the top
      quad([P(x, y + h, z), P(x + w, y + h, z), P(x + w, y + h, z + tall), P(x, y + h, z + tall)], tones.furniture[0])
      quad([P(x + w, y, z), P(x + w, y + h, z), P(x + w, y + h, z + tall), P(x + w, y, z + tall)], tones.furniture[1])
      quad(rectAt(x, y, w, h, z + tall), tones.furniture[2], colors['contour-strong'], 0.75)
    }

    // Where along the route the walker is, as a point on a floor, and the route drawn up to there
    const routeLength = (r) => {
      let total = 0
      r.legs.forEach((leg, i) => {
        for (let k = 1; k < leg.pts.length; k++) total += Math.hypot(leg.pts[k][0] - leg.pts[k - 1][0], leg.pts[k][1] - leg.pts[k - 1][1])
        if (i < r.legs.length - 1) total += GAP * 0.6
      })
      return total
    }

    const drawRoute = (r, upTo) => {
      let left = upTo
      let head = null
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const [i, leg] of r.legs.entries()) {
        const z = floorZ(leg.f) + 0.04
        ctx.beginPath()
        let [px, py] = leg.pts[0]
        ctx.moveTo(...P(px, py, z))
        head = P(px, py, z)
        for (let k = 1; k < leg.pts.length && left > 0; k++) {
          const [qx, qy] = leg.pts[k]
          const len = Math.hypot(qx - px, qy - py)
          const t = Math.min(1, left / len)
          const x = px + (qx - px) * t
          const y = py + (qy - py) * t
          head = P(x, y, z)
          ctx.lineTo(...head)
          left -= len
          px = qx
          py = qy
        }
        ctx.strokeStyle = colors.signal
        ctx.lineWidth = 3
        ctx.stroke()
        if (left <= 0) break
        if (i < r.legs.length - 1) {
          // Down the stairs or the elevator: a dashed drop between the floors
          const [lx, ly] = VERTICAL[r.mode].at
          const top = P(lx + 0.5, ly + 0.5, z)
          const bottom = P(lx + 0.5, ly + 0.5, floorZ(r.legs[i + 1].f) + 0.04)
          const t = Math.min(1, left / (GAP * 0.6))
          const end = [top[0] + (bottom[0] - top[0]) * t, top[1] + (bottom[1] - top[1]) * t]
          ctx.setLineDash([4, 5])
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(...top)
          ctx.lineTo(...end)
          ctx.stroke()
          ctx.setLineDash([])
          head = end
          left -= GAP * 0.6
          if (left <= 0) break
        }
      }
      return head
    }

    const draw = () => {
      if (!tones) theme()
      ctx.clearRect(0, 0, width, height)
      const r = v.route
      for (const [f, F] of FLOORS.entries()) {
        const z = floorZ(f)
        // The slab, its two near edges and its floor
        quad([P(0, H, z), P(W, H, z), P(W, H, z - SLAB), P(0, H, z - SLAB)], tones.side[0])
        quad([P(W, 0, z), P(W, H, z), P(W, H, z - SLAB), P(W, 0, z - SLAB)], tones.side[1])
        quad(rectAt(0, 0, W, H, z), tones.slab)
        for (const [k, a] of F.areas.entries()) {
          const [x, y, w, h] = a.r
          const picked = v.pick && v.pick.f === f && v.pick.k === k
          const hovered = v.hover && v.hover.f === f && v.hover.k === k
          const base = a.kind === 'hall' ? tones.hall : a.kind === 'room' || a.kind === 'service' ? tones.room : a.kind === 'stairs' || a.kind === 'elevator' ? tones.core : tones.open
          quad(rectAt(x, y, w, h, z), picked ? tones.pick : hovered ? tones.hover : base)
          if (a.kind === 'stairs') {
            ctx.beginPath()
            for (let t = y + 0.5; t < y + h - 0.2; t += 0.5) {
              ctx.moveTo(...P(x + 0.3, t, z))
              ctx.lineTo(...P(x + w - 0.3, t, z))
            }
            ctx.strokeStyle = tones.tread
            ctx.lineWidth = 0.75
            ctx.stroke()
          } else if (a.kind === 'elevator') {
            ctx.beginPath()
            ctx.moveTo(...P(x + 0.4, y + 0.4, z))
            ctx.lineTo(...P(x + w - 0.4, y + h - 0.4, z))
            ctx.moveTo(...P(x + w - 0.4, y + 0.4, z))
            ctx.lineTo(...P(x + 0.4, y + h - 0.4, z))
            ctx.strokeStyle = tones.tread
            ctx.lineWidth = 0.75
            ctx.stroke()
          }
        }
        for (const [x, y, w, h] of F.furniture) box(x + 0.1, y + 0.1, w - 0.2, h - 0.2, z, 0.45)
        // Walls, far ones first
        const walls = F.walls.map((w) => ({ w, d: ((w[0] + w[2]) / 2) * SA + ((w[1] + w[3]) / 2) * CA })).sort((a, b) => a.d - b.d)
        for (const { w } of walls) {
          const [x0, y0, x1, y1] = w
          const a = P(x0, y0, z)
          const b = P(x1, y1, z)
          const c = P(x1, y1, z + WALL)
          const d = P(x0, y0, z + WALL)
          quad([a, b, c, d], tones.wall[y0 === y1 ? 0 : 1])
          ctx.beginPath()
          ctx.moveTo(...d)
          ctx.lineTo(...c)
          ctx.strokeStyle = tones.wallTop
          ctx.lineWidth = 1.25
          ctx.stroke()
        }
      }

      // Names on the plan, and each floor's own
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const small = Math.max(9, Math.min(12, s * 0.42))
      for (const [f, F] of FLOORS.entries()) {
        const z = floorZ(f) + WALL * 0.5
        for (const a of F.areas) {
          const [x, y, w, h] = a.r
          if (a.kind === 'service') continue
          const label = a.kind === 'room' ? a.id : a.name
          ctx.font = `${a.kind === 'room' ? 600 : 500} ${small}px ${colors.display}`
          ctx.fillStyle = a.kind === 'room' ? colors.ink : colors.muted
          ctx.fillText(label, ...P(x + w / 2, y + h / 2, z))
        }
        ctx.textAlign = 'left'
        ctx.font = `600 ${small + 1}px ${colors.display}`
        ctx.fillStyle = colors.ink
        const [lx, ly] = P(0, H, floorZ(f) - SLAB)
        ctx.fillText(F.name, lx, ly + 16)
        ctx.textAlign = 'center'
      }
      // The front door
      const door = P(EXIT.at[0], EXIT.at[1] + 0.9, 0)
      ctx.font = `600 ${small}px ${colors.display}`
      ctx.fillStyle = colors.signal
      ctx.fillText('Front door', door[0], door[1] + 10)
      ctx.beginPath()
      ctx.moveTo(...P(EXIT.at[0] - 0.6, EXIT.at[1] + 0.2, 0))
      ctx.lineTo(...P(EXIT.at[0], EXIT.at[1] + 0.8, 0))
      ctx.lineTo(...P(EXIT.at[0] + 0.6, EXIT.at[1] + 0.2, 0))
      ctx.strokeStyle = colors.signal
      ctx.lineWidth = 1.5
      ctx.stroke()

      if (r) {
        const total = routeLength(r)
        const head = drawRoute(r, total * v.shown)
        const [sx, sy] = r.legs[0].pts[0]
        const start = P(sx, sy, floorZ(r.legs[0].f) + 0.04)
        ctx.beginPath()
        ctx.arc(start[0], start[1], 5, 0, Math.PI * 2)
        ctx.fillStyle = colors.paper
        ctx.fill()
        ctx.strokeStyle = colors.signal
        ctx.lineWidth = 2
        ctx.stroke()
        if (head) {
          ctx.beginPath()
          ctx.arc(head[0], head[1], 4.5, 0, Math.PI * 2)
          ctx.fillStyle = colors.signal
          ctx.fill()
        }
      }
    }

    const animate = (now) => {
      const r = v.route
      if (!r) return
      if (!startAt) startAt = now
      const length = routeLength(r)
      v.shown = Math.min(1, (now - startAt) / Math.max(900, length * 45))
      draw()
      if (v.shown < 1) frame = requestAnimationFrame(animate)
    }
    v.redraw = (fresh) => {
      cancelAnimationFrame(frame)
      if (fresh && v.route && !still) {
        v.shown = 0
        startAt = 0
        frame = requestAnimationFrame(animate)
      } else {
        v.shown = 1
        draw()
      }
    }

    const hit = (e) => {
      const rect = canvas.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      for (let f = FLOORS.length - 1; f >= 0; f--) {
        const [x, y] = unproject(px, py, floorZ(f))
        const k = areaAt(f, x, y)
        if (k >= 0) return CLICKABLE.has(FLOORS[f].areas[k].kind) ? { f, k } : null
      }
      return null
    }
    const onMove = (e) => {
      const h = hit(e)
      const same = (h && v.hover && h.f === v.hover.f && h.k === v.hover.k) || (!h && !v.hover)
      canvas.style.cursor = h ? 'pointer' : 'default'
      if (same) return
      v.hover = h
      if (v.shown >= 1) draw()
    }
    const onLeave = () => {
      v.hover = null
      if (v.shown >= 1) draw()
    }
    const onClick = (e) => {
      const h = hit(e)
      if (h) window.dispatchEvent(new CustomEvent('indoor:pick', { detail: h }))
    }

    layout()
    draw()
    const ro = new ResizeObserver(() => {
      layout()
      draw()
    })
    ro.observe(wrapRef.current)
    const offTheme = onThemeChange(() => {
      colors = readVars(COLOR_VARS)
      tones = null
      draw()
    })
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      offTheme()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  useEffect(() => {
    const onPick = (e) => setPick(e.detail)
    window.addEventListener('indoor:pick', onPick)
    return () => window.removeEventListener('indoor:pick', onPick)
  }, [])

  // A new room or a new way down: route again and log it
  useEffect(() => {
    const v = view.current
    v.pick = pick
    if (!pick) return
    const r = route(pick.f, pick.k, mode)
    v.route = r
    v.redraw(true)
    if (!r) return
    const d = directions(r)
    setResult({ ...d, from: r.from.name, floor: pick.f + 1 })
    const by = d.changes ? ` by ${mode}` : ''
    const at = clock()
    const lines = [
      `Route: ${d.metres} m${by}, about ${d.seconds} s.`,
      `A* searched ${r.explored} cells in ${r.ms.toFixed(1)} ms.`,
      asked.current === pick ? `Switched to the ${mode}.` : `${r.from.name} picked, floor ${pick.f + 1}.`,
    ].map((text) => ({ id: seq.current++, at, text }))
    asked.current = pick
    setLog((l) => [...lines, ...l].slice(0, 9))
  }, [pick, mode])

  const chooseRoom = (e) => {
    const room = ROOMS[Number(e.target.value)]
    if (room) setPick({ f: room.f, k: room.k })
  }
  const pickIndex = pick ? ROOMS.findIndex((r) => r.f === pick.f && r.k === pick.k) : -1

  return (
    <figure className="indoor" id="indoor" data-ui>
      <div className="indoor__bar">
        <label className="indoor__select">
          <span className="radar__bar-label">From</span>
          <select value={pickIndex} onChange={chooseRoom}>
            <option value={-1} disabled>
              Pick a room
            </option>
            {ROOMS.map((r, i) => (
              <option key={`${r.f}-${r.a.id}`} value={i}>
                {r.a.name}, floor {r.f + 1}
              </option>
            ))}
          </select>
        </label>
        <div className="indoor__mode">
          <span className="radar__bar-label">Down by</span>
          <div className="segmented segmented--small" role="group" aria-label="Go between floors by">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className="segmented__option"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
              >
                {mode === m.id && (
                  <motion.span
                    layoutId="indoor-pill"
                    className="segmented__pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="segmented__label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="indoor__plan" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="indoor__canvas"
          role="img"
          aria-label="A two-floor building plan in 3D. Click a room to route from it to the front door, around walls and furniture."
        />
      </div>

      <aside className="indoor__side" aria-live="polite">
        {result ? (
          <>
            <p className="indoor__from">
              {result.from}, floor {result.floor} <span aria-hidden="true">→</span> Front door
            </p>
            <p className="indoor__meta">
              {result.metres} m · about {result.seconds} s
              {result.changes ? ` · ${mode}` : ' · same floor'}
            </p>
            <ol className="indoor__steps">
              {result.steps.map((st, i) => (
                <li key={`${i}-${st.text}`} className={st.vertical ? 'is-vertical' : st.end ? 'is-end' : ''}>
                  <span>{st.text}</span>
                  {st.d > 0 && <span className="indoor__d">{st.d} m</span>}
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="indoor__empty">Click a room on either floor to route it to the front door.</p>
        )}
        <ul className="indoor__log" aria-label="Log">
          {log.map((l) => (
            <li key={l.id}>
              <time>{l.at}</time> {l.text}
            </li>
          ))}
        </ul>
      </aside>

      <figcaption className="demo__caption">
        A 1 m walkable grid per floor: walls block, doors and open spaces don&rsquo;t. A* finds the
        way, then the path is pulled straight wherever it stays clear of the walls.
      </figcaption>
    </figure>
  )
}
