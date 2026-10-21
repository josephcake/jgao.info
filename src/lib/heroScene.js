// The hero's city: one camera over the same ground plane as the contour field. It opens over
// Midtown with the evening traffic running, then pushes north over the blocks into Central Park and
// down onto one court of the tennis center, top-down, where the WebGL journey takes over. At the far
// end of the journey the camera comes back to rest on the page's own contour view.
// Scene positions are local units on Manhattan's grid, rotated 29° onto the screen the way the real
// grid sits; a unit is about 2.2 m.

import { COURT, LINES, NET, PLOT } from './courtLines'

const ANG = (29 * Math.PI) / 180
const CA = Math.cos(ANG)
const SA = Math.sin(ANG)
const TAU = Math.PI * 2
const PARK = { u: 115, v: 450 }
const AVENUES = [-475, -385, -295, -205, -115, 0, 115, 205, 295, 385, 475]
const STREET = 36
const ISLAND = [[-330, 1700], [-250, 2100], [60, 2150], [340, 1500], [420, 200], [360, -1100], [220, -2000], [-20, -2300], [-250, -1500], [-380, -200]]
const BROADWAY = [[260, 2150], [40, 1300], [-120, 470], [-200, -400], [-260, -1500]]

// The tower the page's own view centres on, and the low block south of Bryant Park; both keep the
// heights the city opens with
const TOWER = { k: 6, m: -2, height: 300, width: 40 }
const T0 = { u: AVENUES[TOWER.k] + 7, v: TOWER.m * STREET + 4 }
const DEPTH = STREET - 8
const PER = TOWER.height / 40
const CENTER = { k: 3, m: 19, height: 52 }

// The Central Park Tennis Center, north of the reservoir: two rows of courts running north and
// south. The journey hands over on one of them.
const M = 1 / 2.2
const TENNIS = { u0: -98, v0: -256, cols: 6, rows: 2 }
const plotAt = (c, r) => [TENNIS.u0 + c * PLOT.y * M, TENNIS.v0 + r * PLOT.x * M]
const courtAt = (c, r) => plotAt(c + 0.5, r + 0.5)
const COURT_AT = courtAt(3, 1)
const CLAY = '#4a78ab'
const FENCE = '#263a57'
const PAINT = '#f1f2ea'

const HAZE = 8
// Cloud shadows drifting over the island from the south, in local units and units a second; v is
// where each starts on the page's first frame
const CLOUDS = [
  { u: -140, v: 1300, r: 230, du: 3.2, dv: -5 },
  { u: 210, v: 520, r: 300, du: 2.6, dv: -4.2 },
  { u: -60, v: -260, r: 260, du: 3.6, dv: -5.6 },
  { u: 160, v: 2000, r: 210, du: 3, dv: -4.8 },
]

