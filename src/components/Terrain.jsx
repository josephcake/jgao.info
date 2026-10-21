import { useEffect, useRef } from 'react'
import { createNoise3D } from '../lib/noise'
import { onThemeChange, readVars } from '../lib/theme'

const CELL = 8
// The ground's levels, at the same spacing on up past its own highest, for the pointer's hill
const LEVELS = 24
const MIN = -0.95
const MAX = 2.5
const STEP = (MAX - MIN) / LEVELS
const ALPHA = 0.5
// The hill that rises under the pointer: its height, in the field's units, and its radius in pixels
const HILL = { h: 1.7, r: 120 }
// The rings under the pointer are picked out only while they close on the screen and stay smaller
// than this share of it, so the ground as a whole never lights up
const PICK = 0.2
const VARS = ['contour', 'contour-strong', 'signal']

// Marching-squares segments keyed by corner bits (tl=8, tr=4, br=2, bl=1).
// Edges: 0 top, 1 right, 2 bottom, 3 left.
const SEGMENTS = [
  [], [[3, 2]], [[2, 1]], [[3, 1]],
  [[0, 1]], [[0, 1], [3, 2]], [[0, 2]], [[0, 3]],
  [[0, 3]], [[0, 2]], [[0, 3], [2, 1]], [[0, 1]],
  [[3, 1]], [[2, 1]], [[3, 2]], [],
]

