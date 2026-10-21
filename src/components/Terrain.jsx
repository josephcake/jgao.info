import { useEffect, useRef } from 'react'
import { createNoise3D } from '../lib/noise'
import { createCity } from '../lib/city'
import { onThemeChange, readVars } from '../lib/theme'

const CELL = 8
const LEVELS = 16
const MIN = -0.95
const MAX = 1.35
const STEP = (MAX - MIN) / LEVELS
const ALPHA = 0.5
// How far the city's ground reaches down the page, in hero heights, and the most it is blurred
// there, in cells
const REACH = 1.6
const BLUR = [0, 1, 2, 4, 7, 11]
const VARS = ['contour', 'contour-strong', 'ink', 'paper', 'map-land']

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

// A box blur of radius r, run three times over so it falls off like a gaussian
const blur = (src, w, h, r) => {
  if (r <= 0) return src
  let a = Float32Array.from(src)
  let b = new Float32Array(src.length)
  const n = 2 * r + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < h; j++) {
      let sum = 0
      for (let i = -r; i <= r; i++) sum += a[j * w + Math.min(w - 1, Math.max(0, i))]
      for (let i = 0; i < w; i++) {
        b[j * w + i] = sum / n
        sum += a[j * w + Math.min(w - 1, i + r + 1)] - a[j * w + Math.max(0, i - r)]
      }
    }
    for (let i = 0; i < w; i++) {
      let sum = 0
      for (let j = -r; j <= r; j++) sum += b[Math.min(h - 1, Math.max(0, j)) * w + i]
      for (let j = 0; j < h; j++) {
        a[j * w + i] = sum / n
        sum += b[Math.min(h - 1, j + r + 1) * w + i] - b[Math.max(0, j - r) * w + i]
      }
    }
  }
  return a
}

