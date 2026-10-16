import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { onThemeChange, readVars } from '../lib/theme'

const FOV = (120 * Math.PI) / 180
const HALF = FOV / 2
const RANGE = 6
const FRAME_MS = 66
const HISTORY = 4
const TRAIL = 36
const STILL = 0.1
const COLOR_VARS = ['ink', 'muted', 'contour', 'contour-strong', 'signal', 'map-water', 'display']
const SHORT_STATE = { Approaching: 'Nearer', Receding: 'Away', Static: 'Still' }
const MODES = [
  { id: 'velocity', label: 'Velocity' },
  { id: 'intensity', label: 'Intensity' },
]

const gauss = () => {
  let u = 0
  let v = 0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const inFov = (x, y) => y > 0.2 && Math.hypot(x, y) <= RANGE && Math.abs(Math.atan2(x, y)) <= HALF
const snrAt = (rcs, r) => rcs + 24 - 18 * Math.log10(Math.max(r, 0.5)) + gauss() * 2.5
const intensityNorm = (snr) => Math.min(1, Math.max(0, (snr - 4) / 28))
const stateOf = (v) => (Math.abs(v) < STILL ? 'Static' : v < 0 ? 'Approaching' : 'Receding')

function randomSpot() {
  const r = 1.2 + Math.random() * (RANGE - 1.8)
  const az = (Math.random() * 2 - 1) * (HALF - 0.12)
  return { x: r * Math.sin(az), y: r * Math.cos(az) }
}

export default function RadarScope() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const modeRef = useRef('velocity')
  const [mode, setMode] = useState('velocity')
  const [summary, setSummary] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(COLOR_VARS)
    let geo = null
    let frameId = 0
    let running = false
    let last = performance.now()
    let sinceFrame = 0
    let frameCount = 0
    let lastReadout = 0

    const walker = (id, name) => ({ id, name, ...randomSpot(), vx: 0, vy: 0, goal: randomSpot(), wait: 0, rcs: 10, kind: 'walker' })
    const targets = [
      { id: 1, name: 'You', x: 0, y: 3, vx: 0, vy: 0, rcs: 10, kind: 'pointer', present: false },
      walker(2, 'Person A'),
      walker(3, 'Person B'),
      { id: 4, name: 'Chair', x: -1.7, y: 2.3, vx: 0, vy: 0, rcs: 15, kind: 'object' },
      { id: 5, name: 'Desk', x: 2.3, y: 4.2, vx: 0, vy: 0, rcs: 20, kind: 'object' },
    ]
    const tracks = new Map()
    const frames = []
    const wall = Array.from({ length: 18 }, (_, i) => -HALF + (i / 17) * FOV)

    const layout = () => {
      const width = wrapRef.current.clientWidth
      const height = Math.round(Math.min(380, Math.max(260, width * 0.56)))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const ox = width / 2
      const oy = height - 22
      const scale = Math.min((height - 40) / RANGE, (width / 2 - 16) / (RANGE * Math.sin(HALF)))
      geo = {
        width,
        height,
        ox,
        oy,
        scale,
        toScreen: (x, y) => [ox + x * scale, oy - y * scale],
        toMeters: (px, py) => ({ x: (px - ox) / scale, y: (oy - py) / scale }),
      }
    }

    const capture = () => {
      frameCount++
      const points = []
      for (const t of targets) {
        if (t.kind === 'pointer' && !t.present) continue
        if (!inFov(t.x, t.y)) continue
        const r = Math.hypot(t.x, t.y)
        const radial = (t.vx * t.x + t.vy * t.y) / r
        const fixed = t.kind === 'object'
        const n = fixed ? 6 + Math.floor(Math.random() * 5) : 9 + Math.floor(Math.random() * 9)
        let mx = 0
        let my = 0
        let ms = 0
        for (let i = 0; i < n; i++) {
          const px = t.x + gauss() * (fixed ? 0.1 : 0.16)
          const py = t.y + gauss() * (fixed ? 0.12 : 0.22)
          const snr = snrAt(t.rcs, r)
          mx += px
          my += py
          ms += snr
          points.push({ x: px, y: py, v: radial + gauss() * (fixed ? 0.02 : 0.08), snr })
        }
        const track = tracks.get(t.id) || { x: mx / n, y: my / n, v: radial, snr: ms / n, trail: [], seen: 0 }
        track.x += (mx / n - track.x) * 0.4
        track.y += (my / n - track.y) * 0.4
        track.v += (radial - track.v) * 0.35
        track.snr += (ms / n - track.snr) * 0.3
        track.points = n
        track.trail.push([track.x, track.y])
        if (track.trail.length > TRAIL) track.trail.shift()
        track.seen = frameCount
        track.kind = t.kind
        track.name = t.name
        tracks.set(t.id, track)
      }
      for (const az of wall) {
        if (Math.random() < 0.55) {
          const r = 5.5 + gauss() * 0.05
          points.push({ x: r * Math.sin(az + gauss() * 0.02), y: r * Math.cos(az), v: 0, snr: snrAt(6, r), clutter: true })
        }
      }
      for (let i = 0; i < 3; i++) {
        const p = randomSpot()
        points.push({ ...p, v: 0, snr: snrAt(-2, Math.hypot(p.x, p.y)), clutter: true })
      }
      for (const [id, track] of tracks) {
        if (frameCount - track.seen > 8) tracks.delete(id)
      }
      frames.push(points)
      if (frames.length > HISTORY) frames.shift()
    }

    const move = (dt) => {
      const s = dt / 1000
      for (const t of targets) {
        if (t.kind === 'pointer') {
          if (t.walkTo) {
            const dx = t.walkTo.x - t.x
            const dy = t.walkTo.y - t.y
            const d = Math.hypot(dx, dy)
            if (d < 0.05) {
              t.walkTo = null
            } else {
              const speed = Math.min(1.4, d * 2)
              t.vx += ((dx / d) * speed - t.vx) * Math.min(1, s * 4)
              t.vy += ((dy / d) * speed - t.vy) * Math.min(1, s * 4)
              t.x += t.vx * s
              t.y += t.vy * s
              continue
            }
          }
          t.vx *= Math.exp(-s * 5)
          t.vy *= Math.exp(-s * 5)
          continue
        }
        if (t.kind !== 'walker') continue
        if (t.wait > 0) {
          t.wait -= dt
          t.vx *= Math.exp(-s * 8)
          t.vy *= Math.exp(-s * 8)
          continue
        }
        const dx = t.goal.x - t.x
        const dy = t.goal.y - t.y
        const d = Math.hypot(dx, dy)
        if (d < 0.15) {
          t.goal = randomSpot()
          if (Math.random() < 0.6) t.wait = 1200 + Math.random() * 2500
          continue
        }
        const speed = 0.8
        t.vx += ((dx / d) * speed - t.vx) * Math.min(1, s * 2)
        t.vy += ((dy / d) * speed - t.vy) * Math.min(1, s * 2)
        t.x += t.vx * s
        t.y += t.vy * s
      }
    }

    const pointColor = (p) => {
      if (modeRef.current === 'intensity') return colors.signal
      if (p.clutter) return colors['contour-strong']
      if (p.v < -STILL) return colors.signal
      if (p.v > STILL) return colors.ink
      return colors.muted
    }

    const draw = () => {
      const { width, height, ox, oy, scale, toScreen } = geo
      const byIntensity = modeRef.current === 'intensity'
      ctx.clearRect(0, 0, width, height)

      ctx.beginPath()
      ctx.moveTo(ox, oy)
      ctx.arc(ox, oy, RANGE * scale, -Math.PI / 2 - HALF, -Math.PI / 2 + HALF)
      ctx.closePath()
      ctx.fillStyle = colors['map-water']
      ctx.fill()

      ctx.strokeStyle = colors.contour
      ctx.lineWidth = 1
      ctx.font = `500 10px ${colors.display}`
      ctx.fillStyle = colors.muted
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      for (let r = 1; r <= RANGE; r++) {
        ctx.beginPath()
        ctx.arc(ox, oy, r * scale, -Math.PI / 2 - HALF, -Math.PI / 2 + HALF)
        ctx.strokeStyle = r === RANGE ? colors['contour-strong'] : colors.contour
        ctx.stroke()
        const [lx, ly] = toScreen(r * Math.sin(HALF) + 0.12, r * Math.cos(HALF))
        ctx.fillText(`${r} m`, lx, ly)
      }
      for (let deg = -60; deg <= 60; deg += 30) {
        const az = (deg * Math.PI) / 180
        const [x, y] = toScreen(RANGE * Math.sin(az), RANGE * Math.cos(az))
        ctx.beginPath()
        ctx.moveTo(ox, oy)
        ctx.lineTo(x, y)
        ctx.strokeStyle = deg === 0 ? colors['contour-strong'] : colors.contour
        ctx.stroke()
      }

      frames.forEach((points, fi) => {
        const fade = 1 - (frames.length - 1 - fi) / HISTORY
        for (const p of points) {
          const [x, y] = toScreen(p.x, p.y)
          const k = intensityNorm(p.snr)
          const size = byIntensity ? 2 + k * 3 : 3
          ctx.globalAlpha = byIntensity ? fade * (0.15 + k * 0.85) : fade
          ctx.fillStyle = pointColor(p)
          ctx.fillRect(x - size / 2, y - size / 2, size, size)
        }
      })
      ctx.globalAlpha = 1

      for (const track of tracks.values()) {
        const moving = Math.abs(track.v) >= STILL
        if (track.kind !== 'object' && track.trail.length > 1) {
          ctx.beginPath()
          track.trail.forEach(([tx, ty], i) => {
            const [x, y] = toScreen(tx, ty)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          })
          ctx.strokeStyle = colors.signal
          ctx.globalAlpha = 0.35
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.globalAlpha = 1
        }
        const [x, y] = toScreen(track.x, track.y)
        ctx.strokeStyle = moving ? colors.signal : colors.muted
        ctx.lineWidth = 1.5
        if (track.kind === 'object') {
          const half = 0.32 * scale
          ctx.setLineDash([3, 3])
          ctx.strokeRect(x - half, y - half, half * 2, half * 2)
          ctx.setLineDash([])
        } else {
          ctx.beginPath()
          ctx.arc(x, y, 0.38 * scale, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.fillStyle = colors.ink
        ctx.font = `600 11px ${colors.display}`
        ctx.textAlign = 'left'
        ctx.fillText(`${track.name}  ${Math.hypot(track.x, track.y).toFixed(1)} m`, x + 0.38 * scale + 6, y - 6)
      }

      ctx.fillStyle = colors.ink
      ctx.fillRect(ox - 9, oy + 4, 18, 8)
      ctx.fillStyle = colors.muted
      ctx.font = `500 10px ${colors.display}`
      ctx.textAlign = 'left'
      ctx.fillText(`Frame ${frameCount}`, 12, height - 14)
    }

    const updateReadout = (now) => {
      if (now - lastReadout < 250) return
      lastReadout = now
      const list = [...tracks.entries()]
        .map(([id, t]) => ({
          id,
          name: t.name,
          state: stateOf(t.v),
          distance: Math.hypot(t.x, t.y),
          velocity: t.v,
          intensity: t.snr,
          angle: (Math.atan2(t.x, t.y) * 180) / Math.PI,
          points: t.points,
        }))
        .sort((a, b) => a.distance - b.distance)
      setRows(list)
      if (!list.length) {
        setSummary('Nothing in the field of view.')
        return
      }
      const moving = list.filter((r) => r.state !== 'Static').length
      setSummary(`${moving} moving, ${list.length - moving} static. Nearest: ${list[0].name}, ${list[0].distance.toFixed(1)} m`)
    }

    const loop = (now) => {
      frameId = requestAnimationFrame(loop)
      const dt = Math.min(64, now - last)
      last = now
      move(dt)
      sinceFrame += dt
      if (sinceFrame >= FRAME_MS) {
        sinceFrame = 0
        capture()
      }
      draw()
      updateReadout(now)
    }

    const start = () => {
      if (running || reduceMotion) return
      running = true
      last = performance.now()
      frameId = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frameId)
    }

    const pointerTarget = targets[0]
    let lastPointer = null
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const p = geo.toMeters(e.clientX - rect.left, e.clientY - rect.top)
      const now = performance.now()
      if (e.pointerType !== 'mouse' && !reduceMotion) {
        if (e.type !== 'pointerdown') return
        if (!pointerTarget.present) {
          pointerTarget.x = 0
          pointerTarget.y = p.y > RANGE / 2 ? 0.8 : RANGE - 0.4
          pointerTarget.present = true
        }
        pointerTarget.walkTo = p
        return
      }
      pointerTarget.walkTo = null
      if (lastPointer) {
        const dt = Math.max(16, now - lastPointer.t) / 1000
        pointerTarget.vx += ((p.x - lastPointer.x) / dt - pointerTarget.vx) * 0.3
        pointerTarget.vy += ((p.y - lastPointer.y) / dt - pointerTarget.vy) * 0.3
      }
      lastPointer = { ...p, t: now }
      pointerTarget.x = p.x
      pointerTarget.y = p.y
      pointerTarget.present = true
      if (reduceMotion) {
        capture()
        draw()
        updateReadout(now + 1000)
      }
    }
    const onLeave = (e) => {
      if (e.pointerType !== 'mouse') return
      pointerTarget.present = false
      lastPointer = null
    }

    layout()
    for (let i = 0; i < HISTORY; i++) capture()
    draw()
    updateReadout(1000)
    const ro = new ResizeObserver(() => { layout(); draw() })
    ro.observe(wrapRef.current)
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
    io.observe(canvas)
    const offTheme = onThemeChange(() => {
      colors = readVars(COLOR_VARS)
      draw()
    })
    const offMode = () => draw()
    window.addEventListener('radar:mode', offMode)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      offTheme()
      window.removeEventListener('radar:mode', offMode)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const chooseMode = (id) => {
    modeRef.current = id
    setMode(id)
    window.dispatchEvent(new Event('radar:mode'))
  }

  return (
    <figure className="radar" id="radar">
      <div className="radar__bar">
        <span className="radar__bar-label">Color points by</span>
        <div className="segmented segmented--small" role="group" aria-label="Color points by">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className="segmented__option"
              aria-pressed={mode === m.id}
              onClick={() => chooseMode(m.id)}
            >
              {mode === m.id && (
                <motion.span
                  layoutId="radar-pill"
                  className="segmented__pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="segmented__label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="radar__scope" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="radar__canvas"
          role="img"
          aria-label="Simulated mmWave radar point cloud with people and objects. Move your cursor into the field of view, or tap a spot to walk there, to be tracked."
        />
      </div>

      <div className="radar__legend">
        <p className="radar__readout" aria-live="off">{summary}</p>
        {mode === 'velocity' ? (
          <ul className="radar__key">
            <li><span className="swatch swatch--toward" />Approaching</li>
            <li><span className="swatch swatch--away" />Receding</li>
            <li><span className="swatch swatch--static" />Static</li>
          </ul>
        ) : (
          <p className="radar__ramp">
            Weak <span className="radar__ramp-bar" aria-hidden="true" /> Strong
          </p>
        )}
      </div>

      <div className="radar__table-wrap">
        <table className="radar__table">
          <thead>
            <tr>
              <th scope="col">Object</th>
              <th scope="col">State</th>
              <th scope="col">Distance<span className="radar__head-unit"> (m)</span></th>
              <th scope="col">Velocity<span className="radar__head-unit"> (m/s)</span></th>
              <th scope="col">Intensity<span className="radar__head-unit"> (dB)</span></th>
              <th scope="col" className="radar__col-angle">Angle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.state === 'Static' ? 'is-static' : ''}>
                <th scope="row">{r.name}</th>
                <td>
                  <span className={`radar__state radar__state--${r.state.toLowerCase()}`}>
                    <span className="radar__state-full">{r.state}</span>
                    <span className="radar__state-short" aria-hidden="true">{SHORT_STATE[r.state]}</span>
                  </span>
                </td>
                <td>{r.distance.toFixed(2)}<span className="radar__unit"> m</span></td>
                <td>{r.velocity >= 0 ? '+' : '−'}{Math.abs(r.velocity).toFixed(2)}<span className="radar__unit"> m/s</span></td>
                <td>
                  <span className="radar__meter" style={{ '--k': intensityNorm(r.intensity) }} />
                  {r.intensity.toFixed(0)}<span className="radar__unit"> dB</span>
                </td>
                <td className="radar__col-angle">{r.angle >= 0 ? '+' : '−'}{Math.abs(r.angle).toFixed(0)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="demo__caption">
        A simulated mmWave point cloud: 120° view, 6 m range. Move your cursor into the cone, or
        tap it, to walk in as a third person.
      </figcaption>
    </figure>
  )
}
