import { useEffect, useRef } from 'react'
import { createNoise3D } from '../lib/noise'
import { onThemeChange, readVars } from '../lib/theme'

const CELL = 14
const LEVELS = 16
const MIN = -0.95
const MAX = 1.35
const STEP = (MAX - MIN) / LEVELS
const PEAK_METERS = 420

// Marching-squares segments keyed by corner bits (tl=8, tr=4, br=2, bl=1).
// Edges: 0 top, 1 right, 2 bottom, 3 left.
const SEGMENTS = [
  [], [[3, 2]], [[2, 1]], [[3, 1]],
  [[0, 1]], [[0, 1], [3, 2]], [[0, 2]], [[0, 3]],
  [[0, 3]], [[0, 2]], [[0, 3], [2, 1]], [[0, 1]],
  [[3, 1]], [[2, 1]], [[3, 2]], [],
]

// Viewport corners mapped onto a patch of Central Park.
const NW = [40.7968, -73.9718]
const SE = [40.7644, -73.9493]

export default function Terrain() {
  const canvasRef = useRef(null)
  const probeRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const probe = probeRef.current
    const ctx = canvas.getContext('2d')
    const noise = createNoise3D(11)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(['contour', 'contour-strong', 'signal'])

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let field = new Float32Array(0)
    let frame = 0
    let lastDraw = 0
    let dirty = true
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, strength: 0, target: 0 }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(width / CELL) + 2
      rows = Math.ceil(height / CELL) + 2
      field = new Float32Array(cols * rows)
      dirty = true
    }

    const sample = (time) => {
      const scroll = window.scrollY
      const z = time * 0.000035 + scroll * 0.00035
      const drift = scroll * 0.25
      const sc = 0.0024
      const radius2 = 2 * 150 * 150
      for (let j = 0; j < rows; j++) {
        const y = j * CELL
        const sy = (y + drift) * sc
        for (let i = 0; i < cols; i++) {
          const x = i * CELL
          const sx = x * sc
          let v = noise(sx, sy, z) * 0.72 + noise(sx * 2.3, sy * 2.3, z * 1.6) * 0.28
          if (pointer.strength > 0.001) {
            const dx = x - pointer.x
            const dy = y - pointer.y
            v += 0.6 * pointer.strength * Math.exp(-(dx * dx + dy * dy) / radius2)
          }
          field[j * cols + i] = v
        }
      }
    }

    const probeValue = () => {
      const i = Math.min(cols - 1, Math.max(0, Math.round(pointer.tx / CELL)))
      const j = Math.min(rows - 1, Math.max(0, Math.round(pointer.ty / CELL)))
      return field[j * cols + i]
    }

    const draw = (probing, highlight) => {
      ctx.clearRect(0, 0, width, height)
      const fade = Math.max(0.45, 1 - window.scrollY / (height * 1.4))
      ctx.lineJoin = 'round'

      for (let l = 0; l < LEVELS; l++) {
        const level = MIN + l * STEP
        const isIndex = l % 4 === 0
        const isProbe = probing && l === highlight
        ctx.beginPath()
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const tl = field[j * cols + i]
            const tr = field[j * cols + i + 1]
            const br = field[(j + 1) * cols + i + 1]
            const bl = field[(j + 1) * cols + i]
            const code = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
            if (code === 0 || code === 15) continue
            const x = i * CELL
            const y = j * CELL
            const edge = (e) => {
              switch (e) {
                case 0: return [x + CELL * ((level - tl) / (tr - tl)), y]
                case 1: return [x + CELL, y + CELL * ((level - tr) / (br - tr))]
                case 2: return [x + CELL * ((level - bl) / (br - bl)), y + CELL]
                default: return [x, y + CELL * ((level - tl) / (bl - tl))]
              }
            }
            for (const [a, b] of SEGMENTS[code]) {
              const p = edge(a)
              const q = edge(b)
              ctx.moveTo(p[0], p[1])
              ctx.lineTo(q[0], q[1])
            }
          }
        }
        if (isProbe) {
          ctx.globalAlpha = 0.85 * pointer.strength
          ctx.strokeStyle = colors.signal
          ctx.lineWidth = 1.6
        } else {
          ctx.globalAlpha = fade
          ctx.strokeStyle = isIndex ? colors['contour-strong'] : colors.contour
          ctx.lineWidth = isIndex ? 1.15 : 0.7
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const updateProbe = (probing, value) => {
      if (!probing) {
        probe.classList.remove('is-visible')
        return
      }
      const meters = Math.round(((value - MIN) / (MAX - MIN)) * PEAK_METERS)
      const lat = NW[0] + (SE[0] - NW[0]) * (pointer.ty / height)
      const lng = NW[1] + (SE[1] - NW[1]) * (pointer.tx / width)
      probe.firstChild.textContent = `${meters} m`
      probe.lastChild.textContent = `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W`
      const flip = pointer.tx > width - 220
      probe.style.transform = `translate(${pointer.x + (flip ? -18 : 18)}px, ${pointer.y + 18}px) translateX(${flip ? '-100%' : '0'})`
      probe.classList.add('is-visible')
    }

    const tick = (time) => {
      frame = requestAnimationFrame(tick)
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      pointer.strength += (pointer.target - pointer.strength) * 0.05
      if (reduceMotion && !dirty) return
      if (time - lastDraw < 32) return
      lastDraw = time
      dirty = false
      sample(reduceMotion ? 0 : time)
      const probing = pointer.target > 0 && window.scrollY < height * 0.7
      const value = probing ? probeValue() : 0
      const highlight = Math.round((value - MIN) / STEP)
      draw(probing, highlight)
      updateProbe(probing, value)
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
      colors = readVars(['contour', 'contour-strong', 'signal'])
      dirty = true
    })

    resize()
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
    <>
      <canvas ref={canvasRef} className="terrain" aria-hidden="true" />
      <div ref={probeRef} className="probe" aria-hidden="true">
        <span className="probe__elev" />
        <span className="probe__coords" />
      </div>
    </>
  )
}
