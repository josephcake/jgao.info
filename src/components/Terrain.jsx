import { useEffect, useRef } from 'react'
import { createNoise3D } from '../lib/noise'
import { createScene, PITCH_MAX } from '../lib/heroScene'
import { onThemeChange, readVars } from '../lib/theme'

const CELL = 14
const LEVELS = 16
const MIN = -0.95
const MAX = 1.35
const STEP = (MAX - MIN) / LEVELS
const COURT_LEVEL = MIN + 8 * STEP
const RISE = 150
const BANDS = 5
const VARS = ['contour', 'contour-strong', 'signal', 'ink', 'paper', 'map-land', 'map-water']

// Marching-squares segments keyed by corner bits (tl=8, tr=4, br=2, bl=1).
// Edges: 0 top, 1 right, 2 bottom, 3 left.
const SEGMENTS = [
  [], [[3, 2]], [[2, 1]], [[3, 1]],
  [[0, 1]], [[0, 1], [3, 2]], [[0, 2]], [[0, 3]],
  [[0, 3]], [[0, 2]], [[0, 3], [2, 1]], [[0, 1]],
  [[3, 1]], [[2, 1]], [[3, 2]], [],
]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, v) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}

export default function Terrain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const noise = createNoise3D(11)
    const scene = createScene()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(VARS)

    let width = 0
    let height = 0
    let maxCols = 0
    let maxRows = 0
    let cols = 0
    let rows = 0
    let pinLen = 0
    let field = new Float32Array(0)
    let frame = 0
    let lastDraw = 0
    let dirty = true
    const grid = { x0: 0, y0: 0, cell: CELL }
    const cam = { zoom: 1, fx: 0, fy: 0, fz: 0, sin: 0, cos: 1, ys: 0, yc: 1, fd: 1, cx: 0, cy: 0 }
    const P = [0, 0]
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, strength: 0, target: 0 }
    const lean = { x: 0, y: 0 }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      maxCols = Math.ceil((width * 2) / CELL) + 3
      maxRows = Math.ceil((height * 4.2) / CELL) + 3
      field = new Float32Array(maxCols * maxRows)
      const hero = document.querySelector('.hero')
      pinLen = hero ? Math.max(0, hero.offsetHeight - height) : 0
      scene.resize(width, height, captionBox(), dpr)
      dirty = true
    }

    const captionBox = () => {
      const acts = document.querySelectorAll('.hero__act')
      if (!acts.length) return null
      const left = acts[0].offsetParent?.offsetLeft || 0
      let right = 0
      let bottom = 0
      acts.forEach((el) => {
        right = Math.max(right, left + el.offsetLeft + el.offsetWidth)
        bottom = Math.max(bottom, el.offsetTop + el.offsetHeight)
      })
      return { right, bottom }
    }

    // Ground-plane coordinates (u, v, h) to the screen, through the pitched camera.
    const projectPlane = (u, v, h) => {
      const dy = v - cam.cy
      const depth = cam.fd - h * cam.cos - dy * cam.sin
      if (depth < 80) return 0
      const s = cam.fd / depth
      P[0] = cam.cx + (u - cam.cx) * s
      P[1] = cam.cy + (dy * cam.cos - h * cam.sin) * s
      return s
    }
    const pt = (x, y, z) => {
      const dx = x - cam.fx
      const dy = y - cam.fy
      const u = (dx * cam.yc - dy * cam.ys) * cam.zoom + cam.cx
      const v = (dx * cam.ys + dy * cam.yc) * cam.zoom + cam.cy
      return projectPlane(u, v, (z - cam.fz) * cam.zoom) ? [P[0], P[1]] : null
    }

    const sample = (time, after, t, court) => {
      const z = time * 0.000035 + after * 0.00035
      const drift = after * 0.25
      const cell = CELL * (1 + 0.5 * t)
      grid.cell = cell
      const ox = Math.abs(cam.cx - width / 2)
      const above = cam.fz - (court ? court.z : 0)
      const oy = Math.max(0, cam.cy - height * 0.62) + Math.min(height * 1.2, Math.max(0, above) * cam.zoom * 1.2)
      grid.x0 = -(width * 0.5 + ox) * t
      grid.y0 = -(height * 1.6 + oy) * t
      cols = Math.min(maxCols, Math.ceil((width * (1 + t) + 2 * ox * t) / cell) + 2)
      rows = Math.min(maxRows, Math.ceil((height * (1 + 2.1 * t) + oy * t) / cell) + 2)
      const bump = pointer.strength > 0.001 && t < 0.01 && Math.abs(cam.zoom - 1) < 0.01
      const radius2 = 2 * 150 * 150
      const inv = 1 / cam.zoom
      for (let j = 0; j < rows; j++) {
        const v = grid.y0 + j * cell
        const b = (v - cam.cy) * inv
        for (let i = 0; i < cols; i++) {
          const u = grid.x0 + i * cell
          const a = (u - cam.cx) * inv
          const px = a * cam.yc + b * cam.ys + cam.fx
          const py = b * cam.yc - a * cam.ys + cam.fy
          const sx = px * 0.0024
          const sy = (py + drift) * 0.0024
          let val = noise(sx, sy, z) * 0.72 + noise(sx * 2.3, sy * 2.3, z * 1.6) * 0.28
          if (court && court.k > 0) {
            const dx = px - court.x
            const dy = py - court.y
            const qx = Math.abs(dx * court.cos + dy * court.sin) - court.hu
            const qy = Math.abs(dy * court.cos - dx * court.sin) - court.hv
            const r = (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)) / court.step
            const k = court.k * (1 - smooth(court.rings, court.rings * 3.5, r))
            if (k > 0) val += (COURT_LEVEL + STEP * Math.min(court.rings + 0.5, Math.max(-0.5, r)) - val) * k
          }
          if (bump) {
            const dx = u - pointer.x
            const dy = v - pointer.y
            val += 0.6 * pointer.strength * Math.exp(-(dx * dx + dy * dy) / radius2)
          }
          field[j * cols + i] = val
        }
      }
    }

    const drawContours = (view, t, after, plane) => {
      const fade = Math.max(0.45, 1 - after / (height * 1.4)) * view.contour
      const bands = t > 0 ? BANDS : 1
      const cell = grid.cell
      ctx.lineJoin = 'round'

      for (let l = 0; l < LEVELS; l++) {
        const level = MIN + l * STEP
        const lift = level * RISE * view.relief * t + (plane - cam.fz) * cam.zoom
        const isIndex = l % 4 === 0
        for (let b = 0; b < bands; b++) {
          const j0 = Math.floor(((rows - 1) * b) / bands)
          const j1 = Math.floor(((rows - 1) * (b + 1)) / bands)
          ctx.beginPath()
          for (let j = j0; j < j1; j++) {
            for (let i = 0; i < cols - 1; i++) {
              const tl = field[j * cols + i]
              const tr = field[j * cols + i + 1]
              const br = field[(j + 1) * cols + i + 1]
              const bl = field[(j + 1) * cols + i]
              const code = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
              if (code === 0 || code === 15) continue
              const x = grid.x0 + i * cell
              const y = grid.y0 + j * cell
              for (const [ea, eb] of SEGMENTS[code]) {
                for (const e of [ea, eb]) {
                  let px
                  let py
                  if (e === 0) { px = x + cell * ((level - tl) / (tr - tl)); py = y }
                  else if (e === 1) { px = x + cell; py = y + cell * ((level - tr) / (br - tr)) }
                  else if (e === 2) { px = x + cell * ((level - bl) / (br - bl)); py = y + cell }
                  else { px = x; py = y + cell * ((level - tl) / (bl - tl)) }
                  if (t > 0) {
                    if (!projectPlane(px, py, lift)) break
                    px = P[0]
                    py = P[1]
                  }
                  if (e === ea) ctx.moveTo(px, py)
                  else ctx.lineTo(px, py)
                }
              }
            }
          }
          const near = (b + 0.5) / bands
          ctx.globalAlpha = fade * (1 - t * 0.7 * (1 - near))
          ctx.strokeStyle = isIndex ? colors['contour-strong'] : colors.contour
          ctx.lineWidth = (isIndex ? 1.15 : 0.7) * (1 + 0.8 * t * near)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    const tick = (time) => {
      frame = requestAnimationFrame(tick)
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      pointer.strength += (pointer.target - pointer.strength) * 0.05
      if (reduceMotion && !dirty) return
      const scroll = window.scrollY
      const p = reduceMotion || pinLen <= 0 ? 1 : clamp01(scroll / pinLen)
      const after = Math.max(0, scroll - (reduceMotion ? 0 : pinLen))
      const pinned = p > 0 && p < 1
      if (time - lastDraw < (pinned ? 16 : 32)) return
      lastDraw = time
      dirty = false

      const view = pinned ? scene.camera(p) : { zoom: 1, pitch: 0, yaw: 0, fx: width / 2, fy: height * 0.62, fz: 0, ox: 0, oy: 0, contour: 1, relief: 1 }
      const t = view.pitch / PITCH_MAX
      const leaning = pinned && pointer.target > 0
      lean.x += ((leaning ? pointer.tx / width - 0.5 : 0) - lean.x) * 0.04
      lean.y += ((leaning ? pointer.ty / height - 0.5 : 0) - lean.y) * 0.04
      view.yaw += lean.x * 0.16 * t
      view.pitch = Math.min(1.12, view.pitch - lean.y * 0.12 * t)
      cam.zoom = view.zoom
      cam.fx = view.fx
      cam.fy = view.fy
      cam.fz = view.fz
      cam.sin = Math.sin(view.pitch)
      cam.cos = Math.cos(view.pitch)
      cam.ys = Math.sin(view.yaw)
      cam.yc = Math.cos(view.yaw)
      cam.fd = Math.max(width, height) * 1.2
      cam.cx = width / 2 + view.ox
      cam.cy = height * 0.62 + view.oy

      const ground = pinned ? scene.ground(p) : null
      sample(reduceMotion ? 0 : time, after, t, ground)
      ctx.clearRect(0, 0, width, height)
      drawContours(view, t, after, ground ? ground.z : 0)
      if (pinned) scene.draw(ctx, { p, time, pt, cam: view, colors })
    }

    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return
      if (pointer.target === 0) {
        pointer.x = e.clientX
        pointer.y = e.clientY
      }
      pointer.tx = e.clientX
      pointer.ty = e.clientY
      pointer.target = e.target.closest?.('a, button, input, canvas') ? 0 : 1
    }
    const onPointerLeave = () => { pointer.target = 0 }
    const onScroll = () => { dirty = true }
    const offTheme = onThemeChange(() => {
      colors = readVars(VARS)
      dirty = true
    })

    resize()
    document.fonts?.ready.then(resize)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', onScroll, { passive: true })
    if (!reduceMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      offTheme()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="terrain" aria-hidden="true" />
  )
}