// The page's ground: a contour map that scrolls with the page, drifting slowly and rising into a
// hill under the pointer, the ring the pointer is in and the next one inside it drawn in the
// signal colour
export default function Terrain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const noise = createNoise3D(11)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(VARS)
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let field = new Float32Array(0)
    // Which grid points the picked rings enclose, by a stamp per search, and the two picked
    let inParent = new Int32Array(0)
    let inChild = new Int32Array(0)
    let stamp = 0
    let picked = null
    let frame = 0
    let last = 0
    let lastScroll = -1
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
      inParent = new Int32Array(cols * rows)
      inChild = new Int32Array(cols * rows)
      dirty = true
    }

    // The field on a grid fixed to the page, so the lines scroll with it
    const sample = (time, j0) => {
      const z = time * 0.000035
      const bump = pointer.strength > 0.001
      const radius2 = 2 * HILL.r * HILL.r
      const off = j0 * CELL - window.scrollY
      for (let j = 0; j < rows; j++) {
        const sy = (j0 + j) * CELL * 0.0024
        for (let i = 0; i < cols; i++) {
          const x = i * CELL
          const sx = x * 0.0024
          let val = noise(sx, sy, z) * 0.72 + noise(sx * 2.3, sy * 2.3, z * 1.6) * 0.28
          if (bump) {
            const dx = x - pointer.x
            const dy = j * CELL + off - pointer.y
            val += HILL.h * pointer.strength * Math.exp(-(dx * dx + dy * dy) / radius2)
          }
          field[j * cols + i] = val
        }
      }
    }

    // The grid points above a level that join up with start, or 0 when they reach the screen's edge
    // or grow past their share of it
    const flood = (start, level, marks) => {
      const id = ++stamp
      const limit = cols * rows * PICK
      const stack = [start]
      marks[start] = id
      let size = 0
      while (stack.length) {
        const n = stack.pop()
        const i = n % cols
        const j = (n - i) / cols
        if (i === 0 || j === 0 || i === cols - 1 || j === rows - 1 || ++size > limit) return 0
        for (const m of [n - 1, n + 1, n - cols, n + cols]) {
          if (marks[m] !== id && field[m] > level) {
            marks[m] = id
            stack.push(m)
          }
        }
      }
      return id
    }

    // The ring round the pointer's own ground, never the lowest, and one ring inside it, the one
    // the pointer is in or else the nearest
    const pick = (time, off) => {
      picked = null
      if (pointer.strength < 0.2) return
      const i = Math.round(pointer.x / CELL)
      const j = Math.round((pointer.y - off) / CELL)
      if (i < 1 || j < 1 || i >= cols - 1 || j >= rows - 1) return
      const start = j * cols + i
      const z = time * 0.000035
      const sx = pointer.x * 0.0024
      const sy = (pointer.y + window.scrollY) * 0.0024
      const ground = noise(sx, sy, z) * 0.72 + noise(sx * 2.3, sy * 2.3, z * 1.6) * 0.28
      for (let l = Math.max(1, Math.floor((ground - MIN) / STEP)); l < LEVELS - 1; l++) {
        const level = MIN + l * STEP
        if (field[start] <= level) return
        const parent = flood(start, level, inParent)
        if (!parent) continue
        const inner = level + STEP
        let seed = field[start] > inner ? start : -1
        if (seed < 0) {
          let best = Infinity
          for (let n = 0; n < field.length; n++) {
            if (inParent[n] !== parent || field[n] <= inner) continue
            const d = Math.hypot((n % cols) - i, Math.floor(n / cols) - j)
            if (d < best) {
              best = d
              seed = n
            }
          }
        }
        const child = seed >= 0 ? flood(seed, inner, inChild) : 0
        picked = { l, parent, child }
        return
      }
    }

    const contours = (off) => {
      ctx.lineJoin = 'round'
      ctx.globalAlpha = ALPHA
      for (let l = 0; l < LEVELS; l++) {
        const level = MIN + l * STEP
        const isIndex = l % 4 === 0
        const marks = picked && l === picked.l ? inParent : picked && picked.child && l === picked.l + 1 ? inChild : null
        const id = marks === inParent ? picked.parent : marks ? picked.child : 0
        const lit = new Path2D()
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
            const y = j * CELL + off
            const n = j * cols + i
            const on = marks && (marks[n] === id || marks[n + 1] === id || marks[n + cols] === id || marks[n + cols + 1] === id)
            for (const [ea, eb] of SEGMENTS[code]) {
              for (const e of [ea, eb]) {
                let px
                let py
                if (e === 0) { px = x + CELL * ((level - tl) / (tr - tl)); py = y }
                else if (e === 1) { px = x + CELL; py = y + CELL * ((level - tr) / (br - tr)) }
                else if (e === 2) { px = x + CELL * ((level - bl) / (br - bl)); py = y + CELL }
                else { px = x; py = y + CELL * ((level - tl) / (bl - tl)) }
                if (on) {
                  if (e === ea) lit.moveTo(px, py)
                  else lit.lineTo(px, py)
                } else if (e === ea) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
              }
            }
          }
        }
        ctx.strokeStyle = isIndex ? colors['contour-strong'] : colors.contour
        ctx.lineWidth = isIndex ? 1.15 : 0.7
        ctx.stroke()
        if (marks) {
          ctx.globalAlpha = 0.9 * Math.min(1, pointer.strength * 1.4)
          ctx.strokeStyle = colors.signal
          ctx.lineWidth = 1.4
          ctx.stroke(lit)
          ctx.globalAlpha = ALPHA
        }
      }
      ctx.globalAlpha = 1
    }

    // Redrawn with every scroll so the lines stay put on the page, and otherwise at 30 frames a second
    const tick = (time) => {
      frame = requestAnimationFrame(tick)
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      pointer.strength += (pointer.target - pointer.strength) * 0.08
      const scroll = window.scrollY
      const moved = scroll !== lastScroll
      if (!moved && !dirty && (still || time - last < 32)) return
      lastScroll = scroll
      dirty = false
      if (!moved) last = time
      const j0 = Math.floor(scroll / CELL)
      sample(still ? 0 : time, j0)
      pick(still ? 0 : time, j0 * CELL - scroll)
      ctx.clearRect(0, 0, width, height)
      contours(j0 * CELL - scroll)
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
    const onPointerLeave = () => {
      pointer.target = 0
    }
    const offTheme = onThemeChange(() => {
      colors = readVars(VARS)
      dirty = true
    })

    resize()
    window.addEventListener('resize', resize)
    if (!still) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      offTheme()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="terrain" aria-hidden="true" />
}
