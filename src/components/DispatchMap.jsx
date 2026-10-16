import { useEffect, useRef, useState } from 'react'
import { onThemeChange, readVars } from '../lib/theme'

// Stylized Manhattan in grid space: a runs across the island (west to east), s runs along it (south to north).
const ISLAND = [
  [0.45, 0], [0.72, 0.04], [0.93, 0.14], [1, 0.3], [0.96, 0.5], [0.9, 0.7], [0.8, 0.85],
  [0.66, 0.96], [0.52, 1], [0.38, 0.93], [0.18, 0.76], [0.06, 0.52], [0, 0.3], [0.08, 0.12], [0.24, 0.03],
]
const SHORES = [
  [[-4, -1], [-0.32, -1], [-0.3, -0.1], [-0.28, 0.3], [-0.22, 0.65], [-0.12, 0.95], [-0.05, 1.3], [-4, 1.3]],
  [[4, -1], [1.32, -1], [1.38, -0.05], [1.25, 0.18], [1.3, 0.36], [1.42, 0.58], [1.3, 0.8], [1.12, 1.0], [4, 1.0]],
  [[0.62, 1.12], [0.9, 1.03], [1.1, 1.06], [4, 1.06], [4, 3], [0.5, 3], [0.3, 1.25]],
]
const RIVERS = [
  { label: 'Hudson River', a: -0.16, s: 0.34 },
  { label: 'East River', a: 1.17, s: 0.16 },
]
const BROADWAY = [[0.46, 0.04], [0.5, 0.2], [0.42, 0.34], [0.34, 0.5], [0.28, 0.72], [0.36, 0.96]]
const PARK = { a0: 0.4, a1: 0.62, s0: 0.47, s1: 0.62 }
const TENNIS = { a: 0.47, s: 0.6 }
const THETA = (-22 * Math.PI) / 180
const DIR_S = [Math.cos(THETA), Math.sin(THETA)]
const DIR_A = [-Math.sin(THETA), Math.cos(THETA)]
const GRID_TILT = (29 * Math.PI) / 180
const LENGTH_M = 21600
const WIDTH_M = 3700
const SOUTH_TIP = [40.7003, -74.0122]
const ALONG = [0.1777, 0.0892]
const ACROSS = [-0.0166, 0.0397]
const TOWER_M = 1200
const DEVICE_M = 4
const LOCATE_MS = 1300
const UNIT_COUNT = 5
const DRONE_PADS = [
  { a: 0.12, s: 0.3, name: 'Hudson River pad' },
  { a: 0.86, s: 0.24, name: 'East River pad' },
]
const ON_SCENE_MS = 4200
const AVE = 0.1
const ST = 0.0125
const FLOOR_PX = 1.1
const FLOOR_M = 3.4
const CAMERA_HOLD_MS = 4400

const COLOR_VARS = ['paper', 'ink', 'muted', 'contour', 'contour-strong', 'signal', 'map-water', 'map-land', 'display']

function inPolygon(poly, a, s) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, si] = poly[i]
    const [aj, sj] = poly[j]
    if (si > s !== sj > s && a < ((aj - ai) * (s - si)) / (sj - si) + ai) inside = !inside
  }
  return inside
}

const inIsland = (a, s) => inPolygon(ISLAND, a, s)
const inPark = (a, s) => a > PARK.a0 && a < PARK.a1 && s > PARK.s0 && s < PARK.s1
const hash = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const clamp01 = (t) => Math.min(1, Math.max(0, t))

function describeOffGrid(a, s) {
  if (SHORES.some((shore) => inPolygon(shore, a, s))) return 'across the river'
  if (s > 0.95) return 'in the Harlem River'
  return a < 0.5 ? 'in the Hudson River' : 'in the East River'
}

function randomLand(snap) {
  for (let n = 0; n < 200; n++) {
    let a = 0.08 + Math.random() * 0.84
    let s = 0.04 + Math.random() * 0.92
    if (snap) {
      a = Math.round(a * 10) / 10
      s = Math.round(s * 40) / 40
    }
    if (inIsland(a, s)) return { a, s }
  }
  return { a: 0.5, s: 0.5 }
}

function toLatLng(a, s) {
  return [
    SOUTH_TIP[0] + s * ALONG[0] + (a - 0.5) * ACROSS[0],
    SOUTH_TIP[1] + s * ALONG[1] + (a - 0.5) * ACROSS[1],
  ]
}

function formatLatLng(a, s) {
  const [lat, lng] = toLatLng(a, s)
  return `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W`
}

const meters = (from, to) => Math.abs(to.a - from.a) * WIDTH_M + Math.abs(to.s - from.s) * LENGTH_M
const flightMeters = (from, to) => Math.hypot((to.a - from.a) * WIDTH_M, (to.s - from.s) * LENGTH_M)