export const PITCH_MAX = 0.98
// Scene time runs past 1: a unit is the scroll the first acts were paced on
export const STORY_END = 3.8
// The run through the tennis ball's fuzz: a stretch of scroll over which the story's own time all
// but stops while the ball turns under the camera, so the flight through the fibres lasts. Where
// it starts and how much scroll it takes, in scene time, and how much scene time passes in it.
export const RUN = { at: 0.82, span: 0.36, keep: 0.06 }
// The scroll's length in the same units, the run included
export const SCROLL_END = STORY_END + RUN.span - RUN.keep
// Story time and how far along the run is, for a point of the scroll. Inside the run, story time
// leaves and rejoins at the scroll's own rate, so nothing it moves changes speed suddenly.
export const storyAt = (() => {
  const N = 512
  const EDGE = 0.1
  const k = RUN.span / RUN.keep
  const c = (1 - k * EDGE) / (1 - EDGE)
  const edge = (u) => 1 - Math.min(1, u / EDGE) ** 2 * (3 - 2 * Math.min(1, u / EDGE))
  const rate = (u) => {
    const b = edge(u) + edge(1 - u)
    return k * b + c * (1 - b)
  }
  const story = new Float32Array(N + 1)
  const run = new Float32Array(N + 1)
  for (let i = 1; i <= N; i++) {
    const u = (i - 0.5) / N
    story[i] = story[i - 1] + rate(u) / N
    run[i] = run[i - 1] + Math.max(0, 1 - rate(u) / k) / N
  }
  for (let i = 0; i <= N; i++) {
    story[i] /= story[N]
    run[i] /= run[N]
  }
  const look = (t, u) => {
    const x = Math.min(N, Math.max(0, u * N))
    const i = Math.min(N - 1, Math.floor(x))
    return t[i] + (t[i + 1] - t[i]) * (x - i)
  }
  return (s) => {
    if (s <= RUN.at) return { p: s, run: 0 }
    if (s >= RUN.at + RUN.span) return { p: s - RUN.span + RUN.keep, run: 1 }
    const u = (s - RUN.at) / RUN.span
    return { p: RUN.at + RUN.keep * look(story, u), run: look(run, u) }
  }
})()

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ease = (x) => x * x * (3 - 2 * x)
const smooth = (a, b, v) => ease(clamp01((v - a) / (b - a)))
const lerp = (a, b, k) => a + (b - a) * k
const hash = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// Central Park landmarks in local units: v runs north (−) to south (+), 59th Street at v = 450
const street = (n) => 450 - (n - 59) * 17.6
const blob = (cu, cv, ru, rv, wob = 0, n = 28) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const r = 1 + wob * (Math.sin(a * 3 + 1.3) * 0.6 + Math.sin(a * 5 + 0.4) * 0.4)
    return [cu + Math.cos(a) * ru * r, cv + Math.sin(a) * rv * r]
  })
const RESERVOIR = blob(-4, (street(86) + street(96)) / 2 + 6, 86, 76, 0.06)
const GREAT_LAWN = blob(-14, (street(80) + street(85)) / 2, 40, 42, 0, 24)
const MEER = blob(58, street(107), 42, 18, 0.12)
const LAKE = blob(-34, street(75), 46, 26, 0.22, 36)
const POND = blob(52, street(61), 26, 13, 0.15)

const inPoly = (u, v, poly) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i]
    const [uj, vj] = poly[j]
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside
  }
  return inside
}
const inPark = (u, v) => Math.abs(u) < PARK.u && Math.abs(v) < PARK.v

// Evening traffic: cars up and down the avenues and across the streets, each a short streak of light
const CARS = []
for (let i = 0; i < 760; i++) {
  const dir = hash(i, 31) < 0.5 ? 1 : -1
  CARS.push({ avenue: true, at: AVENUES[1 + Math.floor(hash(i, 32) * 9)] + dir * 3.5, dir, speed: 26 + hash(i, 33) * 34, phase: hash(i, 34) })
}
for (let i = 0; i < 300; i++) {
  const dir = hash(i, 41) < 0.5 ? 1 : -1
  CARS.push({ avenue: false, at: Math.round((hash(i, 42) - 0.5) * 120) * STREET + dir * 1.6, dir, speed: 16 + hash(i, 43) * 20, phase: hash(i, 44) })
}

// Monotone cubic through the keys, so the camera never overshoots a key and never stops dead between
// two keys that are heading the same way.
function spline(keys) {
  const xs = keys.map((k) => k[0])
  const n = xs.length
  const multi = Array.isArray(keys[0][1])
  const series = multi ? keys[0][1].map((_, d) => keys.map((k) => k[1][d])) : [keys.map((k) => k[1])]
  const slopes = series.map((y) => {
    const dx = []
    const s = []
    for (let i = 0; i < n - 1; i++) {
      dx.push(xs[i + 1] - xs[i])
      s.push((y[i + 1] - y[i]) / dx[i])
    }
    const m = new Array(n).fill(0)
    for (let i = 1; i < n - 1; i++) {
      if (s[i - 1] * s[i] <= 0) continue
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i])
    }
    return m
  })
  return (p) => {
    let i = 0
    if (p <= xs[0]) i = -1
    else if (p >= xs[n - 1]) i = n
    else while (xs[i + 1] < p) i++
    const value = (y, m) => {
      if (i < 0) return y[0]
      if (i >= n) return y[n - 1]
      const h = xs[i + 1] - xs[i]
      const t = (p - xs[i]) / h
      const t2 = t * t
      const t3 = t2 * t
      return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * y[i + 1] + (t3 - t2) * h * m[i + 1]
    }
    return multi ? series.map((y, d) => value(y, slopes[d])) : value(series[0], slopes[0])
  }
}

