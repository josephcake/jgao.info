// The hero fly-through. One camera moves over the same ground plane as the contour field: it opens
// over Midtown with the evening traffic running, drops between the towers and flies up the avenues,
// circles a tower as a 9-1-1 call comes in, scans it floor by floor down to the caller and looks
// inside, where a radar tracks the people on that floor and a route guides a responder to the caller.
// Then it pulls out over the city as every building is mapped floor by floor, and the city settles
// into the contour field the page runs on.
// Scene positions are local units on Manhattan's grid, rotated 29° onto the screen the way the real
// grid sits. Inside the tower one unit is about half a metre.

const ANG = (29 * Math.PI) / 180
const CA = Math.cos(ANG)
const SA = Math.sin(ANG)
const TAU = Math.PI * 2
const PARK = { u: 115, v: 450 }
const AVENUES = [-475, -385, -295, -205, -115, 0, 115, 205, 295, 385, 475]
const STREET = 36
const ISLAND = [[-330, 1700], [-250, 2100], [60, 2150], [340, 1500], [420, 200], [360, -1100], [220, -2000], [-20, -2300], [-250, -1500], [-380, -200]]
const BROADWAY = [[260, 2150], [40, 1300], [-120, 470], [-200, -400], [-260, -1500]]

const TOWER = { k: 6, m: -2, floors: 40, floor: 23, height: 300, width: 40 }
const T0 = { u: AVENUES[TOWER.k] + 7, v: TOWER.m * STREET + 4 }
const DEPTH = STREET - 8
const ZF = (TOWER.height * (TOWER.floor - 1)) / TOWER.floors
const PER = TOWER.height / TOWER.floors
const WALL = 2.4

// Floor 23 in floor units: x runs along the avenue-to-avenue side, y from the north wall (0) to the
// south wall (28), where the sensor is mounted.
const STAIRS = [[9, 11, 14, 17], [26, 11, 31, 17]]
const stairWalls = ([x0, y0, x1, y1]) => [[x0, y0, x0 + 1, y0], [x0 + 3.5, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]
const WALLS = [
  [0, 0, 40, 0], [40, 0, 40, 28], [40, 28, 0, 28], [0, 28, 0, 0],
  [10, 0, 10, 7], [20, 0, 20, 7], [30, 0, 30, 7],
  [0, 7, 3, 7], [6, 7, 13, 7], [16, 7, 23, 7], [26, 7, 33, 7], [36, 7, 40, 7],
  [0, 20, 10, 20], [13, 20, 13, 28],
  ...STAIRS.flatMap(stairWalls),
]
const DESKS = [[2, 2, 7, 4.5], [12, 2, 18, 4.5], [22, 2, 28, 4.5], [32, 2, 38, 4.5], [3, 23, 10, 26], [27, 21, 31, 23], [34, 21, 38, 23], [27, 25, 31, 27], [34, 25, 38, 27]]
const CORE = [16, 11, 24, 17]
const SENSOR = { x: 20, y: 27.6, z: 4, range: 34, half: (62 * Math.PI) / 180 }
const CALLER = [35, 5.8]
// An infrared camera on the west wall looking east, and ultra-wideband anchors in the caller's office
const THERMAL = { x: 0.4, y: 13.5, z: 3.6, range: 24, half: 0.6 }
const ANCHORS = [[30.6, 0.6], [39.4, 0.6], [39.4, 6.4]]
// Where the caller's phone reports itself, mocked
const FIX = { lat: 40.7794, lng: -73.9592 }

// The lobby, round the same core and stairs: the street door on the south wall and a front desk
const LOBBY = {
  walls: [[0, 0, 40, 0], [40, 0, 40, 28], [40, 28, 24, 28], [16, 28, 0, 28], [0, 28, 0, 0], [16, 28, 16, 25], [24, 28, 24, 25], ...STAIRS.flatMap(stairWalls)],
  desks: [[15, 20, 25, 22], [2, 2, 8, 4], [32, 2, 38, 4]],
}

export const PITCH_MAX = 0.98
// Scene time runs past 1: a unit is the scroll the first acts were paced on. The climb up through
// the tower's floors is spliced in between the scan and the room, so the scene's timings either
// side of it stay as they were.
const SCENE_END = 1.24
const CLIMB = [0.585, 0.785]
const ROOM_AT = 0.7
export const STORY_END = SCENE_END + CLIMB[1] - CLIMB[0] - (ROOM_AT - CLIMB[0])
const beat = (s) => (s <= CLIMB[0] ? s : s < CLIMB[1] ? CLIMB[0] : s - CLIMB[1] + ROOM_AT)

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ease = (x) => x * x * (3 - 2 * x)
const smooth = (a, b, v) => ease(clamp01((v - a) / (b - a)))
const window4 = (p, a, b, c, d) => smooth(a, b, p) * (1 - smooth(c, d, p))
const lerp = (a, b, k) => a + (b - a) * k
const pingpong = (v, len) => len - Math.abs((v % (2 * len)) - len)
const wrap = (a) => a - TAU * Math.round(a / TAU)
const hash = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const climbOf = (s) => clamp01((s - CLIMB[0]) / (CLIMB[1] - CLIMB[0]))

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

// A polyline to travel along, with the direction of travel averaged over a stretch of it so the
// camera swings round corners instead of snapping
const route = (pts) => {
  const spans = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]))
  const length = spans.reduce((a, b) => a + b, 0)
  const along = (s) => {
    let left = clamp(s, 0, length)
    for (let i = 0; i < spans.length; i++) {
      if (left <= spans[i] || i === spans.length - 1) {
        const k = Math.min(1, left / spans[i])
        return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]
      }
      left -= spans[i]
    }
    return pts[pts.length - 1]
  }
  const heading = (s, reach) => {
    const a = along(s - reach)
    const b = along(s + reach)
    return Math.atan2(b[1] - a[1], b[0] - a[0])
  }
  return { length, along, heading }
}