// Grid-locked route: travel along an avenue then a street (or the reverse), whichever corner stays on land.
function routeBetween(from, to) {
  const avenueFirst = { a: from.a, s: to.s }
  const streetFirst = { a: to.a, s: from.s }
  const corner = inIsland(avenueFirst.a, avenueFirst.s) ? avenueFirst : streetFirst
  return [corner, { ...to }]
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
const IDLE_COORDS = TOUCH ? 'Tap the water and a drone goes instead' : 'Hover the island to read coordinates'

export default function DispatchMap() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const cursorRef = useRef(null)
  const sim = useRef(null)
  const [layers, setLayers] = useState({ streets: true, units: true, accuracy: true, depth: true })
  const layersRef = useRef(layers)
  const [status, setStatus] = useState({ phase: 'idle' })

  layersRef.current = layers

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let colors = readVars(COLOR_VARS)
    let geo = null
    let frame = 0
    let running = false
    let last = performance.now()

    const state = {
      units: Array.from({ length: UNIT_COUNT }, (_, i) => {
        const p = randomLand(true)
        return { id: i + 1, ...p, route: [], speed: 0, mode: 'patrol', wait: Math.random() * 1500 }
      }),
      incidents: [],
      calls: [],
      drones: DRONE_PADS.map((pad, i) => ({
        id: i + 1, pad, a: pad.a, s: pad.s, mode: 'docked', target: null, call: null, speed: 0, alt: 0, until: 0,
      })),
      cam: { t: 0, target: 0, fa: 0.5, fs: 0.5, inc: null, until: 0 },
    }

    const focus = (inc, now) => {
      inc.lockAt = now
      if (!layersRef.current.depth || reduceMotion) return
      const cam = state.cam
      if (cam.t < 0.05) {
        cam.fa = inc.a
        cam.fs = inc.s
      }
      cam.inc = inc
      cam.target = 1
      cam.until = now + CAMERA_HOLD_MS
    }

    const flyDrone = (d, mode, target, seconds) => {
      const dist = flightMeters(d, target)
      d.mode = mode
      d.target = { a: target.a, s: target.s }
      d.speed = reduceMotion ? Math.max(dist, 1) * 50 : Math.max(dist, 1) / seconds
      return dist
    }
    const settleIfQuiet = () => {
      if (!state.incidents.length && !state.calls.length) setStatus({ phase: 'idle' })
    }
    sim.current = state

    const layout = () => {
      const width = wrapRef.current.clientWidth
      const height = Math.round(Math.min(440, Math.max(300, width * 0.62)))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const L = Math.min(width * 0.98 / Math.cos(THETA), height * 1.55)
      const Wd = L * 0.2
      const cx = width / 2
      const cy = height / 2
      const toScreen = (a, s) => [
        cx + (s - 0.5) * L * DIR_S[0] + (a - 0.5) * Wd * DIR_A[0],
        cy + (s - 0.5) * L * DIR_S[1] + (a - 0.5) * Wd * DIR_A[1],
      ]
      const toGrid = (x, y) => {
        const dx = x - cx
        const dy = y - cy
        return {
          a: (dx * DIR_A[0] + dy * DIR_A[1]) / Wd + 0.5,
          s: (dx * DIR_S[0] + dy * DIR_S[1]) / L + 0.5,
        }
      }
      // Closed Catmull-Rom curve through the outline points for a hand-drawn coastline.
      const smooth = (points, closed) => {
        const pts = points.map(([a, s]) => toScreen(a, s))
        const path = new Path2D()
        const n = pts.length
        const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
        path.moveTo(pts[0][0], pts[0][1])
        for (let i = 0; i < (closed ? n : n - 1); i++) {
          const p0 = at(i - 1)
          const p1 = at(i)
          const p2 = at(i + 1)
          const p3 = at(i + 2)
          path.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1],
          )
        }
        if (closed) path.closePath()
        return path
      }
      const island = smooth(ISLAND, true)
      const shores = SHORES.map((shape) => smooth(shape, true))
      const broadway = smooth(BROADWAY, false)
      const metersPerPx = LENGTH_M / L
      geo = { width, height, dpr, toScreen, toGrid, island, shores, broadway, metersPerPx, view: null }
    }

    const line = (a0, s0, a1, s1) => {
      const [x0, y0] = geo.toScreen(a0, s0)
      const [x1, y1] = geo.toScreen(a1, s1)
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
    }

    const drawPrism = (b, floorPx, alpha) => {
      const h = b.floors * floorPx
      const top = b.pts.map(([x, y]) => [x, y - h])
      const front = b.pts
        .map((p, i) => ({ i, mid: (p[1] + b.pts[(i + 1) % 4][1]) / 2 }))
        .filter((f) => f.mid >= b.depth)
      const quad = (i, h0, h1) => {
        const p = b.pts[i]
        const q = b.pts[(i + 1) % 4]
        ctx.beginPath()
        ctx.moveTo(p[0], p[1] - h0)
        ctx.lineTo(q[0], q[1] - h0)
        ctx.lineTo(q[0], q[1] - h1)
        ctx.lineTo(p[0], p[1] - h1)
        ctx.closePath()
      }
      const fade = alpha * b.fade
      for (const f of front) {
        quad(f.i, 0, h)
        ctx.globalAlpha = fade
        ctx.fillStyle = b.own ? colors.paper : colors['map-land']
        ctx.fill()
        ctx.globalAlpha = fade * (f.i % 2 ? 0.1 : 0.2)
        ctx.fillStyle = colors.ink
        ctx.fill()
        if (b.own) {
          ctx.globalAlpha = fade * 0.22
          ctx.beginPath()
          const p = b.pts[f.i]
          const q = b.pts[(f.i + 1) % 4]
          for (let n = 1; n < b.floors; n++) {
            ctx.moveTo(p[0], p[1] - n * floorPx)
            ctx.lineTo(q[0], q[1] - n * floorPx)
          }
          ctx.strokeStyle = colors.ink
          ctx.lineWidth = 0.6
          ctx.stroke()
          if (b.reached) {
            quad(f.i, (b.reached - 1) * floorPx, b.reached * floorPx)
            ctx.globalAlpha = fade * 0.75
            ctx.fillStyle = colors.signal
            ctx.fill()
          }
        }
        quad(f.i, 0, h)
        ctx.globalAlpha = fade
        ctx.strokeStyle = b.own ? colors.ink : colors['contour-strong']
        ctx.lineWidth = b.own ? 1.3 : 0.8
        ctx.stroke()
      }
      ctx.beginPath()
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.globalAlpha = fade
      ctx.fillStyle = b.own ? colors.paper : colors['map-land']
      ctx.fill()
      ctx.strokeStyle = b.own ? colors.ink : colors['contour-strong']
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const draw = (now) => {
      const { width, height, dpr, toScreen, island, shores, broadway } = geo
      const show = layersRef.current
      const cam = state.cam
      const z = 1 + 1.8 * cam.t
      const k = 1 - 0.45 * cam.t
      const [fx, fy] = toScreen(cam.fa, cam.fs)
      const view = {
        z,
        k,
        lift: z * Math.sqrt(1 - k * k),
        e: fx + (width / 2 - fx) * cam.t - z * fx,
        f: fy + (height * 0.68 - fy) * cam.t - z * k * fy,
      }
      geo.view = view
      const project = ([x, y]) => [view.e + z * x, view.f + z * k * y]
      const flat = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const ground = () => ctx.setTransform(dpr * z, 0, 0, dpr * z * k, dpr * view.e, dpr * view.f)

      flat()
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = colors['map-water']
      ctx.fillRect(0, 0, width, height)
      ground()

      for (const shore of shores) {
        ctx.globalAlpha = 0.5
        ctx.fillStyle = colors['map-land']
        ctx.fill(shore)
        ctx.globalAlpha = 1
        ctx.strokeStyle = colors.contour
        ctx.lineWidth = 1
        ctx.stroke(shore)
      }

      ctx.font = `italic 500 11px ${colors.display}`
      ctx.fillStyle = colors.muted
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const river of RIVERS) {
        const [rx, ry] = toScreen(river.a, river.s)
        ctx.save()
        ctx.translate(rx, ry)
        ctx.rotate(THETA)
        ctx.fillText(river.label, 0, 0)
        ctx.restore()
      }

      ctx.fillStyle = colors['map-land']
      ctx.fill(island)

      if (show.streets) {
        ctx.save()
        ctx.clip(island)
        ctx.beginPath()
        for (let s = 0; s <= 1; s += 0.0125) line(-0.1, s, 1.1, s)
        ctx.strokeStyle = colors.contour
        ctx.lineWidth = 0.6
        ctx.stroke()
        ctx.beginPath()
        for (let a = 0.1; a < 1; a += 0.1) line(a, -0.1, a, 1.1)
        ctx.strokeStyle = colors['contour-strong']
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.strokeStyle = colors['contour-strong']
        ctx.lineWidth = 2.2
        ctx.stroke(broadway)

        ctx.beginPath()
        const corners = [
          toScreen(PARK.a0, PARK.s0), toScreen(PARK.a1, PARK.s0),
          toScreen(PARK.a1, PARK.s1), toScreen(PARK.a0, PARK.s1),
        ]
        corners.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.closePath()
        ctx.fillStyle = colors['map-water']
        ctx.globalAlpha = 0.55
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.strokeStyle = colors['contour-strong']
        ctx.stroke()
        ctx.restore()

        const [px, py] = toScreen((PARK.a0 + PARK.a1) / 2, (PARK.s0 + PARK.s1) / 2)
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(THETA)
        ctx.fillStyle = colors.muted
        ctx.font = `500 11px ${colors.display}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Central Park', 0, 0)
        ctx.restore()

        const [tx, ty] = toScreen(TENNIS.a, TENNIS.s)
        ctx.beginPath()
        ctx.arc(tx, ty, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = colors.muted
        ctx.fill()
      }

      ctx.strokeStyle = colors['contour-strong']
      ctx.lineWidth = 1.2
      ctx.stroke(island)

      const drawIncident = (inc) => {
        const [ix, iy] = toScreen(inc.a, inc.s)
        const age = now - inc.at

        for (let r = 0; r < 3; r++) {
          const t = ((age - r * 380) % 2200) / 2200
          if (age - r * 380 < 0 || inc.phase === 'onscene') continue
          ctx.beginPath()
          ctx.arc(ix, iy, 6 + easeOut(t) * 46, 0, Math.PI * 2)
          ctx.strokeStyle = colors.signal
          ctx.globalAlpha = (1 - t) * 0.5
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
        ctx.globalAlpha = 1

        if (show.accuracy) {
          const t = reduceMotion ? 1 : Math.min(1, age / LOCATE_MS)
          const radiusM = TOWER_M + (DEVICE_M - TOWER_M) * easeOut(t)
          const radius = Math.max(5, radiusM / geo.metersPerPx)
          ctx.beginPath()
          ctx.arc(ix, iy, radius, 0, Math.PI * 2)
          ctx.fillStyle = colors.signal
          ctx.globalAlpha = 0.1
          ctx.fill()
          ctx.globalAlpha = 0.6
          ctx.setLineDash([4, 4])
          ctx.strokeStyle = colors.signal
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.setLineDash([])
          ctx.globalAlpha = 1
        }

        ctx.beginPath()
        ctx.arc(ix, iy, 6, 0, Math.PI * 2)
        ctx.fillStyle = inc.phase === 'onscene' ? colors.signal : colors.ink
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = colors['map-land']
        ctx.stroke()
        if (inc.phase === 'queued') {
          ctx.fillStyle = colors.ink
          ctx.font = `600 11px ${colors.display}`
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(inc.kind === 'drone' ? 'Waiting for a drone' : 'Waiting for a unit', ix + 11, iy + 12)
        }
      }
      state.incidents.forEach(drawIncident)
      state.calls.forEach(drawIncident)

      let tower = null
      if (cam.inc && cam.t > 0.02) {
        const inc = cam.inc
        flat()
        const floorPx = FLOOR_PX * view.lift * easeOut(clamp01(cam.t / 0.9))
        const toView = (a, s) => project(toScreen(a, s))
        const bi = Math.floor(inc.a / AVE)
        const bj = Math.floor(inc.s / ST)
        const blocks = []
        for (let i = bi - 2; i <= bi + 2; i++) {
          for (let j = bj - 6; j <= bj + 6; j++) {
            const ca = (i + 0.5) * AVE
            const cs = (j + 0.5) * ST
            if (!inIsland(ca, cs) || inPark(ca, cs)) continue
            if (Math.abs(ca - inc.a) < 0.09 && Math.abs(cs - inc.s) < 0.0115) continue
            const near = 1 - Math.hypot(i - bi, (j - bj) / 3) / 3
            if (near <= 0) continue
            const fade = 0.7 + near * 0.3
            blocks.push({
              a: [i * AVE + 0.012, (i + 1) * AVE - 0.012],
              s: [j * ST + 0.0016, (j + 1) * ST - 0.0016],
              floors: Math.round(4 + hash(i, j) ** 2 * 36),
              fade,
            })
          }
        }
        const climb = easeOut(clamp01((now - inc.lockAt - 500) / 1200))
        tower = {
          a: [inc.a - 0.036, inc.a + 0.036],
          s: [inc.s - 0.0046, inc.s + 0.0046],
          floors: inc.floors,
          fade: 1,
          own: true,
          climb: 1 + (inc.floor - 1) * climb,
          reached: climb > 0 ? Math.round(1 + (inc.floor - 1) * climb) : 0,
          floorPx,
        }
        blocks.push(tower)
        for (const b of blocks) {
          b.pts = [[b.a[0], b.s[0]], [b.a[1], b.s[0]], [b.a[1], b.s[1]], [b.a[0], b.s[1]]].map(([a, s]) => toView(a, s))
          b.depth = b.pts.reduce((sum, p) => sum + p[1], 0) / 4
        }
        blocks.sort((x, y) => x.depth - y.depth)
        ctx.lineJoin = 'round'
        for (const b of blocks) drawPrism(b, floorPx, cam.t)
      }

      flat()
      const pos = (a, b) => project(toScreen(a, b))
      if (show.units) {
        for (const u of state.units) {
          const [ux, uy] = pos(u.a, u.s)
          const active = u.mode === 'dispatch' || u.mode === 'scene'
          if (u.mode === 'dispatch' && u.route.length) {
            ctx.beginPath()
            ctx.moveTo(ux, uy)
            for (const p of u.route) {
              const [rx, ry] = pos(p.a, p.s)
              ctx.lineTo(rx, ry)
            }
            ctx.strokeStyle = colors.signal
            ctx.lineWidth = 3
            ctx.lineJoin = 'round'
            ctx.stroke()
          }
          ctx.save()
          ctx.translate(ux, uy)
          ctx.rotate(THETA)
          ctx.fillStyle = active ? colors.signal : colors.ink
          ctx.globalAlpha = active ? 1 : 0.75
          ctx.fillRect(-6, -4, 12, 8)
          ctx.restore()
          ctx.globalAlpha = 1
          if (active) {
            ctx.fillStyle = colors.ink
            ctx.font = `600 11px ${colors.display}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText(`Unit ${u.id}`, ux + 10, uy - 12)
          }
        }

        for (const pad of DRONE_PADS) {
          const [bx, by] = pos(pad.a, pad.s)
          ctx.save()
          ctx.translate(bx, by)
          ctx.rotate(THETA)
          ctx.strokeStyle = colors['contour-strong']
          ctx.lineWidth = 1
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.arc(0, 0, 5, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }

        for (const d of state.drones) {
          const [dx, dy] = pos(d.a, d.s)
          if (d.mode === 'flying' && d.target) {
            const [tx, ty] = pos(d.target.a, d.target.s)
            ctx.beginPath()
            ctx.moveTo(dx, dy)
            ctx.lineTo(tx, ty)
            ctx.setLineDash([2, 5])
            ctx.lineCap = 'round'
            ctx.strokeStyle = colors.signal
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.setLineDash([])
            ctx.lineCap = 'butt'
          }

          const active = d.mode !== 'docked'
          if (d.mode === 'hover') {
            const pulse = reduceMotion ? 0 : Math.sin(now / 260) * 3
            ctx.beginPath()
            ctx.arc(dx, dy, 18 + pulse, 0, Math.PI * 2)
            ctx.fillStyle = colors.signal
            ctx.globalAlpha = 0.16
            ctx.fill()
            ctx.globalAlpha = 1
          }
          if (d.alt > 0.02) {
            ctx.beginPath()
            ctx.ellipse(dx, dy + 2, 8 - d.alt * 2, 3 - d.alt, 0, 0, Math.PI * 2)
            ctx.fillStyle = colors.ink
            ctx.globalAlpha = 0.25 - d.alt * 0.12
            ctx.fill()
            ctx.globalAlpha = 1
          }
          const bob = d.mode === 'hover' && !reduceMotion ? Math.sin(now / 320) * 1.5 : 0
          const lift = d.alt * 12 + bob
          ctx.save()
          ctx.translate(dx, dy - lift)
          ctx.rotate(THETA)
          ctx.strokeStyle = active ? colors.signal : colors.ink
          ctx.fillStyle = active ? colors.signal : colors.ink
          ctx.globalAlpha = active ? 1 : 0.75
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(-6, -6)
          ctx.lineTo(6, 6)
          ctx.moveTo(6, -6)
          ctx.lineTo(-6, 6)
          ctx.stroke()
          ctx.fillRect(-3, -3, 6, 6)
          const spin = active && !reduceMotion ? now / 28 : 0
          ;[[-6, -6], [6, -6], [6, 6], [-6, 6]].forEach(([rx, ry], i) => {
            ctx.beginPath()
            ctx.arc(rx, ry, 4.2, 0, Math.PI * 2)
            ctx.lineWidth = 0.8
            ctx.globalAlpha = active ? 0.45 : 0.3
            ctx.stroke()
            const angle = spin * (i % 2 ? -1 : 1) + i
            ctx.beginPath()
            ctx.moveTo(rx - Math.cos(angle) * 4, ry - Math.sin(angle) * 4)
            ctx.lineTo(rx + Math.cos(angle) * 4, ry + Math.sin(angle) * 4)
            ctx.lineWidth = 1.4
            ctx.globalAlpha = active ? 1 : 0.75
            ctx.stroke()
          })
          ctx.restore()
          ctx.globalAlpha = 1
          if (active) {
            ctx.fillStyle = colors.ink
            ctx.font = `600 11px ${colors.display}`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText(`Drone ${d.id}`, dx + 13, dy - lift - 12)
          }
        }
      }

      if (tower) {
        const inc = cam.inc
        const [gx, gy] = project(toScreen(inc.a, inc.s))
        const y = gy - (tower.climb - 0.5) * tower.floorPx
        ctx.globalAlpha = cam.t
        ctx.beginPath()
        ctx.moveTo(gx, gy)
        ctx.lineTo(gx, y)
        ctx.setLineDash([3, 3])
        ctx.strokeStyle = colors.signal
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.ellipse(gx, gy, 4, 4 * k, 0, 0, Math.PI * 2)
        ctx.fillStyle = colors.ink
        ctx.fill()
        const pulse = ((now - inc.lockAt) % 1600) / 1600
        ctx.beginPath()
        ctx.arc(gx, y, 6 + pulse * 14, 0, Math.PI * 2)
        ctx.strokeStyle = colors.signal
        ctx.globalAlpha = cam.t * (1 - pulse) * 0.7
        ctx.stroke()
        ctx.globalAlpha = cam.t
        ctx.beginPath()
        ctx.arc(gx, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = colors.signal
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = colors.paper
        ctx.stroke()

        const floor = Math.round(tower.climb)
        const right = Math.max(...tower.pts.map(([x]) => x)) + 12
        const title = `Floor ${floor}`
        const sub = `${Math.round(floor * FLOOR_M)} m up`
        ctx.font = `600 12px ${colors.display}`
        const w = Math.max(ctx.measureText(title).width, ctx.measureText(sub).width) + 16
        const lx = right + w > width - 8 ? Math.min(...tower.pts.map(([x]) => x)) - 12 - w : right
        ctx.beginPath()
        ctx.roundRect(lx, y - 20, w, 38, 6)
        ctx.fillStyle = colors.paper
        ctx.fill()
        ctx.strokeStyle = colors['contour-strong']
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = colors.ink
        ctx.fillText(title, lx + 8, y - 8)
        ctx.font = `500 11px ${colors.display}`
        ctx.fillStyle = colors.muted
        ctx.fillText(sub, lx + 8, y + 7)
        ctx.globalAlpha = 1
      }

      // Compass: Manhattan's street grid runs 29° east of true north.
      const north = [
        DIR_S[0] * Math.cos(-GRID_TILT) - DIR_S[1] * Math.sin(-GRID_TILT),
        DIR_S[0] * Math.sin(-GRID_TILT) + DIR_S[1] * Math.cos(-GRID_TILT),
      ]
      const cx = width - 34
      const cy = height - 34
      ctx.beginPath()
      ctx.arc(cx, cy, 16, 0, Math.PI * 2)
      ctx.strokeStyle = colors['contour-strong']
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - north[0] * 10, cy - north[1] * 10)
      ctx.lineTo(cx + north[0] * 12, cy + north[1] * 12)
      ctx.strokeStyle = colors.ink
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = colors.ink
      ctx.font = `600 10px ${colors.display}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', cx + north[0] * 24, cy + north[1] * 24)
    }

    const step = (dt, now) => {
      const cam = state.cam
      if (cam.inc && (now >= cam.until || !layersRef.current.depth)) cam.target = 0
      cam.t += (cam.target - cam.t) * Math.min(1, dt / 380)
      if (cam.target === 0 && cam.t < 0.004) {
        cam.t = 0
        cam.inc = null
      }
      if (cam.inc) {
        const f = Math.min(1, dt / 320)
        cam.fa += (cam.inc.a - cam.fa) * f
        cam.fs += (cam.inc.s - cam.fs) * f
      }

      for (const u of state.units) {
        if (u.mode === 'scene') {
          if (now >= u.until) {
            state.incidents = state.incidents.filter((inc) => inc !== u.incident)
            u.incident = null
            u.mode = 'patrol'
            u.wait = 800
            settleIfQuiet()
          }
          continue
        }
        if (!u.route.length) {
          if (u.mode === 'dispatch') {
            u.mode = 'scene'
            u.until = now + ON_SCENE_MS
            u.incident.phase = 'onscene'
            setStatus({ phase: 'onscene', kind: 'unit', unit: u.id, floor: u.incident.floor, coords: u.incident.coords })
            continue
          }
          u.wait -= dt
          if (u.wait <= 0) {
            u.route = routeBetween(u, randomLand(true))
            u.speed = 260 + Math.random() * 160
          }
          continue
        }
        let travel = u.speed * (dt / 1000)
        while (travel > 0 && u.route.length) {
          const target = u.route[0]
          const remaining = meters(u, target)
          if (remaining <= travel) {
            u.a = target.a
            u.s = target.s
            travel -= remaining
            u.route.shift()
          } else {
            const f = travel / remaining
            u.a += (target.a - u.a) * f
            u.s += (target.s - u.s) * f
            travel = 0
          }
        }
        if (!u.route.length && u.mode === 'patrol') u.wait = 600 + Math.random() * 2400
      }

      for (const d of state.drones) {
        d.alt += ((d.mode === 'docked' ? 0 : 1) - d.alt) * Math.min(1, dt / 220)
        if (d.mode === 'hover') {
          if (now >= d.until) {
            state.calls = state.calls.filter((c) => c !== d.call)
            d.call = null
            flyDrone(d, 'return', d.pad, 2.4)
            settleIfQuiet()
          }
          continue
        }
        if (!d.target || d.alt < 0.6) continue
        const remaining = flightMeters(d, d.target)
        const travel = d.speed * (dt / 1000)
        if (remaining > travel) {
          d.a += ((d.target.a - d.a) * travel) / remaining
          d.s += ((d.target.s - d.s) * travel) / remaining
          continue
        }
        d.a = d.target.a
        d.s = d.target.s
        d.target = null
        if (d.mode === 'return') {
          d.mode = 'docked'
        } else if (d.mode === 'flying' && d.call) {
          d.mode = 'hover'
          d.until = now + ON_SCENE_MS
          d.call.phase = 'onscene'
          setStatus({ phase: 'onscene', kind: 'drone', drone: d.id, where: d.call.where, coords: d.call.coords })
        }
      }

      for (const call of state.calls) {
        if (call.phase === 'locating' && (reduceMotion || now - call.at >= LOCATE_MS)) call.phase = 'queued'
        if (call.phase !== 'queued') continue
        const free = state.drones.filter((d) => d.mode === 'docked' || d.mode === 'return')
        if (!free.length) {
          if (!call.announced) {
            call.announced = true
            setStatus({ phase: 'queued', kind: 'drone', where: call.where, coords: call.coords })
          }
          continue
        }
        const drone = free.reduce((best, d) => (flightMeters(d, call) < flightMeters(best, call) ? d : best))
        const fromPad = drone.mode === 'docked'
        const dist = flyDrone(drone, 'flying', call, Math.min(3.6, Math.max(1.5, 1 + flightMeters(drone, call) / 2600)))
        drone.call = call
        call.phase = 'enroute'
        const seconds = Math.max(20, Math.round(dist / 22 / 10) * 10)
        setStatus({
          phase: 'enroute',
          kind: 'drone',
          drone: drone.id,
          origin: fromPad ? 'launched' : 'rerouted',
          distance: (dist / 1000).toFixed(1),
          eta: seconds < 90 ? `${seconds} seconds` : `${Math.round(seconds / 60)} min`,
          where: call.where,
          coords: call.coords,
        })
      }

      for (const inc of state.incidents) {
        if (inc.phase === 'locating' && (reduceMotion || now - inc.at >= LOCATE_MS)) {
          inc.phase = 'queued'
          focus(inc, now)
        }
        if (inc.phase !== 'queued') continue
        const free = state.units.filter((u) => u.mode === 'patrol')
        if (!free.length) {
          if (!inc.announced) {
            inc.announced = true
            setStatus({ phase: 'queued', kind: 'unit', floor: inc.floor, coords: inc.coords })
          }
          continue
        }
        const best = free.reduce((b, u) => (meters(u, inc) < meters(b, inc) ? u : b))
        const dist = meters(best, inc)
        best.mode = 'dispatch'
        best.incident = inc
        best.route = routeBetween(best, inc)
        const seconds = Math.min(4, Math.max(1.6, 1.2 + dist / 2500))
        best.speed = reduceMotion ? Math.max(dist, 1) * 50 : Math.max(dist, 1) / seconds
        inc.phase = 'enroute'
        window.dispatchEvent(new Event('dispatch:siren'))
        setStatus({
          phase: 'enroute',
          kind: 'unit',
          coords: inc.coords,
          unit: best.id,
          floor: inc.floor,
          distance: (dist / 1000).toFixed(1),
          minutes: Math.max(1, Math.round(dist / (32000 / 60))),
        })
      }
    }

    const loop = (now) => {
      frame = requestAnimationFrame(loop)
      const dt = Math.min(64, now - last)
      last = now
      step(dt, now)
      draw(now)
    }

    const start = () => {
      if (running) return
      running = true
      last = performance.now()
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    const place = (point) => {
      const coords = formatLatLng(point.a, point.s)
      if (inIsland(point.a, point.s)) {
        const floors = 12 + Math.floor(Math.random() * 44)
        const floor = 2 + Math.floor(Math.random() * (floors - 2))
        state.incidents.push({ ...point, kind: 'unit', coords, floors, floor, at: performance.now(), phase: 'locating' })
        setStatus({ phase: 'locating', kind: 'unit', coords })
      } else {
        const where = describeOffGrid(point.a, point.s)
        state.calls.push({ ...point, kind: 'drone', coords, where, at: performance.now(), phase: 'locating' })
        setStatus({ phase: 'locating', kind: 'drone', where, coords })
      }
      if (!running) draw(performance.now())
    }

    const pointFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const v = geo.view
      return v ? geo.toGrid((x - v.e) / v.z, (y - v.f) / (v.z * v.k)) : geo.toGrid(x, y)
    }

    const onClick = (e) => place(pointFromEvent(e))
    const onMove = (e) => {
      const p = pointFromEvent(e)
      cursorRef.current.textContent = inIsland(p.a, p.s)
        ? formatLatLng(p.a, p.s)
        : `Off the street grid, ${describeOffGrid(p.a, p.s)}`
    }
    const onLeave = () => { cursorRef.current.textContent = IDLE_COORDS }
    const onSimulate = () => place(randomLand(false))

    layout()
    draw(performance.now())
    const ro = new ResizeObserver(() => { layout(); draw(performance.now()) })
    ro.observe(wrapRef.current)
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { rootMargin: '100px' })
    io.observe(canvas)
    const offTheme = onThemeChange(() => {
      colors = readVars(COLOR_VARS)
      draw(performance.now())
    })
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    window.addEventListener('dispatch:simulate', onSimulate)
    sim.current.place = onSimulate

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      offTheme()
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('dispatch:simulate', onSimulate)
    }
  }, [])

  const toggle = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }))

  let message
  switch (status.phase) {
    case 'locating':
      message = status.kind === 'drone'
        ? `Call ${status.where === 'across the river' ? 'from across the river' : status.where}. No road there, so a drone goes.`
        : `Call received. Narrowing a ${TOWER_M.toLocaleString()} m tower fix to the phone.`
      break
    case 'enroute':
      message = status.kind === 'drone'
        ? `Locked to ${DEVICE_M} m. Drone ${status.drone} ${status.origin}, ${status.distance} km out, about ${status.eta}.`
        : `Locked to floor ${status.floor}. Unit ${status.unit} is ${status.distance} km out, about ${status.minutes} min.`
      break
    case 'onscene':
      if (status.kind !== 'drone') message = `Unit ${status.unit} is on scene, heading up to floor ${status.floor}.`
      else if (status.where === 'across the river') message = `Drone ${status.drone} is overhead, streaming video to dispatch.`
      else message = `Drone ${status.drone} is overhead, dropping a flotation ring.`
      break
    case 'queued':
      message = status.kind === 'drone'
        ? 'Both drones are busy. Queued for the next one free.'
        : 'Every unit is busy. Queued for the next one to clear.'
      break
    default:
      message = `${TOUCH ? 'Tap' : 'Click'} anywhere on Manhattan to place a 9-1-1 call.`
  }

  return (
    <figure className="dispatch" id="dispatch">
      <div className="dispatch__map" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="dispatch__canvas"
          role="img"
          aria-label="Interactive map of Manhattan. Click to place an emergency call. The map tilts into 3D to show the caller's floor, and the nearest unit responds. Calls off the island get a drone."
        />
        <div className="dispatch__layers" role="group" aria-label="Map layers">
          {[
            ['streets', 'Streets'],
            ['units', 'Units'],
            ['accuracy', 'Accuracy'],
            ['depth', '3D'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="chip"
              aria-pressed={layers[key]}
              onClick={() => toggle(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="dispatch__readout">
        <p className="dispatch__message" aria-live="polite">{message}</p>
        <p className="dispatch__coords">
          <span>{status.coords ? `Caller at ${status.coords}` : 'No active call'}</span>
          <span ref={cursorRef}>{IDLE_COORDS}</span>
        </p>
        <button type="button" className="button" onClick={() => sim.current?.place()}>
          Simulate a call
        </button>
      </div>
      <figcaption className="demo__caption">
        A cell tower places a caller within a few blocks. Their phone narrows it to a doorway, then
        a floor.
      </figcaption>
    </figure>
  )
}