// The page's ground: a contour map that scrolls with the page, drifting slowly and raised a little
// under the pointer. Manhattan stands on it at the top of the page; down the page its blocks and its
// island become the ground's own heights, softening into hills and then into the terrain.
export default function Terrain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const noise = createNoise3D(11)
    const city = createCity()
    const layer = document.createElement('canvas')
    const lg = layer.getContext('2d')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(VARS)
    let width = 0
    let height = 0
    let heroH = 0
    let cols = 0
    let rows = 0
    let field = new Float32Array(0)
    // The city's ground in page cells: how much of it there is, and its height
    let mrows = 0
    let reach = new Float32Array(0)
    let rise = new Float32Array(0)
    let frame = 0
    let last = 0
    let lastCity = -1
    let lastScroll = -1
    let dirty = true
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, strength: 0, target: 0 }

    const build = () => {
      const m = document.createElement('canvas')
      m.width = cols
      m.height = mrows
      const mg = m.getContext('2d', { willReadFrequently: true })
      const read = (which) => {
        mg.setTransform(1, 0, 0, 1, 0, 0)
        mg.clearRect(0, 0, cols, mrows)
        mg.setTransform(1 / CELL, 0, 0, 1 / CELL, 0.5, 0.5)
        city.shape(mg, which)
        const data = mg.getImageData(0, 0, cols, mrows).data
        const out = new Float32Array(cols * mrows)
        for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] / 255
        return out
      }
      const island = read('island')
      const blocks = read('blocks')
      // Each row takes its blur from how far down the page it is: sharp where the city still stands,
      // softer and wider further down
      const levels = BLUR.map((r) => [blur(island, cols, mrows, r + 2), blur(blocks, cols, mrows, r)])
      const [top] = city.sink()
      reach = new Float32Array(cols * mrows)
      rise = new Float32Array(cols * mrows)
      for (let j = 0; j < mrows; j++) {
        const y = j * CELL
        const k = smooth(top, heroH * REACH, y) ** 0.8 * (BLUR.length - 1)
        const lo = Math.floor(k)
        const hi = Math.min(BLUR.length - 1, lo + 1)
        const t = k - lo
        const hold = 1 - smooth(heroH * 0.9, heroH * REACH, y)
        for (let i = 0; i < cols; i++) {
          const n = j * cols + i
          const isl = levels[lo][0][n] * (1 - t) + levels[hi][0][n] * t
          const blk = levels[lo][1][n] * (1 - t) + levels[hi][1][n] * t
          reach[n] = Math.min(1, isl * 1.25) * hold
          rise[n] = -0.16 + 0.12 * isl + 0.56 * blk
        }
      }
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      heroH = document.querySelector('.hero')?.offsetHeight || height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      layer.width = Math.round(width * dpr)
      layer.height = Math.round(heroH * dpr)
      lg.setTransform(dpr, 0, 0, dpr, 0, 0)
      city.resize(width, heroH)
      cols = Math.ceil(width / CELL) + 2
      rows = Math.ceil(height / CELL) + 2
      mrows = Math.ceil((heroH * REACH) / CELL) + 2
      field = new Float32Array(cols * rows)
      build()
      lastCity = -1
      dirty = true
    }

    const sample = (time, j0) => {
      const z = time * 0.000035
      const bump = pointer.strength > 0.001
      const radius2 = 2 * 150 * 150
      const off = j0 * CELL - window.scrollY
      for (let j = 0; j < rows; j++) {
        const pj = j0 + j
        const y = pj * CELL
        const sy = y * 0.0024
        const inCity = pj >= 0 && pj < mrows
        for (let i = 0; i < cols; i++) {
          const x = i * CELL
          const sx = x * 0.0024
          let val = noise(sx, sy, z) * 0.72 + noise(sx * 2.3, sy * 2.3, z * 1.6) * 0.28
          if (inCity) {
            const n = pj * cols + i
            val += (rise[n] - val) * reach[n]
          }
          if (bump) {
            const dx = x - pointer.x
            const dy = j * CELL + off - pointer.y
            val += 0.6 * pointer.strength * Math.exp(-(dx * dx + dy * dy) / radius2)
          }
          field[j * cols + i] = val
        }
      }
    }

    const contours = (off) => {
      ctx.lineJoin = 'round'
      ctx.globalAlpha = ALPHA
      for (let l = 0; l < LEVELS; l++) {
        const level = MIN + l * STEP
        const isIndex = l % 4 === 0
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
            for (const [ea, eb] of SEGMENTS[code]) {
              for (const e of [ea, eb]) {
                let px
                let py
                if (e === 0) { px = x + CELL * ((level - tl) / (tr - tl)); py = y }
                else if (e === 1) { px = x + CELL; py = y + CELL * ((level - tr) / (br - tr)) }
                else if (e === 2) { px = x + CELL * ((level - bl) / (br - bl)); py = y + CELL }
                else { px = x; py = y + CELL * ((level - tl) / (bl - tl)) }
                if (e === ea) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
              }
            }
          }
        }
        ctx.strokeStyle = isIndex ? colors['contour-strong'] : colors.contour
        ctx.lineWidth = isIndex ? 1.15 : 0.7
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // The ground redraws with every scroll so the lines stay put on the page, and otherwise at 30
    // frames a second; the city, while it is on screen, at 30 too
    const tick = (time) => {
      frame = requestAnimationFrame(tick)
      pointer.x += (pointer.tx - pointer.x) * 0.08
      pointer.y += (pointer.ty - pointer.y) * 0.08
      pointer.strength += (pointer.target - pointer.strength) * 0.05
      const scroll = window.scrollY
      const moved = scroll !== lastScroll
      if (!moved && !dirty && (still || time - last < 32)) return
      lastScroll = scroll
      dirty = false
      const now = still ? 0 : time
      if (!moved) last = time
      const j0 = Math.floor(scroll / CELL)
      sample(now, j0)
      ctx.clearRect(0, 0, width, height)
      contours(j0 * CELL - scroll)
      if (scroll < heroH) {
        if (lastCity < 0 || (!still && time - lastCity >= 32)) {
          lastCity = time
          city.draw(lg, now, colors)
        }
        ctx.drawImage(layer, 0, -scroll, width, heroH)
      }
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
      lastCity = -1
      dirty = true
    })

    resize()
    document.fonts?.ready.then(resize)
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