const area = (pts) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]
    const r = pts[(i + 1) % pts.length]
    a += q[0] * r[1] - r[0] * q[1]
  }
  return a
}

const rgb = (c) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c)
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

const rect = (b) => [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]]

// The court as this view draws it at the handover, for the WebGL court to start from
export const courtColors = (colors) => ({ clay: CLAY, fence: FENCE, paint: PAINT, net: '#1d2838', park: mix(colors['map-land'], colors['contour-strong'], 0.45) })

export function createScene() {
  let W = 0
  let H = 0
  let U = 1
  let pc = [0, 0]
  let home = [0, 0]
  let keys = null
  let frame = { ox: 0, oy: 0, axis: 'y', from: 0, to: 1, safeX: 0, safeY: 0 }
  let footprints = []
  let blocks = []
  let handoff = null
  let layer = null
  let g = null
  let tones = null
  let tonesFrom = null
  let cloud = null
  const tu = T0.u + TOWER.width / 2
  const tv = T0.v + DEPTH / 2

  const world = (u, v) => [pc[0] + (u * CA - v * SA) * U, pc[1] + (u * SA + v * CA) * U]

  // Called on resize with the viewport and the caption box (or null on narrow screens), where the
  // box is where the act captions sit, so the scene can frame itself in the space that is left.
  const resize = (width, height, box, dpr = 1) => {
    W = width
    H = height
    const edge = box ? box.bottom : H * 0.2
    U = Math.min(W - 48, (H - edge - 40) * 1.1) / 560
    home = [W / 2, H * 0.62]
    // The tower stands where the page's own view is centred, so the story can end on it
    pc = [home[0] - (tu * CA - tv * SA) * U, home[1] - (tu * SA + tv * CA) * U]
    frame = { ox: 0, oy: (edge + H) / 2 - H * 0.62, axis: 'y', from: edge + 8, to: edge + 8 + H * 0.2, safeX: 0, safeY: edge + 8 }
    const z = (zs) => Math.log(zs / U)
    const E = STORY_END
    const at = world(tu, tv)
    // The court the journey hands over on fills the space below the captions, its length across a
    // landscape view and down a portrait one; ppm is screen pixels per metre on the court
    const portrait = H > W
    const room = [W - 48, H - edge - 40]
    const ppm = portrait
      ? Math.min((room[1] * 0.78) / COURT.length, (room[0] * 0.92) / COURT.width)
      : Math.min((room[0] * 0.62) / COURT.length, (room[1] * 0.78) / COURT.width)
    handoff = { cx: W / 2, cy: (edge + H) / 2, ppm, portrait }
    const court = world(...COURT_AT)
    const y0 = -ANG + 0.42
    const y1 = portrait ? -ANG : -ANG + Math.PI / 2
    const turn = (k) => y0 + (y1 - y0) * k
    const zc = z(ppm / M)
    // From the opening view, north over Midtown, across 59th Street and the reservoir, turning and
    // tipping down until the court lies flat under the camera; the far end comes back to the
    // page's own view. The zoom is still going when the WebGL court takes over at 0.36, and that
    // court carries on at the same rate (see journey/court.js).
    keys = {
      zoom: spline([[0, z(0.5)], [0.1, z(0.68)], [0.18, z(1.3)], [0.26, z(3.6)], [0.31, zc - 0.7], [0.36, zc], [0.42, zc + 0.9], [3.5, 0], [E, 0]]),
      pitch: spline([[0, 0.86], [0.1, 0.88], [0.18, 0.8], [0.26, 0.52], [0.31, 0.2], [0.36, 0], [E, 0]]),
      yaw: spline([[0, y0], [0.1, turn(0.04)], [0.18, turn(0.15)], [0.26, turn(0.5)], [0.31, turn(0.93)], [0.36, y1], [0.4, y1], [3.5, 0], [E, 0]]),
      focus: spline([[0, world(150, 900)], [0.1, world(135, 760)], [0.18, world(60, 380)], [0.26, world(-40, -90)], [0.31, court], [0.36, court], [0.4, court], [3.5, at], [E, at]]),
      fz: spline([[0, 0], [E, 0]]),
      contour: spline([[0, 0.3], [0.12, 0.18], [0.3, 0.1], [0.36, 0], [3.6, 0], [3.66, 1], [E, 1]]),
      relief: spline([[0, 0.22], [3.6, 0.22], [E, 1]]),
      frame: spline([[0, 0], [0.1, 1], [3.56, 1], [E, 0]]),
    }

    footprints = []
    blocks = []
    for (let k = 0; k < AVENUES.length - 1; k++) {
      for (let m = -66; m <= 62; m++) {
        const b = { u0: AVENUES[k] + 7, u1: AVENUES[k + 1] - 7, v0: m * STREET + 4, v1: (m + 1) * STREET - 4 }
        const bu = (b.u0 + b.u1) / 2
        const bv = (b.v0 + b.v1) / 2
        if (inPark(bu, bv) || !inPoly(bu, bv, ISLAND)) continue
        if (k === TOWER.k && m === TOWER.m) {
          const own = { ...b, u1: b.u0 + TOWER.width }
          const annex = { ...b, u0: b.u0 + TOWER.width + 4 }
          footprints.push(own, annex)
          blocks.push({ ...own, own: true, h: TOWER.height }, { ...annex, h: 46 })
          continue
        }
        footprints.push(b)
        if (k === CENTER.k && m === CENTER.m) {
          blocks.push({ ...b, center: true, h: CENTER.height, blink: 0 })
          continue
        }
        // Midtown and the Financial District stand tallest
        const r = hash(k, m)
        const midtown = 330 * Math.exp(-(((bv - 800) / 260) ** 2)) * (0.3 + 0.7 * hash(m, k))
        const downtown = 260 * Math.exp(-(((bv - 2000) / 200) ** 2)) * (0.3 + 0.7 * hash(k + 3, m))
        blocks.push({ ...b, h: 18 + r * r * 120 + midtown + downtown, blink: hash(m, k + 9) })
      }
    }

    if (!layer) {
      layer = document.createElement('canvas')
      g = layer.getContext('2d')
    }
    layer.width = Math.round(W * dpr)
    layer.height = Math.round(H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const camera = (progress) => {
    const { p } = storyAt(progress * SCROLL_END)
    const k = keys.frame(p)
    let zoom = keys.zoom(p)
    let pitch = keys.pitch(p)
    let yaw = keys.yaw(p)
    let f = keys.focus(p)
    return {
      zoom: Math.exp(zoom),
      pitch,
      yaw,
      fx: f[0],
      fy: f[1],
      fz: keys.fz(p) * U,
      ox: frame.ox * k,
      oy: frame.oy * k,
      band: k,
      contour: keys.contour(p),
      relief: keys.relief(p),
    }
  }

  // The contour field holds a ring under the apartment while its devices call out, rings out from the
  // 9-1-1 center when the ping lands, and holds under the dispatch floor.
  const ground = () => null

  const draw = (ctx, { p: progress, time, pt, cam, colors }) => {
    const { p } = storyAt(progress * SCROLL_END)
    const alpha = 1 - smooth(0.37, 0.39, p)
    if (alpha <= 0 || !g) return
    if (tonesFrom !== colors) {
      tonesFrom = colors
      const { paper, ink, signal } = colors
      const land = colors['map-land']
      tones = {
        land,
        block: mix(land, ink, 0.1),
        park: mix(land, colors['contour-strong'], 0.45),
        water: mix(land, signal, 0.28),
        faces: [mix(paper, ink, 0.17), mix(paper, ink, 0.1), mix(paper, ink, 0.02), mix(paper, ink, 0.06)],
        cut: mix(paper, ink, 0.72),
        core: [mix(paper, ink, 0.3), mix(paper, ink, 0.24), mix(paper, ink, 0.16), mix(paper, ink, 0.2)],
        dark: [mix(ink, paper, 0.08), mix(ink, paper, 0.22), mix(ink, paper, 0.34), mix(ink, paper, 0.18)],
        roof: mix(ink, paper, 0.3),
        glow: mix(signal, paper, 0.3),
        screen: mix(ink, signal, 0.3),
        night: document.documentElement.dataset.theme === 'night',
        window: [mix('#ffc964', paper, 0.08), mix('#f4f7ff', paper, 0.1)],
      }
      // Aerial perspective: blocks further off sink into the air, a little cool by day and a little
      // warm from the city's own light at night
      const air = tones.night ? mix(paper, '#ffc964', 0.06) : mix(paper, signal, 0.05)
      tones.haze = Array.from({ length: HAZE }, (_, i) => {
        const k = (i / (HAZE - 1)) * 0.62
        return { faces: tones.faces.map((c) => mix(c, air, k)), top: mix(land, air, k), edge: mix(colors['contour-strong'], air, k * 1.1) }
      })
      // A soft round shadow, stretched onto the ground for each passing cloud
      cloud = document.createElement('canvas')
      cloud.width = cloud.height = 128
      const cg = cloud.getContext('2d')
      const grad = cg.createRadialGradient(64, 64, 0, 64, 64, 64)
      const [r, gr, bl] = rgb(ink)
      for (const [at, a] of [[0, 1], [0.45, 0.8], [0.75, 0.3], [1, 0]]) grad.addColorStop(at, `rgba(${r},${gr},${bl},${a})`)
      cg.fillStyle = grad
      cg.fillRect(0, 0, 128, 128)
    }

    const zs = cam.zoom * U
    const at = (u, v, z = 0) => {
      const [x, y] = world(u, v)
      return pt(x, y, z * U)
    }
    const atP = (q) => at(q[0], q[1], q[2] || 0)
    // Where a line from a point the camera can see to one behind it leaves the view
    const edge = (good, bad) => {
      let lo = 0
      let hi = 1
      let q = atP(good)
      for (let i = 0; i < 10; i++) {
        const m = (lo + hi) / 2
        const r = at(lerp(good[0], bad[0], m), lerp(good[1], bad[1], m), lerp(good[2] || 0, bad[2] || 0, m))
        if (r) {
          lo = m
          q = r
        } else hi = m
      }
      return q
    }
    // Low views put parts of the map behind the camera, so lines are cut where they leave it
    const path = (pts, close) => {
      const list = close && pts.length ? [...pts, pts[0]] : pts
      let started = false
      const to = (q) => {
        if (started) g.lineTo(q[0], q[1])
        else {
          g.moveTo(q[0], q[1])
          started = true
        }
      }
      let prev = null
      let prevQ = null
      for (const p3 of list) {
        const q = atP(p3)
        if (prev && !q !== !prevQ) to(q ? edge(p3, prev) : edge(prev, p3))
        if (q) to(q)
        prev = p3
        prevQ = q
      }
      if (close && started) g.closePath()
    }
    const poly = (qs) => {
      g.beginPath()
      qs.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])))
      g.closePath()
    }

    // A shaded box from its projected bottom and top: visible sides, then the top. Returns which
    // sides were visible.
    const shade = (lo, hi, { solid = 1, faces = tones.faces, top = tones.land, edge = colors['contour-strong'], line = 0.55 } = {}) => {
      if (lo.some((q) => !q) || hi.some((q) => !q)) return null
      const winding = area(lo)
      const shown = []
      g.strokeStyle = edge
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        const face = [lo[i], lo[j], hi[j], hi[i]]
        if (area(face) * winding <= 0) continue
        shown.push(i)
        poly(face)
        g.globalAlpha = solid
        g.fillStyle = faces[i]
        g.fill()
        g.globalAlpha = solid * line
        g.stroke()
      }
      poly(hi)
      g.globalAlpha = solid
      g.fillStyle = top
      g.fill()
      g.globalAlpha = solid * line
      g.stroke()
      return shown
    }
    const solid = (base, z0, z1, opts) => shade(base.map(([u, v]) => at(u, v, z0)), base.map(([u, v]) => at(u, v, z1)), opts)
    const prism = (b, z0, z1, opts) => solid(rect(b), z0, z1, opts)

    g.clearRect(0, 0, W, H)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.globalAlpha = 1

    const outside = 1

    // Manhattan on the ground: the island, its blocks, Central Park and its water, Broadway
    if (outside > 0) {
      g.globalAlpha = outside
      g.fillStyle = tones.land
      g.beginPath()
      path(ISLAND, true)
      g.fill()
      g.fillStyle = tones.block
      g.beginPath()
      for (const b of footprints) path(rect(b), true)
      g.fill()
      g.fillStyle = tones.park
      g.beginPath()
      path([[-PARK.u + 7, -PARK.v + 4], [PARK.u - 7, -PARK.v + 4], [PARK.u - 7, PARK.v - 4], [-PARK.u + 7, PARK.v - 4]], true)
      g.fill()
      g.fillStyle = tones.water
      g.beginPath()
      for (const w of [RESERVOIR, MEER, LAKE, POND]) path(w, true)
      g.fill()
      g.globalAlpha = outside * 0.6
      g.fillStyle = tones.land
      g.beginPath()
      path(GREAT_LAWN, true)
      g.fill()
      g.globalAlpha = outside
      g.strokeStyle = tones.land
      g.lineWidth = 9 * zs
      g.beginPath()
      path(BROADWAY)
      g.stroke()
    }

    // The tennis center: clay plots with fences between them, then the painted lines and the nets
    // once the camera is close enough to see them
    const near = smooth(1, 2.6, zs)
    if (near > 0) {
      const [u0, v0] = plotAt(0, 0)
      const [u1, v1] = plotAt(TENNIS.cols, TENNIS.rows)
      g.globalAlpha = near
      g.fillStyle = CLAY
      g.beginPath()
      path([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], true)
      g.fill()
      g.strokeStyle = FENCE
      g.lineWidth = Math.max(0.6, 0.12 * zs)
      g.beginPath()
      for (let c = 0; c <= TENNIS.cols; c++) path([[...plotAt(c, 0)], [...plotAt(c, TENNIS.rows)]])
      for (let r = 0; r <= TENNIS.rows; r++) path([[...plotAt(0, r)], [...plotAt(TENNIS.cols, r)]])
      g.stroke()
      const lines = smooth(6, 16, zs)
      if (lines > 0) {
        for (let c = 0; c < TENNIS.cols; c++) {
          for (let r = 0; r < TENNIS.rows; r++) {
            const [cu, cv] = courtAt(c, r)
            const on = ([x, y]) => [cu + y * M, cv + x * M]
            g.globalAlpha = near * lines
            g.fillStyle = PAINT
            g.beginPath()
            for (const [x0, y0, x1, y1] of LINES) path([on([x0, y0]), on([x1, y0]), on([x1, y1]), on([x0, y1])], true)
            g.fill()
            g.strokeStyle = '#1d2838'
            g.lineWidth = Math.max(0.8, 0.05 * M * zs)
            g.beginPath()
            path([on([0, -NET.y]), on([0, NET.y])])
            g.stroke()
          }
        }
      }
      g.globalAlpha = 1
    }

    // Traffic, drawn on the ground before the blocks so the blocks in front cover it
    if (outside > 0) {
      const t = time / 1000
      const streak = 7
      const lanes = [[], []]
      for (const car of CARS) {
        const span = car.avenue ? 4500 : 960
        const along = (car.avenue ? -2300 : -480) + ((((car.phase * span + car.dir * car.speed * t) % span) + span) % span)
        const u = car.avenue ? car.at : along
        const v = car.avenue ? along : car.at
        if (inPark(u, v) || !inPoly(u, v, ISLAND)) continue
        const q = at(u, v, 0.6)
        if (!q || q[0] < -40 || q[0] > W + 40 || q[1] < -40 || q[1] > H + 40) continue
        const back = car.avenue ? at(u, v - car.dir * streak, 0.6) : at(u - car.dir * streak, v, 0.6)
        if (!back) continue
        lanes[car.dir > 0 ? 0 : 1].push(q, back)
      }
      g.lineWidth = clamp(1.1 * zs, 1.1, 3.2)
      lanes.forEach((list, i) => {
        g.globalAlpha = outside * (i ? 0.75 : 0.9)
        g.strokeStyle = i ? colors.ink : colors.signal
        g.beginPath()
        for (let n = 0; n < list.length; n += 2) {
          g.moveTo(list[n][0], list[n][1])
          g.lineTo(list[n + 1][0], list[n + 1][1])
        }
        g.stroke()
      })
    }

    // Night shift: lit windows on the sides of each block, a few switching on and off at a time
    const lights = (b, h, faces, a) => {
      const base = rect(b)
      const seed = hash(b.u0, b.v0)
      for (const i of faces) {
        const [ua, va] = base[i]
        const [ub, vb] = base[(i + 1) % 4]
        const c0 = at(ua, va, 0)
        const c1 = at(ub, vb, 0)
        const c2 = at(ub, vb, h)
        const c3 = at(ua, va, h)
        if (!c0 || !c1 || !c2 || !c3) continue
        const wide = Math.hypot(c1[0] - c0[0], c1[1] - c0[1])
        if (wide < 8) continue
        const cols = Math.max(1, Math.round(Math.hypot(ub - ua, vb - va) / 7))
        const rows = Math.floor((h - PER) / (PER * 2))
        const pane = clamp(Math.min((wide / cols) * 0.42, Math.hypot(c3[0] - c0[0], c3[1] - c0[1]) * ((PER * 2) / h) * 0.45), 1, 8)
        // Warm lamps and cool office lights, each at one of three brightnesses
        for (let n = 0; n < 6; n++) {
          const k = n % 3
          const white = n >= 3
          g.fillStyle = tones.window[+white]
          g.globalAlpha = a * (0.45 + 0.22 * k)
          g.beginPath()
          for (let r = 0; r < rows; r++) {
            const t = (PER * 1.5 + r * PER * 2 + (hash(seed, r) - 0.5) * PER * 0.6) / h
            // Some floors are busy and some have gone home
            const busy = 0.06 + 0.32 * hash(seed * 31 + i, r) ** 2
            for (let col = 0; col < cols; col++) {
              const id = i * 4099 + r * 61 + col
              const level = hash(seed * 997 + id, 3)
              if (Math.floor(level * 3) !== k || hash(id, seed * 7) < 0.32 !== white) continue
              const period = 5000 + hash(id, seed) * 12000
              if (hash(id + seed, Math.floor(time / period + level * 7)) > busy) continue
              const s = (col + 0.5 + (hash(id, seed * 13) - 0.5) * 0.5) / cols
              const x0 = lerp(c0[0], c1[0], s)
              const y0 = lerp(c0[1], c1[1], s)
              const x = lerp(x0, lerp(c3[0], c2[0], s), t)
              const y = lerp(y0, lerp(c3[1], c2[1], s), t)
              g.rect(x - pane / 2, y - pane / 2, pane, pane)
            }
          }
          g.fill()
        }
      }
    }

    // The blocks, back to front. Low over the street, anything between the camera and where it is
    // looking thins out of the way.
    const order = []
    // How far past the focus each block stands, along the view, in screen pixels
    const ys = Math.sin(cam.yaw)
    const yc = Math.cos(cam.yaw)
    const airy = smooth(0.3, 0.8, cam.pitch)
    if (outside > 0) {
      for (const b of blocks) {
        const bu = (b.u0 + b.u1) / 2
        const bv = (b.v0 + b.v1) / 2
        const q = at(bu, bv)
        if (!q || q[0] < -500 || q[0] > W + 500 || q[1] < -300 || q[1] > H + 700) continue
        const [wx, wy] = world(bu, bv)
        const far = -((wx - cam.fx) * ys + (wy - cam.fy) * yc) * cam.zoom
        order.push({ b, d: q[1], haze: airy * smooth(H * 0.05, H * 1.5, far) })
      }
    }
    order.sort((x, y) => x.d - y.d)
    g.lineWidth = 0.75
    for (const { b, haze } of order) {
      const h = b.h
      const a = outside
      if (a <= 0.01) continue
      if (b.center) {
        prism(b, 0, h, { solid: a, edge: colors['contour-strong'], line: 0.55 })
        // Its mast, blinking
        const foot = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h)
        const top = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h + 24)
        if (foot && top) {
          g.globalAlpha = a
          g.strokeStyle = colors.ink
          g.lineWidth = 1.5
          g.beginPath()
          g.moveTo(foot[0], foot[1])
          g.lineTo(top[0], top[1])
          g.stroke()
          g.fillStyle = colors.signal
          g.globalAlpha = a * (Math.floor(time / 700) % 2 ? 1 : 0.35)
          g.beginPath()
          g.arc(top[0], top[1], 3, 0, TAU)
          g.fill()
          g.lineWidth = 0.75
        }
        continue
      }
      const air = tones.haze[Math.round(haze * (HAZE - 1))]
      const faces = prism(b, 0, h, { solid: a, faces: air.faces, top: air.top, edge: air.edge })
      if (tones.night && faces && h > 20) lights(b, h, faces, a * (1 - 0.65 * haze))
      // Warning lights on the tallest roofs
      if (h > 250 && Math.floor(time / 900 + b.blink * 2) % 2) {
        const q = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h + 1)
        if (q) {
          g.globalAlpha = a
          g.fillStyle = colors.signal
          g.beginPath()
          g.arc(q[0], q[1], clamp(0.9 * zs, 1.5, 3.5), 0, TAU)
          g.fill()
        }
      }
    }

    // Cloud shadows sliding over the city by day, only where the city is drawn; they have passed by
    // the time the court is handed over
    const clouds = 1 - smooth(0.27, 0.34, p)
    if (outside > 0 && !tones.night && cloud && clouds > 0) {
      const t = time / 1000
      const flat = Math.cos(cam.pitch)
      g.globalCompositeOperation = 'source-atop'
      g.globalAlpha = outside * 0.075 * clouds
      for (const c of CLOUDS) {
        // Each crosses from below the island's south tip to past its north end, then starts again
        const cycle = 4800 / -c.dv
        const k = (t / cycle + (2400 - c.v) / 4800) % 1
        const v = 2400 - k * 4800
        const u = c.u + c.du * cycle * (k - 0.5)
        const q = at(u, v, 0)
        if (!q) continue
        const rx = c.r * zs
        const ry = rx * Math.max(0.35, flat)
        if (q[0] + rx < 0 || q[0] - rx > W || q[1] + ry < 0 || q[1] - ry > H) continue
        g.drawImage(cloud, q[0] - rx, q[1] - ry, rx * 2, ry * 2)
      }
      g.globalCompositeOperation = 'source-over'
    }

    // Keep the scene out of the caption band, then lay it over the contours
    const k = keys.frame(p)
    if (k > 0) {
      const fade = frame.axis === 'x' ? g.createLinearGradient(frame.from, 0, frame.to, 0) : g.createLinearGradient(0, frame.from, 0, frame.to)
      fade.addColorStop(0, `rgba(0,0,0,${1 - k})`)
      fade.addColorStop(1, 'rgba(0,0,0,1)')
      g.globalCompositeOperation = 'destination-in'
      g.globalAlpha = 1
      g.fillStyle = fade
      g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = alpha
    ctx.drawImage(layer, 0, 0, W, H)

    ctx.globalAlpha = 1
  }

  return { resize, camera, ground, draw, handoff: () => handoff, band: () => ({ from: frame.from, to: frame.to, cy: H * 0.62 + frame.oy }) }
}