// The flight: straight up the avenue beside the park toward the tower
const FLIGHT = route([[AVENUES[7], 39 * STREET], [AVENUES[7], -3 * STREET]])
const flown = (p) => FLIGHT.length * smooth(0.13, 0.42, p)
// The response units, converging on the street door from three directions
const DOOR = -2 * STREET
const RESPONDERS = [
  { r: route([[AVENUES[6], 14 * STREET], [AVENUES[6], DOOR], [T0.u + 10, DOOR]]), at: [0.41, 0.52] },
  { r: route([[AVENUES[7], -22 * STREET], [AVENUES[7], DOOR], [T0.u + 24, DOOR]]), at: [0.42, 0.53] },
  { r: route([[AVENUES[8], 10 * STREET], [AVENUES[8], DOOR], [T0.u + 38, DOOR]]), at: [0.43, 0.545] },
]
// Indoor navigation on Floor 23, in floor units: out of the west stairs, along the corridor, and
// through the office door to the caller
const GUIDE = route([[11.2, 14], [11.2, 9.4], [34.5, 9.4], [34.5, 7.2]])
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
// The same colour turned round the hue wheel, keeping its lightness and saturation
const hue = (c, deg) => {
  const [r, g, b] = rgb(c).map((v) => v / 255)
  const hi = Math.max(r, g, b)
  const lo = Math.min(r, g, b)
  const l = (hi + lo) / 2
  const d = hi - lo
  if (!d) return c
  const sat = d / (1 - Math.abs(2 * l - 1))
  let h = hi === r ? ((g - b) / d) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (((h * 60 + deg) % 360) + 360) % 360
  const k = (n) => (n + h / 30) % 12
  const a = sat * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return `rgb(${f(0)},${f(8)},${f(4)})`
}
const mix = (a, b, t) => {
  const x = rgb(a)
  const y = rgb(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

const font = (weight, px) => `${weight} ${px}px "Bricolage Grotesque", sans-serif`
const rect = (b) => [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]]
const local = (x, y) => [T0.u + x, T0.v + y]
const wallBox = ([x0, y0, x1, y1]) => {
  const t = 0.3
  return { u0: T0.u + Math.min(x0, x1) - t, u1: T0.u + Math.max(x0, x1) + t, v0: T0.v + Math.min(y0, y1) - t, v1: T0.v + Math.max(y0, y1) + t }
}
// Long walls go in short lengths, so each sorts by its own depth among the desks beside it
const pieces = ([x0, y0, x1, y1]) => {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3))
  return Array.from({ length: n }, (_, i) => [lerp(x0, x1, i / n), lerp(y0, y1, i / n), lerp(x0, x1, (i + 1) / n), lerp(y0, y1, (i + 1) / n)])
}
const floorBox = ([x0, y0, x1, y1]) => ({ u0: T0.u + x0, u1: T0.u + x1, v0: T0.v + y0, v1: T0.v + y1 })

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
  let tower = null
  let returns = []
  let layer = null
  let g = null
  let sheet = null
  let tones = null
  let tonesFrom = null
  const tu = T0.u + TOWER.width / 2
  const tv = T0.v + DEPTH / 2

  const world = (u, v) => [pc[0] + (u * CA - v * SA) * U, pc[1] + (u * SA + v * CA) * U]

  // Low between the towers, looking up the avenue ahead
  let fly = { zoom: 1, pitch: 0.95, lead: 40 }
  const flyView = (p) => {
    const s = flown(p)
    const phi = FLIGHT.heading(s + fly.lead * 0.5, 70)
    return { zoom: Math.log(fly.zoom), pitch: fly.pitch, yaw: -ANG + wrap(-Math.PI / 2 - phi), focus: world(...FLIGHT.along(s + fly.lead)) }
  }
  const flyWeight = (p) => smooth(0.1, 0.16, p) * (1 - smooth(0.38, 0.45, p))

  // Called on resize with the viewport and the caption box (or null on narrow screens), where the
  // box is where the act captions sit, so the scene can frame itself in the space that is left.
  const resize = (width, height, box, dpr = 1) => {
    W = width
    H = height
    const wide = W >= 900 && W / H > 1.1
    const edge = box ? box.bottom : H * 0.2
    U = Math.min(W - 48, (H - edge - 40) * 1.1) / 560
    home = [W / 2, H * 0.62]
    // The tower stands where the page's own view is centred, so the story can end on it
    pc = [home[0] - (tu * CA - tv * SA) * U, home[1] - (tu * SA + tv * CA) * U]
    frame = { ox: 0, oy: (edge + H) / 2 - H * 0.62, axis: 'y', from: edge + 8, to: edge + 8 + H * 0.2, safeX: 0, safeY: edge + 8 }
    const room = [W - 48, H - edge - 110]
    const inside = Math.min(room[0] / (wide ? 46 : 44), room[1] / 30) / U

    const z = (zs) => Math.log(zs / U)
    const E = SCENE_END
    fly = { zoom: (wide ? 1.7 : 1.35) / U, pitch: wide ? 0.88 : 0.84, lead: wide ? 90 : 70 }
    const c0 = flyView(0.16)
    const c1 = flyView(0.38)
    const at = world(tu, tv)
    const floorAt = world(...local(TOWER.width / 2, DEPTH / 2 + 3))
    const look = wide ? [0.8, 0.78] : [0.6, 0.58]
    const island = world(0, 400)
    // The camera circles the tower once while it is scanned, keeps turning as it pulls out over the
    // city, and comes to rest two turns round, which is the page's own view
    keys = {
      zoom: spline([[0, z(0.5)], [0.1, z(0.62)], [0.16, c0.zoom], [0.38, c1.zoom], [0.46, z(1.2)], [0.52, z(1.4)], [0.6, z(1.9)], [0.64, z(2.6)], [0.7, z(inside * U)], [0.78, z(inside * U * 1.05)], [0.89, z(inside * U * 1.1)], [0.95, z(1.5)], [1.0, z(0.85)], [1.06, z(0.7)], [1.13, z(0.8)], [E, 0]]),
      pitch: spline([[0, 0.86], [0.1, 0.9], [0.16, c0.pitch], [0.38, c1.pitch], [0.46, 0.84], [0.52, 0.78], [0.6, 0.7], [0.64, 0.72], [0.7, look[0]], [0.78, look[1]], [0.89, look[1]], [0.95, 0.82], [1.02, 0.86], [1.1, 0.7], [E, 0]]),
      yaw: spline([[0, -ANG + 0.42], [0.1, -ANG + 0.3], [0.16, c0.yaw], [0.38, c1.yaw], [0.46, c1.yaw - 0.6], [0.6, -ANG - 3], [0.7, -ANG + 0.24 - TAU], [0.78, -ANG + 0.15 - TAU], [0.89, -ANG - TAU], [1.0, -ANG - 7.6], [1.1, -10.6], [E, -2 * TAU]]),
      focus: spline([[0, world(150, 900)], [0.1, world(190, 1000)], [0.16, c0.focus], [0.38, c1.focus], [0.46, at], [0.62, at], [0.66, floorAt], [0.89, floorAt], [0.95, at], [1.03, island], [1.12, at], [E, at]]),
      fz: spline([[0, 0], [0.1, 0], [0.16, 45], [0.38, 45], [0.46, 110], [0.52, 200], [0.6, ZF + 1], [0.9, ZF + 1], [0.97, 60], [1.02, 0], [E, 0]]),
      contour: spline([[0, 0.3], [0.12, 0.18], [0.4, 0.18], [0.46, 0.7], [0.5, 0.25], [0.6, 0.25], [0.63, 0.95], [0.68, 0.3], [0.72, 0.12], [0.9, 0.12], [0.96, 0.3], [1.08, 0.35], [1.17, 0.85], [E, 1]]),
      relief: spline([[0, 0.22], [1.1, 0.22], [E, 1]]),
      frame: spline([[0, 0], [0.1, 1], [1.16, 1], [E, 0]]),
    }

    footprints = []
    blocks = []
    for (let k = 0; k < AVENUES.length - 1; k++) {
      for (let m = -66; m <= 62; m++) {
        const b = { u0: AVENUES[k] + 7, u1: AVENUES[k + 1] - 7, v0: m * STREET + 4, v1: (m + 1) * STREET - 4 }
        const cu = (b.u0 + b.u1) / 2
        const cv = (b.v0 + b.v1) / 2
        if (inPark(cu, cv) || !inPoly(cu, cv, ISLAND)) continue
        if (k === TOWER.k && m === TOWER.m) {
          const own = { ...b, u1: b.u0 + TOWER.width }
          const annex = { ...b, u0: b.u0 + TOWER.width + 4 }
          footprints.push(own, annex)
          blocks.push({ ...own, own: true, h: TOWER.height }, { ...annex, h: 46 })
          continue
        }
        footprints.push(b)
        // Midtown and the Financial District stand tallest
        const r = hash(k, m)
        const midtown = 330 * Math.exp(-(((cv - 800) / 260) ** 2)) * (0.3 + 0.7 * hash(m, k))
        const downtown = 260 * Math.exp(-(((cv - 2000) / 200) ** 2)) * (0.3 + 0.7 * hash(k + 3, m))
        blocks.push({ ...b, h: 18 + r * r * 120 + midtown + downtown, blink: hash(m, k + 9) })
      }
    }
    tower = blocks.find((b) => b.own)

    // Radar returns off the walls and desks of floor 23
    returns = []
    const surfaces = [...WALLS, ...DESKS.map(([x0, y0, x1]) => [x0, y0, x1, y0])]
    const lengths = surfaces.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0))
    const total = lengths.reduce((a, b) => a + b, 0)
    for (let i = 0; returns.length < 320 && i < 4000; i++) {
      let pick = hash(i, 5) * total
      let s = 0
      while (pick > lengths[s]) pick -= lengths[s++]
      const [x0, y0, x1, y1] = surfaces[s]
      const k = pick / lengths[s]
      const x = lerp(x0, x1, k)
      const y = lerp(y0, y1, k)
      const a = Math.atan2(x - SENSOR.x, SENSOR.y - y)
      const r = Math.hypot(x - SENSOR.x, y - SENSOR.y)
      if (Math.abs(a) > SENSOR.half || r > SENSOR.range || r < 3) continue
      returns.push({ a, x, y, z: hash(i, 9) * (s < WALLS.length ? WALL : 1.5), hit: -1e9 })
    }

    if (!layer) {
      layer = document.createElement('canvas')
      g = layer.getContext('2d')
      sheet = document.createElement('canvas').getContext('2d')
    }
    layer.width = sheet.canvas.width = Math.round(W * dpr)
    layer.height = sheet.canvas.height = Math.round(H * dpr)
    sheet.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Climbing from the lobby to Floor 23 at a steady rise, so the camera never stalls and lurches
  const climbZ = (c) => PER * (TOWER.floor - 1) * smooth(0.22, 0.95, c)

  const camera = (progress) => {
    const s = progress * STORY_END
    const p = beat(s)
    const k = keys.frame(p)
    let zoom = keys.zoom(p)
    let pitch = keys.pitch(p)
    let yaw = keys.yaw(p)
    let f = keys.focus(p)
    const w = flyWeight(p)
    if (w > 0) {
      const c = flyView(p)
      zoom = lerp(zoom, c.zoom, w)
      pitch = lerp(pitch, c.pitch, w)
      yaw = lerp(yaw, c.yaw, w)
      f = [lerp(f[0], c.focus[0], w), lerp(f[1], c.focus[1], w)]
    }
    let fz = keys.fz(p)
    const c = climbOf(s)
    if (c > 0 && c < 1) {
      const w = smooth(0, 0.18, c)
      const to = keys.focus(ROOM_AT)
      zoom = lerp(zoom, keys.zoom(ROOM_AT) - 0.35 * (1 - smooth(0.85, 1, c)), w)
      pitch = lerp(pitch, keys.pitch(ROOM_AT), w)
      yaw = lerp(yaw, lerp(keys.yaw(CLIMB[0]), keys.yaw(ROOM_AT), ease(c)), w)
      f = [lerp(f[0], to[0], w), lerp(f[1], to[1], w)]
      fz = lerp(fz, climbZ(c) + 1, w)
    }
    return {
      zoom: Math.exp(zoom),
      pitch,
      yaw,
      fx: f[0],
      fy: f[1],
      fz: fz * U,
      ox: frame.ox * k,
      oy: frame.oy * k,
      contour: keys.contour(p),
      relief: keys.relief(p),
    }
  }

  // The contour field rings out from the tower when the call comes in, rushes up to Floor 23 and
  // rings out again when the scan finds the caller, holds under the room, and rides back down.
  const ground = (progress) => {
    const s = progress * STORY_END
    const p = beat(s)
    const [x, y] = world(tu, tv)
    const box = (z, k, step, rings) => ({ z: z * U, box: { k, x, y, cos: CA, sin: SA, hu: (TOWER.width / 2) * U, hv: (DEPTH / 2) * U, step: step * U, rings } })
    const c = climbOf(s)
    if (c > 0 && c < 1) return box(climbZ(c), 0.5 * smooth(0, 0.2, c) * (1 - smooth(0.9, 1, c)), 3, 4)
    const call = window4(p, 0.44, 0.46, 0.5, 0.54)
    if (call > 0) return box(0, call, 2 + 7 * smooth(0.44, 0.53, p), 5)
    const z = p < 0.6 ? 0 : p < 0.91 ? ZF * smooth(0.6, 0.63, p) : Math.max(0, keys.fz(p) - 1)
    if (z <= 0) return null
    const pulse = window4(p, 0.607, 0.62, 0.67, 0.71)
    if (pulse > 0) return box(z, pulse, 2 + 7 * smooth(0.61, 0.7, p), 5)
    return box(z, smooth(0.74, 0.78, p) * (1 - smooth(0.91, 0.97, p)), 3, 4)
  }

  const draw = (ctx, { p: progress, time, pt, cam, colors }) => {
    const s = progress * STORY_END
    const p = beat(s)
    const c = climbOf(s)
    const climbing = c > 0 && c < 1 ? smooth(0, 0.18, c) : 0
    const alpha = 1 - smooth(SCENE_END - 0.05, SCENE_END - 0.01, p)
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
        car: [mix(ink, paper, 0.08), mix(ink, paper, 0.22), mix(ink, paper, 0.34), mix(ink, paper, 0.18)],
        roof: mix(ink, paper, 0.3),
        radar: hue(signal, -32),
        infrared: mix(signal, '#e0503c', 0.6),
        night: document.documentElement.dataset.theme === 'night',
        window: [mix('#ffc964', paper, 0.08), mix('#f4f7ff', paper, 0.1)],
      }
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

    // A shaded box: visible sides, then the top. Returns which sides were visible.
    const prism = (b, z0, z1, opts) => solid(rect(b), z0, z1, opts)
    const solid = (base, z0, z1, { solid = 1, faces = tones.faces, top = tones.land, edge = colors['contour-strong'], line = 0.55 } = {}) => {
      const lo = base.map(([u, v]) => at(u, v, z0))
      const hi = base.map(([u, v]) => at(u, v, z1))
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

    // Labels go on the main canvas after the scene, with a paper halo, clear of the captions.
    const labels = []
    const tag = (q, lines, a, side = 1, lead = 0, alt = q) => {
      if (!q || a <= 0.01) return
      const w = Math.max(...lines.map(([text, weight, size]) => {
        g.font = font(weight, size)
        return g.measureText(text).width
      }))
      const tall = lines.reduce((s, l, i) => s + l[2] * (i ? 1.35 : 1), 0)
      const gap = 12 + lead
      const minX = frame.safeX + 8
      const maxX = W - 16
      const fits = (x) => x >= minX && x + w <= maxX
      let x = side > 0 ? q[0] + gap : side < 0 ? q[0] - gap - w : q[0] - w / 2
      let y = q[1] - tall / 2 - 2
      let dir = side
      let from = q
      if (!side) x = Math.min(maxX - w, Math.max(minX, x))
      else if (!fits(x)) {
        const other = side > 0 ? alt[0] - gap - w : alt[0] + gap
        if (fits(other)) {
          x = other
          dir = -side
          from = alt
          y = alt[1] - tall / 2 - 2
        } else {
          x = Math.min(maxX - w, Math.max(minX, q[0] - w / 2))
          y = q[1] + 16
          dir = 0
        }
      }
      y = Math.max(frame.safeY + 8, y)
      for (const o of labels) {
        if (x < o.x + o.w + 6 && x + w + 6 > o.x && y < o.y + o.h + 4 && y + tall + 4 > o.y) y = o.y + o.h + 6
      }
      labels.push({ x, y, w, h: tall, lines, a, lead: lead && dir ? [from[0] + dir * 7, from[1], from[0] + dir * (gap - 6), from[1]] : null })
    }

    g.clearRect(0, 0, W, H)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.globalAlpha = 1

    // While the camera is inside Floor 23 the city is gone; it comes back as the camera pulls out,
    // and at the end it sinks into the contours. While the tower is scanned the rest steps back.
    const inside = Math.max(climbing, window4(p, 0.65, 0.69, 0.9, 0.94))
    const outside = (1 - inside) * (1 - smooth(1.11, 1.18, p))
    const focusTower = window4(p, 0.47, 0.52, 0.91, 0.97)
    const stand = 1 - smooth(1.07, 1.15, p)
    const city = outside * (1 - 0.65 * focusTower)
    // Every building mapped floor by floor: a wave of floor lines runs out across the city from the tower
    const floors = window4(p, 0.93, 0.96, 1.06, 1.12)
    const reach = 3400 * smooth(0.93, 1.07, p)

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

    // Traffic, drawn on the ground before the blocks so the blocks in front cover it
    const traffic = outside * (1 - 0.5 * focusTower)
    if (traffic > 0) {
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
        g.globalAlpha = traffic * (i ? 0.75 : 0.9)
        g.strokeStyle = i ? colors.ink : colors.signal
        g.beginPath()
        for (let n = 0; n < list.length; n += 2) {
          g.moveTo(list[n][0], list[n][1])
          g.lineTo(list[n + 1][0], list[n + 1][1])
        }
        g.stroke()
      })
    }

    // The front of the mapping wave, running out over the ground
    if (floors > 0 && reach > 0 && reach < 3400) {
      const ring = Array.from({ length: 96 }, (_, i) => [tu + Math.cos((i / 96) * TAU) * reach, tv + Math.sin((i / 96) * TAU) * reach, 0.3])
      g.globalAlpha = floors * outside * (1 - reach / 3400) * 0.8
      g.strokeStyle = colors.signal
      g.lineWidth = 2
      g.beginPath()
      path(ring, true)
      g.stroke()
    }

    // A response unit: its light bar flashing and a glow on the tarmac
    const unitCar = ([u, v, a], alphaCar) => {
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const off = (f, l) => [u + cos * f - sin * l, v + sin * f + cos * l]
      const box = (f0, f1, l0, l1) => [off(f0, l0), off(f1, l0), off(f1, l1), off(f0, l1)]
      const on = Math.floor(time / 240) % 2
      g.globalAlpha = alphaCar * (0.14 + 0.1 * on)
      g.fillStyle = colors.signal
      g.beginPath()
      path(Array.from({ length: 20 }, (_, i) => off(Math.cos((i / 20) * TAU) * 9, Math.sin((i / 20) * TAU) * 6)), true)
      g.fill()
      g.lineWidth = 0.75
      const body = { solid: alphaCar, faces: tones.car, top: tones.roof, edge: colors.ink, line: 0.35 }
      solid(box(-4, 4, -1.9, 1.9), 0.5, 2.4, body)
      solid(box(-2.6, 1.4, -1.6, 1.6), 2.4, 3.5, body)
      const lamp = (lit) => ({ solid: alphaCar, faces: Array(4).fill(lit ? colors.signal : colors.paper), top: lit ? colors.signal : colors.paper, edge: colors.ink, line: 0.3 })
      solid(box(-1.5, -0.5, -1.3, 0), 3.5, 4.1, lamp(on))
      solid(box(-1.5, -0.5, 0, 1.3), 3.5, 4.1, lamp(!on))
    }

    // The call: rings out from the tower's foot, a pin over its roof
    const call = window4(p, 0.42, 0.45, 0.5, 0.54) * outside
    if (call > 0) {
      const rounded = (grow, z) => {
        const pts = []
        const hu = TOWER.width / 2
        const hv = DEPTH / 2
        for (const [cx, cy, a0] of [[1, 1, 0], [-1, 1, 0.5], [-1, -1, 1], [1, -1, 1.5]]) {
          for (let i = 0; i <= 6; i++) {
            const a = (a0 + i / 12) * Math.PI
            pts.push([tu + cx * hu + Math.cos(a) * grow, tv + cy * hv + Math.sin(a) * grow, z])
          }
        }
        return pts
      }
      g.strokeStyle = colors.signal
      for (let i = 0; i < 4; i++) {
        const w = (time / 2200 + i / 4) % 1
        g.globalAlpha = call * (1 - w) ** 1.4
        g.lineWidth = 0.75 + 3 * (1 - w)
        g.beginPath()
        path(rounded(2 + ease(w) * 160, 0.2), true)
        g.stroke()
      }
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

    // The blocks, back to front, with the response units among them. Low over the street, anything
    // between the camera and where it is looking thins out of the way.
    const xray = smooth(0.5, 0.54, p) * (1 - smooth(0.91, 0.97, p))
    const lit = window4(p, 0.44, 0.47, 0.64, 0.68)
    const units = window4(p, 0.41, 0.43, 0.66, 0.7) * outside
    const order = []
    if (outside > 0) {
      for (const b of blocks) {
        const q = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2)
        if (!q || q[0] < -500 || q[0] > W + 500 || q[1] < -300 || q[1] > H + 700) continue
        order.push({ b, d: q[1] })
      }
    }
    if (units > 0) {
      for (const { r, at: [a0, a1] } of RESPONDERS) {
        const s = r.length * smooth(a0, a1, p)
        const [u, v] = r.along(s)
        const q = at(u, v)
        if (q) order.push({ unit: [u, v, r.heading(s, 5)], d: q[1] })
      }
    }
    const thin = flyWeight(p)
    const subject = H * 0.62 + cam.oy
    order.sort((x, y) => x.d - y.d)
    g.lineWidth = 0.75
    for (const { b, d, unit } of order) {
      if (unit) {
        unitCar(unit, units)
        g.lineWidth = 0.75
        continue
      }
      if (!b.own) {
        const a = city * (1 - 0.55 * thin * smooth(subject + 60, subject + 260, d))
        if (a <= 0.01) continue
        const h = Math.max(0.5, b.h * stand)
        const faces = prism(b, 0, h, { solid: a })
        if (tones.night && faces && h > 20) lights(b, h, faces, a)
        if (floors > 0 && faces && h > 30) {
          const dist = Math.hypot((b.u0 + b.u1) / 2 - tu, (b.v0 + b.v1) / 2 - tv)
          const k = smooth(dist, dist + 240, reach)
          if (k > 0) {
            const base = rect(b)
            const front = Math.exp(-(((reach - dist) / 200) ** 2))
            g.globalAlpha = a * floors * k * (0.3 + 0.7 * front)
            g.lineWidth = 0.75 + 1.1 * front
            g.strokeStyle = colors.signal
            g.beginPath()
            for (let z = PER * 2; z < h - 3; z += PER * 2) {
              for (const i of faces) {
                const c0 = at(base[i][0], base[i][1], z)
                const c1 = at(base[(i + 1) % 4][0], base[(i + 1) % 4][1], z)
                if (!c0 || !c1) continue
                g.moveTo(c0[0], c0[1])
                g.lineTo(c1[0], c1[1])
              }
            }
            g.stroke()
            g.lineWidth = 0.75
          }
        }
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
        continue
      }
      const body = (1 - 0.82 * xray) * outside
      const sides = prism(b, 0, Math.max(0.5, b.h * stand), { solid: body, edge: lit > 0 ? colors.signal : colors['contour-strong'], line: lit > 0 ? Math.min(1 / Math.max(body, 0.01), 4) * outside : 0.55 })
      if (!sides) continue
      const base = rect(b)
      g.strokeStyle = colors.signal
      if (lit > 0) {
        for (const i of sides) {
          const [ua, va] = base[i]
          const [ub, vb] = base[(i + 1) % 4]
          const c0 = at(ua, va, ZF - PER)
          const d0 = at(ub, vb, ZF - PER)
          const c1 = at(ua, va, ZF)
          const d1 = at(ub, vb, ZF)
          if (!c0 || !d0 || !c1 || !d1) continue
          g.globalAlpha = lit * 0.9 * outside
          g.fillStyle = colors.signal
          poly([c0, d0, d1, c1])
          g.fill()
        }
      }
    }

    // The scan: the tower goes to glass and a plane of light sweeps down it floor by floor to the
    // street, leaving the floors it has read lit and marking the caller's as it passes
    const scan = window4(p, 0.5, 0.52, 0.572, 0.585) * outside
    const scanZ = lerp(TOWER.height + 8, 0, smooth(0.51, 0.575, p))
    const passed = p >= 0.541
    if (xray > 0 && tower && outside > 0) {
      const outline = rect(tower)
      for (let n = 1; n <= TOWER.floors; n++) {
        const z = n * PER
        const read = z >= scanZ - 0.5
        g.globalAlpha = xray * outside * (read ? 0.6 : 0.18)
        g.strokeStyle = read ? colors.signal : colors['contour-strong']
        g.lineWidth = n === TOWER.floor - 1 ? 2.5 : 1
        g.beginPath()
        path(outline.map(([u, v]) => [u, v, z]), true)
        g.stroke()
      }
      g.globalAlpha = xray * outside * 0.4
      g.strokeStyle = colors['contour-strong']
      g.lineWidth = 1
      g.beginPath()
      for (const [u, v] of outline) {
        const q0 = at(u, v, 0)
        const q1 = at(u, v, TOWER.height)
        if (!q0 || !q1) continue
        g.moveTo(q0[0], q0[1])
        g.lineTo(q1[0], q1[1])
      }
      g.stroke()
    }
    if (scan > 0 && tower) {
      const plane = [[tower.u0 - 6, tower.v0 - 6], [tower.u1 + 6, tower.v0 - 6], [tower.u1 + 6, tower.v1 + 6], [tower.u0 - 6, tower.v1 + 6]]
      g.globalAlpha = scan * 0.22
      g.fillStyle = colors.signal
      g.beginPath()
      path(plane.map(([u, v]) => [u, v, scanZ]), true)
      g.fill()
      g.globalAlpha = scan
      g.strokeStyle = colors.signal
      g.lineWidth = 2
      g.stroke()
      // The plane's edges reach out like a laser line across the city around it
      g.globalAlpha = scan * 0.35
      g.lineWidth = 1
      g.beginPath()
      for (const [u, v] of plane) {
        const q0 = at(u, v, scanZ)
        const q1 = at(u + (u - tu) * 2.5, v + (v - tv) * 2.5, scanZ)
        if (!q0 || !q1) continue
        g.moveTo(q0[0], q0[1])
        g.lineTo(q1[0], q1[1])
      }
      g.stroke()
      const n = clamp(Math.round(scanZ / PER) + 1, 1, TOWER.floors)
      const done = scanZ < PER
      tag(at(tower.u1 + 6, tower.v0 - 6, scanZ), [[`Floor ${n}`, 700, 18, colors.ink], [done ? 'Scan complete' : 'Scanning', 500, 13, colors.signal]], scan, 1, 16)
      if (passed) tag(at(tower.u0 - 6, tower.v1 + 6, ZF), [[`Floor ${TOWER.floor}`, 700, 18, colors.ink], ['Caller found', 500, 13, colors.signal]], scan * smooth(0.547, 0.553, p), -1, 16)
    }
    if (call > 0) {
      const q = at(tu, tv, TOWER.height + 18)
      if (q) {
        const w = (time / 1500) % 1
        g.strokeStyle = colors.signal
        g.lineWidth = 1.5
        g.globalAlpha = call * (1 - w) * 0.8
        g.beginPath()
        g.arc(q[0], q[1], 8 + w * 16, 0, TAU)
        g.stroke()
        g.globalAlpha = call
        g.fillStyle = colors.paper
        g.beginPath()
        g.arc(q[0], q[1], 8, 0, TAU)
        g.fill()
        g.fillStyle = colors.signal
        g.beginPath()
        g.arc(q[0], q[1], 5.5, 0, TAU)
        g.fill()
        tag(q, [['9-1-1 call', 700, 18, colors.ink], ['Responders en route', 500, 13, colors.signal]], call, 1, 16)
      }
    }

    // Found: Floor 23 flashes and rings out across the field
    const flash = window4(p, 0.541, 0.545, 0.556, 0.575)
    if (flash > 0 && tower) {
      g.globalAlpha = flash * 0.75
      g.fillStyle = colors.signal
      g.beginPath()
      path(rect(tower).map(([u, v]) => [u, v, ZF]), true)
      g.fill()
    }
    const ripple = window4(p, 0.541, 0.546, 0.57, 0.585)
    if (ripple > 0) {
      g.strokeStyle = colors.signal
      for (let i = 0; i < 4; i++) {
        const r = clamp01((p - 0.542 - i * 0.008) / 0.035)
        if (r <= 0 || r >= 1) continue
        const grow = 1 + ease(r) * 95
        g.globalAlpha = ripple * (1 - r) ** 1.5
        g.lineWidth = 0.75 + 3 * (1 - r)
        g.beginPath()
        path(rect({ u0: tower.u0 - grow, u1: tower.u1 + grow, v0: tower.v0 - grow, v1: tower.v1 + grow }).map(([u, v]) => [u, v, ZF]), true)
        g.stroke()
      }
    }

    // Inside Floor 23: a cutaway plan, a radar on the south wall, an infrared camera on the west, UWB
    // anchors round the caller, and the people they track
    const floorPath = (b, z = 0) => path(rect(floorBox(b)).map(([u, v]) => [u, v, z]), true)
    const depthOf = (u, v, z = 0) => at(u, v, z)?.[1] ?? 0
    const room = window4(p, 0.66, 0.7, 0.9, 0.94)
    if (room > 0 && tower) {
      const tracked = window4(p, 0.7, 0.73, 0.77, 0.8)
      const fan = room * smooth(0.69, 0.72, p)
      const heat = room * smooth(0.715, 0.735, p)
      const uwb = room * window4(p, 0.725, 0.745, 0.77, 0.8)

      const slab = [0, 0, TOWER.width, DEPTH]
      g.globalAlpha = room
      g.fillStyle = tones.land
      g.beginPath()
      floorPath(slab, ZF)
      g.fill()
      g.save()
      g.clip()

      const sensor = local(SENSOR.x, SENSOR.y)
      const facing = (a, r) => local(SENSOR.x + Math.sin(a) * r, SENSOR.y - Math.cos(a) * r)
      const arc = (r) => Array.from({ length: 33 }, (_, i) => [...facing(-SENSOR.half + (2 * SENSOR.half * i) / 32, r), ZF])
      const beam = Math.sin(time * 0.0011) * SENSOR.half
      g.globalAlpha = fan * 0.12
      g.fillStyle = tones.radar
      g.beginPath()
      path([[...sensor, ZF], ...arc(SENSOR.range)], true)
      g.fill()
      g.globalAlpha = fan * 0.4
      g.strokeStyle = tones.radar
      g.lineWidth = 1
      g.beginPath()
      for (const r of [8, 16, 24]) path(arc(r))
      g.stroke()
      g.globalAlpha = fan * 0.28
      g.beginPath()
      path([[...sensor, ZF], [...facing(beam - 0.05, SENSOR.range), ZF], [...facing(beam + 0.05, SENSOR.range), ZF]], true)
      g.fill()

      const thermal = (a, r) => local(THERMAL.x + Math.cos(a) * r, THERMAL.y + Math.sin(a) * r)
      const cone = Array.from({ length: 17 }, (_, i) => [...thermal(-THERMAL.half + (2 * THERMAL.half * i) / 16, THERMAL.range), ZF])
      g.globalAlpha = heat * 0.08
      g.fillStyle = tones.infrared
      g.strokeStyle = tones.infrared
      g.beginPath()
      path([[...local(THERMAL.x, THERMAL.y), ZF], ...cone], true)
      g.fill()
      g.globalAlpha = heat * 0.45
      g.setLineDash([2, 4])
      g.beginPath()
      path([[...thermal(-THERMAL.half, THERMAL.range), ZF], [...local(THERMAL.x, THERMAL.y), ZF], [...thermal(THERMAL.half, THERMAL.range), ZF]])
      g.stroke()
      g.setLineDash([])

      g.restore()

      g.globalAlpha = room
      g.strokeStyle = colors.signal
      g.lineWidth = 1.5
      g.beginPath()
      floorPath(slab, ZF)
      g.stroke()

      const walker = (t) => [2 + pingpong(t * 0.0026, 36), 9.2]
      const pacer = (t) => [27 + pingpong(t * 0.0016, 11), 19.4]
      const people = [
        { at: walker, speed: 1.3 },
        { at: pacer, speed: 0.8 },
        { at: () => CALLER, speed: 0, caller: true },
      ].map((who) => ({ ...who, x: who.at(time)[0], y: who.at(time)[1], tall: 3.1 }))
      for (const who of people) {
        const dx = who.x - THERMAL.x
        const dy = who.y - THERMAL.y
        who.warm = Math.abs(Math.atan2(dy, dx)) < THERMAL.half && Math.hypot(dx, dy) < THERMAL.range
      }

      // Where the two walkers have just been
      if (tracked > 0) {
        g.fillStyle = colors.signal
        for (const who of people) {
          if (!who.speed) continue
          for (let k = 1; k <= 14; k++) {
            const q = at(...local(...who.at(time - k * 130)), ZF + 0.05)
            if (!q) continue
            g.globalAlpha = tracked * (1 - k / 15) * 0.55
            g.beginPath()
            g.arc(q[0], q[1], 1.8, 0, TAU)
            g.fill()
          }
        }
      }

      const boxes = [
        ...WALLS.flatMap(pieces).map((w) => ({ b: wallBox(w), z: WALL, cut: true })),
        ...DESKS.map((d) => ({ b: floorBox(d), z: 1.5 })),
        { b: floorBox(CORE), z: 3, core: true },
      ]
      const items = [
        ...boxes.map((box) => ({ ...box, d: depthOf((box.b.u0 + box.b.u1) / 2, (box.b.v0 + box.b.v1) / 2, ZF) })),
        ...people.map((who) => ({ who, d: depthOf(...local(who.x, who.y), ZF) + 0.5 })),
      ].sort((x, y) => x.d - y.d)

      g.lineWidth = 0.75
      for (const item of items) {
        if (item.b) {
          prism(item.b, ZF, ZF + item.z, {
            solid: room,
            faces: item.core ? tones.core : tones.faces,
            top: item.cut || item.core ? tones.cut : tones.land,
            line: item.cut ? 0 : 0.6,
          })
          continue
        }
        const { who } = item
        const [u, v] = local(who.x, who.y)
        const foot = at(u, v, ZF)
        const head = at(u, v, ZF + who.tall)
        if (!foot || !head) continue
        g.globalAlpha = room * 0.25
        g.fillStyle = colors.ink
        g.beginPath()
        g.ellipse(foot[0], foot[1], 0.7 * zs, 0.35 * zs, 0, 0, TAU)
        g.fill()
        g.globalAlpha = room
        g.strokeStyle = who.caller ? colors.signal : colors.ink
        g.fillStyle = g.strokeStyle
        g.lineWidth = Math.max(3, 0.8 * zs)
        g.beginPath()
        g.moveTo(foot[0], foot[1])
        g.lineTo(head[0], head[1])
        g.stroke()
        g.beginPath()
        g.arc(head[0], head[1], Math.max(2.5, 0.42 * zs), 0, TAU)
        g.fill()
        g.lineWidth = 0.75
      }

      // Radar returns: the walls light as the beam passes, people return a fresh cluster every frame
      g.fillStyle = tones.radar
      for (const r of returns) {
        if (Math.abs(r.a - beam) < 0.05) r.hit = time
        const glow = Math.exp(-(time - r.hit) / 1000)
        if (glow < 0.04) continue
        const q = at(...local(r.x, r.y), ZF + r.z)
        if (!q) continue
        g.globalAlpha = fan * glow
        g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3)
      }
      const frameNo = Math.floor(time / 90)
      people.forEach((who, n) => {
        for (let i = 0; i < (who.speed ? 9 : 4); i++) {
          const q = at(...local(who.x + (hash(frameNo + n * 31, i) - 0.5) * 1.8, who.y + (hash(i + 7, frameNo + n * 17) - 0.5) * 1.8), ZF + 0.3 + hash(frameNo, i + n * 9) * 2.9)
          if (!q) continue
          g.globalAlpha = fan * 0.85
          g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3)
        }
      })

      const ink = [colors.ink, colors.ink, colors.ink, colors.ink]
      const unit = prism(floorBox([SENSOR.x - 1.4, SENSOR.y - 0.6, SENSOR.x + 1.4, SENSOR.y]), ZF + SENSOR.z - 0.8, ZF + SENSOR.z + 0.4, { solid: room, faces: ink, top: colors.ink, edge: colors.ink })
      const mount = at(...sensor, ZF)
      if (unit && mount) tag([mount[0], mount[1] + 30], [['mmWave radar', 650, 15, colors.ink]], room * tracked, 0)

      // Infrared: a heat signature on everyone in the camera's view
      if (heat > 0) {
        for (const who of people) {
          if (!who.warm) continue
          const q = at(...local(who.x, who.y), ZF + 1.7)
          if (!q) continue
          const r = Math.max(10, 1.6 * zs)
          const glow = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r)
          glow.addColorStop(0, tones.infrared)
          glow.addColorStop(1, 'transparent')
          g.globalAlpha = heat * 0.5
          g.fillStyle = glow
          g.beginPath()
          g.arc(q[0], q[1], r, 0, TAU)
          g.fill()
          g.globalAlpha = heat * 0.6
          g.strokeStyle = tones.infrared
          g.lineWidth = 1
          for (const k of [0.45, 0.75]) {
            g.beginPath()
            g.ellipse(q[0], q[1], r * k * 0.7, r * k, 0, 0, TAU)
            g.stroke()
          }
        }
        prism(floorBox([THERMAL.x, THERMAL.y - 0.9, THERMAL.x + 1, THERMAL.y + 0.9]), ZF + THERMAL.z - 0.7, ZF + THERMAL.z + 0.3, { solid: heat, faces: ink, top: colors.ink, edge: colors.ink })
        const cam = at(...local(THERMAL.x, THERMAL.y + 0.9), ZF + THERMAL.z)
        if (cam && W >= 600) tag(cam, [['Infrared camera', 650, 15, colors.ink]], heat * tracked, -1, 6)
      }

      // UWB: each anchor ranges the caller's phone, and three ranges pin them to the decimetre
      if (uwb > 0) {
        const phone = at(...local(...CALLER), ZF + 1.9)
        g.strokeStyle = colors.signal
        g.fillStyle = colors.signal
        ANCHORS.forEach(([x, y], i) => {
          const node = at(...local(x, y), ZF + WALL + 0.2)
          if (!node || !phone) return
          g.globalAlpha = uwb * 0.45
          g.lineWidth = 1
          g.setLineDash([2, 3])
          g.beginPath()
          g.moveTo(node[0], node[1])
          g.lineTo(phone[0], phone[1])
          g.stroke()
          g.setLineDash([])
          const k = (time * 0.0009 + i / ANCHORS.length) % 1
          g.globalAlpha = uwb * (1 - k)
          g.beginPath()
          g.arc(lerp(node[0], phone[0], k), lerp(node[1], phone[1], k), 2.2, 0, TAU)
          g.fill()
          g.globalAlpha = uwb
          g.fillRect(node[0] - 3, node[1] - 3, 6, 6)
        })
        const first = at(...local(...ANCHORS[0]), ZF + WALL + 0.2)
        if (first && W >= 600) tag(first, [['UWB anchors', 650, 15, colors.ink], ['±10 cm', 500, 13, colors.signal]], uwb * tracked, -1, 4)
      }

      // Indoor navigation: the route draws itself from the stairs to the caller and a responder walks it
      const guide = window4(p, 0.8, 0.82, 0.9, 0.93)
      if (guide > 0) {
        const s = GUIDE.length * smooth(0.81, 0.88, p)
        const ahead = []
        for (let d = 0; d <= GUIDE.length; d += 0.5) ahead.push([...local(...GUIDE.along(d)), ZF + 0.08])
        g.strokeStyle = colors.signal
        g.lineWidth = 1
        g.globalAlpha = room * guide * 0.35
        g.setLineDash([3, 5])
        g.beginPath()
        path(ahead)
        g.stroke()
        g.setLineDash([])
        g.globalAlpha = room * guide
        g.lineWidth = clamp(0.12 * zs, 1.5, 2.5)
        g.beginPath()
        path(ahead.slice(0, Math.max(2, Math.round(s / 0.5) + 1)))
        g.stroke()
        const [u, v] = local(...GUIDE.along(s))
        const foot = at(u, v, ZF)
        const head = at(u, v, ZF + 3.1)
        if (foot && head) {
          g.lineWidth = Math.max(3, 0.8 * zs)
          g.beginPath()
          g.moveTo(foot[0], foot[1])
          g.lineTo(head[0], head[1])
          g.stroke()
          g.fillStyle = colors.signal
          g.beginPath()
          g.arc(head[0], head[1], Math.max(2.5, 0.42 * zs), 0, TAU)
          g.fill()
          const left = Math.max(0, Math.round((GUIDE.length - s) * 0.5))
          tag(head, [['Responder', 700, 18, colors.ink], [left > 0 ? `${left} m to caller` : 'With the caller', 500, 13, colors.signal]], room * guide * (1 - smooth(0.865, 0.885, p)), 1, 16)
        }
      }

      // A wireframe box around each person the radar has locked on to
      const lock = (who, a) => {
        const corners = []
        for (const z of [0, who.tall + 0.6]) for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(at(...local(who.x + dx, who.y + dy), ZF + z))
        if (corners.some((q) => !q)) return null
        g.globalAlpha = a * 0.9
        g.strokeStyle = colors.signal
        g.lineWidth = 1.25
        g.beginPath()
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4
          g.moveTo(corners[i][0], corners[i][1])
          g.lineTo(corners[j][0], corners[j][1])
          g.moveTo(corners[i + 4][0], corners[i + 4][1])
          g.lineTo(corners[j + 4][0], corners[j + 4][1])
          g.moveTo(corners[i][0], corners[i][1])
          g.lineTo(corners[i + 4][0], corners[i + 4][1])
        }
        g.stroke()
        const top = corners.slice(4)
        return [top.reduce((a2, c) => (c[0] > a2[0] ? c : a2)), top.reduce((a2, c) => (c[0] < a2[0] ? c : a2))]
      }
      // The caller stays locked with the location their phone reports, through the guide-in
      const fixed = room * smooth(0.71, 0.74, p)
      const fix = [
        ['Caller', 700, 18, colors.ink],
        [`${FIX.lat.toFixed(4)}° N, ${Math.abs(FIX.lng).toFixed(4)}° W`, 500, 13, colors.signal],
        [`Altitude ${(ZF * 0.5).toFixed(1)} m, Floor ${TOWER.floor}`, 500, 13, colors.signal],
      ]
      if (tracked > 0 || fixed > 0) {
        for (const who of people) {
          const a = who.caller ? Math.max(tracked, fixed) : tracked
          if (a <= 0.01) continue
          const side = lock(who, a)
          if (!side) continue
          if (who.caller) {
            tag(side[0], fix, a, 1, 0, side[1])
            continue
          }
          const meters = Math.hypot(who.x - SENSOR.x, who.y - SENSOR.y) * 0.5
          const lines = [[`${meters.toFixed(1)} m`, 650, 15, colors.ink], [who.speed ? `${who.speed.toFixed(1)} m/s` : 'Standing still', 500, 13, colors.signal]]
          if (who.warm && heat > 0.5) lines.push(['36.8 °C', 500, 13, tones.infrared])
          tag(side[0], lines, tracked, 1, 0, side[1])
        }
      }
    }

    // The climb: a line of light runs up the middle of the tower from the lobby to the caller's
    // floor, through the outlines of the floors it passes, and Floor 23 settles in at the top
    if (climbing > 0 && tower) {
      const zc = climbZ(c)
      const level = clamp(Math.round(zc / PER) + 1, 1, TOWER.floor)
      const outline = rect(tower)
      g.globalAlpha = climbing * 0.4
      g.strokeStyle = colors['contour-strong']
      g.lineWidth = 1
      g.beginPath()
      for (const [u, v] of outline) {
        const q0 = at(u, v, 0)
        const q1 = at(u, v, TOWER.height)
        if (!q0 || !q1) continue
        g.moveTo(q0[0], q0[1])
        g.lineTo(q1[0], q1[1])
      }
      g.stroke()
      for (let n = 2; n <= TOWER.floors; n++) {
        const z = (n - 1) * PER
        const near = 1 - clamp01(Math.abs(z - zc) / 80)
        g.globalAlpha = climbing * (0.14 + 0.5 * near)
        g.strokeStyle = n === TOWER.floor ? colors.signal : colors['contour-strong']
        g.lineWidth = n === TOWER.floor ? 2.5 : 1
        g.beginPath()
        path(outline.map(([u, v]) => [u, v, z]), true)
        g.stroke()
      }

      // A floor's plan, drawn on its own sheet so it fades as one piece: the lobby as the line sets
      // off, Floor 23 as it arrives
      const floorPlan = ({ walls, desks }, z, a) => {
        if (a <= 0.01) return
        const main = g
        g = sheet
        g.clearRect(0, 0, W, H)
        g.globalAlpha = 1
        g.fillStyle = tones.land
        g.beginPath()
        floorPath([0, 0, TOWER.width, DEPTH], z)
        g.fill()
        g.strokeStyle = colors.signal
        g.lineWidth = 1.5
        g.stroke()
        const items = [
          ...walls.flatMap(pieces).map((w) => ({ b: wallBox(w), z: WALL, cut: true })),
          ...desks.map((d) => ({ b: floorBox(d), z: 1.5 })),
          { b: floorBox(CORE), z: 3, core: true },
        ].map((box) => ({ ...box, d: depthOf((box.b.u0 + box.b.u1) / 2, (box.b.v0 + box.b.v1) / 2, z) }))
        items.sort((x, y) => x.d - y.d)
        g.lineWidth = 0.75
        for (const item of items) {
          prism(item.b, z, z + item.z, {
            solid: 1,
            faces: item.core ? tones.core : tones.faces,
            top: item.cut || item.core ? tones.cut : tones.land,
            line: item.cut ? 0 : 0.6,
          })
        }
        g = main
        g.globalAlpha = a
        g.drawImage(sheet.canvas, 0, 0, W, H)
      }
      floorPlan(LOBBY, 0, climbing * (1 - smooth(0.3, 0.45, c)))
      floorPlan({ walls: WALLS, desks: DESKS }, ZF, climbing * smooth(0.8, 1, c))

      const line = climbing * (1 - smooth(0.9, 1, c))
      const top = [tu, tv, zc]
      if (line > 0.01) {
        g.globalAlpha = line
        g.strokeStyle = colors.paper
        g.lineWidth = 8
        g.beginPath()
        path([[tu, tv, 0], top])
        g.stroke()
        g.strokeStyle = colors.signal
        g.lineWidth = 3.5
        g.beginPath()
        path([[tu, tv, 0], top])
        g.stroke()
        const head = atP(top)
        if (head) {
          g.fillStyle = colors.paper
          g.lineWidth = 2.5
          g.beginPath()
          g.arc(head[0], head[1], 5, 0, TAU)
          g.fill()
          g.stroke()
          tag(head, [[`Floor ${level}`, 700, 18, colors.ink], [level === 1 ? 'Lobby' : level === TOWER.floor ? 'Caller’s floor' : 'Climbing', 500, 13, colors.signal]], line, 1, 16)
        }
      }
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

    ctx.lineJoin = 'round'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    for (const l of labels) {
      ctx.globalAlpha = l.a * alpha
      if (l.lead) {
        ctx.strokeStyle = colors.signal
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(l.lead[0], l.lead[1])
        ctx.lineTo(l.lead[2], l.lead[3])
        ctx.stroke()
      }
      let y = l.y
      l.lines.forEach(([text, weight, size, color], i) => {
        y += i ? size * 1.35 : size
        ctx.font = font(weight, size)
        ctx.lineWidth = 4
        ctx.strokeStyle = colors.paper
        ctx.strokeText(text, l.x, y)
        ctx.fillStyle = color
        ctx.fillText(text, l.x, y)
      })
    }
    ctx.globalAlpha = 1
  }

  return { resize, camera, ground, draw }
}
