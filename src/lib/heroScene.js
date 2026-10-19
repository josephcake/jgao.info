// The hero fly-through. One camera moves over the same ground plane as the contour field: a tennis
// court that opens out into Central Park, then a chase camera behind a response unit driving the
// grid to the caller's tower, through its ground floor and up the stairs to the caller's floor,
// where a radar tracks the people on it.
// Scene positions are local units on Manhattan's grid, rotated 29° onto the screen the way the real
// grid sits. Inside the tower one unit is about half a metre.

const ANG = (29 * Math.PI) / 180
const CA = Math.cos(ANG)
const SA = Math.sin(ANG)
const PARK = { u: 115, v: 450 }
const COURT = { v: 300, len: 117, dbl: 54, sgl: 41, svc: 64 }
const AVENUES = [-475, -385, -295, -205, -115, 0, 115, 205, 295, 385, 475]
const STREET = 36
const ISLAND = [[-330, 1700], [-250, 2100], [60, 2150], [340, 1500], [420, 200], [360, -1100], [220, -2000], [-20, -2300], [-250, -1500], [-380, -200]]
const BROADWAY = [[260, 2150], [40, 1300], [-120, 470], [-200, -400], [-260, -1500]]
const RALLY = 1100


const TOWER = { k: 6, m: -2, floors: 40, floor: 23, height: 300, width: 40 }
const T0 = { u: AVENUES[TOWER.k] + 7, v: TOWER.m * STREET + 4 }
const DEPTH = STREET - 8
const ZF = (TOWER.height * (TOWER.floor - 1)) / TOWER.floors
const WALL = 2.4

// Two stairwells either side of the lift core run the full height, each entered from the north
const STAIRS = [[9, 11, 14, 17], [26, 11, 31, 17]]
const stairWalls = ([x0, y0, x1, y1]) => [[x0, y0, x0 + 1, y0], [x0 + 3.5, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]

// Floor 23 in floor units: x runs along the avenue-to-avenue side, y from the north wall (0) to the
// south wall (28), where the sensor is mounted.
const WALLS = [
  [0, 0, 40, 0], [40, 0, 40, 28], [40, 28, 0, 28], [0, 28, 0, 0],
  [10, 0, 10, 7], [20, 0, 20, 7], [30, 0, 30, 7],
  [0, 7, 3, 7], [6, 7, 13, 7], [16, 7, 23, 7], [26, 7, 33, 7], [36, 7, 40, 7],
  [0, 20, 10, 20], [13, 20, 13, 28],
  ...STAIRS.flatMap(stairWalls),
]

// The ground floor, as indoor navigation reads it: the street door and two fire exits, the stairs,
// and the rooms everyone shares
const GROUND_WALLS = [
  [0, 0, 17, 0], [23, 0, 40, 0], [40, 0, 40, 28], [40, 28, 21, 28], [18, 28, 0, 28], [0, 28, 0, 23], [0, 20, 0, 0],
  [10, 0, 10, 8], [0, 8, 6, 8],
  [28, 19, 40, 19], [28, 22, 28, 28],
  ...STAIRS.flatMap(stairWalls),
]
// The street door is only marked, not arrowed or named: the response car parks right in front of it
const EXITS = [
  { at: [20, 0], out: [0, -1], span: 6 },
  { at: [0, 21.5], out: [-1, 0], span: 3, name: 'Exit' },
  { at: [19.5, 28], out: [0, 1], span: 3, name: 'Exit' },
]
const ROOMS = [
  { b: [11, 0, 29, 10], name: 'Lobby' },
  { b: [28, 19, 40, 28], name: 'Lounge' },
  { b: [0, 0, 10, 8], name: 'Mail room' },
]
// From the curb, through the lobby to Stair A, up it, then across Floor 23 to the caller
const UP = [11.25, 14]
const LOBBY_ROUTE = [[20, -4], [20, 7], [UP[0], 7], UP]
const FLOOR_ROUTE = [UP, [UP[0], 9], [34.5, 9], [34.5, 7.4]]
const DESKS = [[2, 2, 7, 4.5], [12, 2, 18, 4.5], [22, 2, 28, 4.5], [32, 2, 38, 4.5], [3, 23, 10, 26], [27, 21, 31, 23], [34, 21, 38, 23], [27, 25, 31, 27], [34, 25, 38, 27]]
const CORE = [16, 11, 24, 17]
const SENSOR = { x: 20, y: 27.6, z: 4, range: 34, half: (62 * Math.PI) / 180 }
const CALLER = [35, 5.8]

const { len: L, dbl: D, sgl: S, svc: V } = COURT
const LINES = [
  [[-D, -L], [D, -L]], [[D, -L], [D, L]], [[D, L], [-D, L]], [[-D, L], [-D, -L]],
  [[-S, -L], [-S, L]], [[S, -L], [S, L]],
  [[-S, -V], [S, -V]], [[-S, V], [S, V]], [[0, -V], [0, V]],
]

export const PITCH_MAX = 0.98
// Story time runs past 1: a unit is the scroll the first acts were paced on, so lengthening the
// sensor act lengthens the hero instead of rushing everything before it.
export const STORY_END = 1.24

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const ease = (x) => x * x * (3 - 2 * x)
const smooth = (a, b, v) => ease(clamp01((v - a) / (b - a)))
const window4 = (p, a, b, c, d) => smooth(a, b, p) * (1 - smooth(c, d, p))
const lerp = (a, b, k) => a + (b - a) * k
const pingpong = (v, len) => len - Math.abs((v % (2 * len)) - len)
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
// 79th sits on a grid street so the dispatch route can cross the park along it
const CROSSING = 3 * STREET
const TRANSVERSE = [street(65), CROSSING, street(86), street(97)]
const inBlob = (u, v, [cu, cv, ru, rv]) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 < 1
const OPEN = [
  [-4, (street(86) + street(96)) / 2 + 6, 96, 86],
  [-14, (street(80) + street(85)) / 2, 46, 48],
  [58, street(107), 50, 26],
  [-34, street(75), 58, 34],
  [52, street(61), 32, 18],
]
const TREES = []
for (let i = 0; i < 2400; i++) {
  const u = (hash(i, 21) - 0.5) * 206
  const v = (hash(i, 22) - 0.5) * 870
  if (OPEN.some((o) => inBlob(u, v, o)) || TRANSVERSE.some((t) => Math.abs(v - t) < 6)) continue
  if (Math.abs(Math.abs(u) - 92) < 5 || Math.abs(Math.abs(v) - 422) < 5) continue
  TREES.push([u, v, 0.9 + hash(i, 23) * 1.4])
}
const DRIVE = [[-92, 422], [-92, -400], [-70, -422], [70, -422], [92, -400], [92, 400], [70, 422], [-70, 422]]

// The response unit's route: up the avenue, across the park on the 79th Street transverse, up Fifth,
// and along the street to the tower's door
const ROUTE = [[AVENUES[2], 12 * STREET], [AVENUES[2], CROSSING], [AVENUES[6], CROSSING], [AVENUES[6], -2 * STREET], [T0.u + 20, -2 * STREET]]
const SPANS = ROUTE.slice(1).map((q, i) => Math.hypot(q[0] - ROUTE[i][0], q[1] - ROUTE[i][1]))
const ROUTE_LENGTH = SPANS.reduce((a, b) => a + b, 0)
const along = (s) => {
  let left = clamp(s, 0, ROUTE_LENGTH)
  for (let i = 0; i < SPANS.length; i++) {
    if (left <= SPANS[i] || i === SPANS.length - 1) {
      const k = Math.min(1, left / SPANS[i])
      return [lerp(ROUTE[i][0], ROUTE[i + 1][0], k), lerp(ROUTE[i][1], ROUTE[i + 1][1], k)]
    }
    left -= SPANS[i]
  }
  return ROUTE[ROUTE.length - 1]
}
// Direction of travel, averaged over a stretch of road so the camera swings round corners
const heading = (s, reach) => {
  const a = along(s - reach)
  const b = along(s + reach)
  return Math.atan2(b[1] - a[1], b[0] - a[0])
}
const driven = (p) => ROUTE_LENGTH * smooth(0.47, 0.63, p)
const distToRoute = (u, v) => {
  let best = Infinity
  for (let i = 0; i < SPANS.length; i++) {
    const [u0, v0] = ROUTE[i]
    const [u1, v1] = ROUTE[i + 1]
    const k = clamp(((u - u0) * (u1 - u0) + (v - v0) * (v1 - v0)) / (SPANS[i] * SPANS[i]), 0, 1)
    best = Math.min(best, Math.hypot(u - lerp(u0, u1, k), v - lerp(v0, v1, k)))
  }
  return best
}
const trim = (pts, k) => {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]))
  let left = k * lens.reduce((a, b) => a + b, 0)
  const out = [pts[0]]
  for (let i = 0; i < lens.length && left > 0; i++) {
    const f = Math.min(1, left / lens[i])
    out.push([lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)])
    left -= lens[i]
  }
  return out
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

const inPoly = (u, v, poly) => {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i]
    const [uj, vj] = poly[j]
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside
  }
  return inside
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

const font = (weight, px) => `${weight} ${px}px "Bricolage Grotesque", sans-serif`
const rect = (b) => [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]]
const local = (x, y) => [T0.u + x, T0.v + y]
const wallBox = ([x0, y0, x1, y1]) => {
  const t = 0.3
  return { u0: T0.u + Math.min(x0, x1) - t, u1: T0.u + Math.max(x0, x1) + t, v0: T0.v + Math.min(y0, y1) - t, v1: T0.v + Math.max(y0, y1) + t }
}
const floorBox = ([x0, y0, x1, y1]) => ({ u0: T0.u + x0, u1: T0.u + x1, v0: T0.v + y0, v1: T0.v + y1 })

export function createScene() {
  let W = 0
  let H = 0
  let U = 1
  let pc = [0, 0]
  let keys = null
  let frame = { ox: 0, oy: 0, axis: 'x', from: 0, to: 1, safeX: 0, safeY: 0 }
  let footprints = []
  let blocks = []
  let tower = null
  let returns = []
  let layer = null
  let g = null
  let tones = null
  let tonesFrom = null
  const tu = T0.u + TOWER.width / 2
  const tv = T0.v + DEPTH / 2
  const caller = local(...CALLER)

  const world = (u, v) => [pc[0] + (u * CA - v * SA) * U, pc[1] + (u * SA + v * CA) * U]

  // Third person behind the unit: low over the street, looking down the road ahead of it
  let chase = { zoom: 1, pitch: 0.9, lead: 26 }
  const chaseView = (p) => {
    const s = driven(p)
    const phi = heading(s + chase.lead * 0.5, 34)
    return { zoom: Math.log(chase.zoom), pitch: chase.pitch, yaw: -Math.PI / 2 - phi - ANG, focus: world(...along(s + chase.lead)) }
  }
  const chaseWeight = (p) => smooth(0.44, 0.5, p) * (1 - smooth(0.61, 0.67, p))

  // box is where the act captions sit, so the scene can frame itself in the space that is left.
  const resize = (width, height, box, dpr = 1) => {
    W = width
    H = height
    const wide = W >= 900 && W / H > 1.1
    const edge = box ? box.bottom : H * 0.2
    U = Math.min(W - 48, (H - edge - 40) * 1.1) / 560
    pc = [W * 0.5 + COURT.v * SA * U, H * 0.55 - COURT.v * CA * U]
    frame = { ox: 0, oy: (edge + H) / 2 - H * 0.62, axis: 'y', from: edge + 8, to: edge + 8 + H * 0.06, safeX: 0, safeY: edge + 8 }
    const room = [W - 48, H - edge - 110]
    const inside = Math.min(room[0] / (wide ? 46 : 44), room[1] / 30) / U

    const home = [W / 2, H * 0.62]
    // Court-side: the court's length runs across the screen, sized to the width it has
    const courtZoom = Math.min(wide ? (W - 64) / (2 * L + 100) : (W - 16) / (2 * L + 44), (H - edge - 90) / ((2 * D + 70) * 0.75)) / U
    const courtPitch = wide ? [0.9, 0.96] : [0.78, 0.84]
    const sideline = -ANG + Math.PI / 2
    const park = world(0, 60)
    const lobbyAt = world(...local(20, 11))
    const stairAt = world(...local(...UP))
    const floorAt = world(...local(TOWER.width / 2, DEPTH / 2 + 3))
    const look = wide ? [0.8, 0.78] : [0.6, 0.58]
    const z = Math.log
    const E = STORY_END
    const TAU = Math.PI * 2
    chase = { zoom: (wide ? 5 : 3.6) / U, pitch: wide ? 0.95 : 0.9, lead: wide ? 26 : 22 }
    const c0 = chaseView(0.5)
    const c1 = chaseView(0.61)
    const lobby = inside * (wide ? 0.62 : 0.78)
    // The camera climbs the stairwell with the route, turning half a circle so it arrives facing the
    // sensor. Every later key carries that turn, so the story ends a full turn round, which is the
    // same view as the page below it.
    const spin = -TAU
    keys = {
      zoom: spline([[0, 0], [0.13, z(courtZoom)], [0.31, z(courtZoom * 1.03)], [0.4, z(0.46)], [0.44, z(0.5)], [0.5, c0.zoom], [0.61, c1.zoom], [0.68, z(lobby)], [0.76, z(lobby * 1.06)], [0.8, z(inside * 0.5)], [0.86, z(inside * 0.5)], [0.9, z(inside * 0.58)], [0.98, z(inside)], [1.09, z(inside * 1.05)], [1.14, z(inside * 0.94)], [E, 0]]),
      pitch: spline([[0, 0], [0.03, 0], [0.13, courtPitch[0]], [0.31, courtPitch[1]], [0.4, 0], [0.44, 0], [0.5, c0.pitch], [0.61, c1.pitch], [0.68, wide ? 0.8 : 0.72], [0.76, wide ? 0.8 : 0.72], [0.82, 0.62], [0.88, 0.66], [0.98, look[0]], [1.09, look[1]], [1.14, look[1] * 0.85], [E, 0]]),
      yaw: spline([[0, 0], [0.03, 0], [0.13, sideline - 0.2], [0.31, sideline - 0.11], [0.4, -ANG], [0.44, -ANG], [0.5, c0.yaw], [0.61, c1.yaw], [0.68, -ANG - Math.PI], [0.77, -ANG - Math.PI], [0.92, -ANG + 0.18 + spin], [0.98, -ANG + 0.24 + spin], [1.09, -ANG + 0.3 + spin], [1.14, -ANG + 0.33 + spin], [E, spin]]),
      focus: spline([[0, home], [0.13, world(2, COURT.v - 8)], [0.31, world(2, COURT.v + 9)], [0.4, park], [0.44, park], [0.5, c0.focus], [0.61, c1.focus], [0.68, lobbyAt], [0.76, lobbyAt], [0.8, stairAt], [0.88, stairAt], [0.98, floorAt], [1.19, floorAt], [E, home]]),
      fz: spline([[0, 0], [0.78, 0], [0.88, ZF + 1], [1.14, ZF + 1], [E, 0]]),
      contour: spline([[0, 1], [0.12, 0.5], [0.25, 0.5], [0.28, 0.85], [0.32, 0.85], [0.4, 0.22], [0.62, 0.22], [0.7, 0.32], [0.86, 0.4], [0.9, 0.95], [0.95, 0.35], [0.98, 0.12], [1.08, 0.12], [1.13, 0.8], [E, 1]]),
      frame: spline([[0, 0], [0.12, 1], [1.14, 1], [E, 0]]),
    }

    footprints = []
    blocks = []
    for (let k = 0; k < AVENUES.length - 1; k++) {
      for (let m = -66; m <= 60; m++) {
        const b = { u0: AVENUES[k] + 7, u1: AVENUES[k + 1] - 7, v0: m * STREET + 4, v1: (m + 1) * STREET - 4 }
        const cu = (b.u0 + b.u1) / 2
        const cv = (b.v0 + b.v1) / 2
        if (Math.abs(cu) < PARK.u && Math.abs(cv) < PARK.v) continue
        if (!inPoly(cu, cv, ISLAND)) continue
        const dist = Math.hypot(cu - tu, (cv - tv) * 0.8)
        if (k === TOWER.k && m === TOWER.m) {
          const own = { ...b, u1: b.u0 + TOWER.width }
          const annex = { ...b, u0: b.u0 + TOWER.width + 4 }
          footprints.push(own, annex)
          blocks.push({ ...own, own: true, h: TOWER.height, delay: 0.5 }, { ...annex, h: 46, delay: 0.5 })
          continue
        }
        footprints.push(b)
        const road = distToRoute(cu, cv)
        if (dist > 560 && road > 150) continue
        const start = Math.hypot(cu - ROUTE[0][0], cv - ROUTE[0][1])
        blocks.push({ ...b, h: 22 + hash(k, m) ** 2 * 170 * Math.max(0.3, 1 - dist / 900), delay: Math.min(1.2, start / 600) })
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
    }
    layer.width = Math.round(W * dpr)
    layer.height = Math.round(H * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const camera = (progress) => {
    const p = progress * STORY_END
    const k = keys.frame(p)
    let zoom = keys.zoom(p)
    let pitch = keys.pitch(p)
    let yaw = keys.yaw(p)
    let f = keys.focus(p)
    const w = chaseWeight(p)
    if (w > 0) {
      const c = chaseView(p)
      zoom = lerp(zoom, c.zoom, w)
      pitch = lerp(pitch, c.pitch, w)
      yaw = lerp(yaw, c.yaw, w)
      f = [lerp(f[0], c.focus[0], w), lerp(f[1], c.focus[1], w)]
    }
    return {
      zoom: Math.exp(zoom),
      pitch,
      yaw,
      fx: f[0],
      fy: f[1],
      fz: keys.fz(p) * U,
      ox: frame.ox * k,
      oy: frame.oy * k,
      contour: keys.contour(p),
      relief: 0.22 + 0.78 * smooth(1.14, STORY_END, p),
    }
  }

  // The contour field settles into rings around the court while it inks in, holds the court's shape
  // for a beat once the lines have gone, then relaxes. When the route reaches Floor 23 the contour
  // plane rushes up to the floor and rings out from it like a pulse, holds there under the room,
  // takes the floor's outline as the room fades, and rides back down with the camera.
  const ground = (progress) => {
    const p = progress * STORY_END
    const court = smooth(0.02, 0.085, p) * (1 - smooth(0.31, 0.36, p))
    if (court > 0) {
      const [x, y] = world(0, COURT.v)
      return { k: court, x, y, cos: CA, sin: SA, hu: D * U, hv: L * U, step: 12 * U, rings: 4, z: 0 }
    }
    const z = p < 0.86 ? 0 : p < 1.14 ? ZF * smooth(0.86, 0.9, p) : Math.max(0, keys.fz(p) - 1)
    if (z <= 0) return null
    const [x, y] = world(tu, tv)
    const box = { x, y, cos: CA, sin: SA, hu: (TOWER.width / 2) * U, hv: (DEPTH / 2) * U, z: z * U }
    const pulse = window4(p, 0.875, 0.895, 0.94, 0.98)
    if (pulse > 0) return { ...box, k: pulse, step: (2 + 7 * smooth(0.88, 0.97, p)) * U, rings: 5 }
    const k = smooth(1.08, 1.12, p) * (1 - smooth(1.16, 1.22, p))
    return { ...box, k, step: 3 * U, rings: 4 }
  }

  const draw = (ctx, { p: progress, time, pt, cam, colors }) => {
    const p = progress * STORY_END
    const alpha = 1 - smooth(STORY_END - 0.05, STORY_END - 0.01, p)
    if (alpha <= 0 || p <= 0.03 || !g) return
    if (tonesFrom !== colors) {
      tonesFrom = colors
      const { paper, ink, signal } = colors
      const land = colors['map-land']
      tones = {
        land,
        block: mix(land, ink, 0.1),
        park: mix(land, colors['contour-strong'], 0.45),
        tree: mix(mix(land, colors['contour-strong'], 0.45), ink, 0.14),
        lawn: mix(land, colors['contour-strong'], 0.2),
        water: mix(land, signal, 0.28),
        faces: [mix(paper, ink, 0.17), mix(paper, ink, 0.1), mix(paper, ink, 0.02), mix(paper, ink, 0.06)],
        cut: mix(paper, ink, 0.72),
        core: [mix(paper, ink, 0.3), mix(paper, ink, 0.24), mix(paper, ink, 0.16), mix(paper, ink, 0.2)],
        car: [mix(ink, paper, 0.08), mix(ink, paper, 0.22), mix(ink, paper, 0.34), mix(ink, paper, 0.18)],
        roof: mix(ink, paper, 0.3),
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
    // Low chase views put parts of the map behind the camera, so lines are cut where they leave it
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
    const seg = (a, b, k = 1) => {
      const end = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * k]
      const q0 = atP(a)
      const q1 = atP(end)
      if (!q0 && !q1) return
      const s0 = q0 || edge(end, a)
      const s1 = q1 || edge(a, end)
      g.moveTo(s0[0], s0[1])
      g.lineTo(s1[0], s1[1])
    }
    const court = (x, y, z = 0) => [x, COURT.v + y, z]
    // A flat band along a polyline on the ground, so it narrows into the distance like a road marking
    const ribbon = (pts, hw, z = 0) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [u0, v0] = pts[i]
        const [u1, v1] = pts[i + 1]
        const len = Math.hypot(u1 - u0, v1 - v0)
        if (len < 1e-6) continue
        const nu = (-(v1 - v0) / len) * hw
        const nv = ((u1 - u0) / len) * hw
        path([[u0 + nu, v0 + nv, z], [u1 + nu, v1 + nv, z], [u1 - nu, v1 - nv, z], [u0 - nu, v0 - nv, z]], true)
      }
      for (const [u, v] of pts.slice(1, -1)) path([[u - hw, v + hw, z], [u + hw, v + hw, z], [u + hw, v - hw, z], [u - hw, v - hw, z]], true)
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

    const outside = 1 - smooth(0.8, 0.86, p)

    // Manhattan, block by block
    const map = smooth(0.33, 0.4, p) * outside
    if (map > 0) {
      g.globalAlpha = map
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

      // Central Park, recognisable by its own landmarks: tree cover, the drive loop and transverse
      // roads, the Great Lawn, the Reservoir and the Harlem Meer
      g.fillStyle = tones.tree
      g.beginPath()
      for (const [u, v, r] of TREES) {
        const q = at(u, v)
        if (!q) continue
        g.moveTo(q[0] + r * zs, q[1])
        g.arc(q[0], q[1], r * zs, 0, Math.PI * 2)
      }
      g.fill()
      g.fillStyle = tones.lawn
      g.beginPath()
      path(GREAT_LAWN, true)
      g.fill()
      g.fillStyle = tones.water
      g.beginPath()
      path(RESERVOIR, true)
      path(MEER, true)
      path(LAKE, true)
      path(POND, true)
      g.fill()
      g.strokeStyle = tones.land
      g.lineWidth = 3 * zs
      g.beginPath()
      path(DRIVE, true)
      for (const v of TRANSVERSE) path([[-PARK.u + 7, v], [PARK.u - 7, v]])
      g.stroke()

      g.strokeStyle = tones.land
      g.lineWidth = 9 * zs
      g.beginPath()
      path(BROADWAY)
      g.stroke()
    }

    // The court: the contours settle into its outline, it inks in as lines, then the lines fade back
    // into the contour they were drawn over
    const inked = smooth(0.08, 0.14, p) * (1 - smooth(0.25, 0.28, p)) * outside
    if (inked > 0) {
      const thin = clamp(0.38 * zs, 0.75, 1.75)
      g.globalAlpha = inked
      g.strokeStyle = colors.signal
      g.lineWidth = thin
      g.beginPath()
      LINES.forEach(([a0, b0]) => seg(court(...a0), court(...b0)))
      g.stroke()
      g.globalAlpha = inked * 0.14
      g.fillStyle = colors.signal
      g.beginPath()
      path([court(-D - 5, 0), court(D + 5, 0), court(D + 5, 0, 10), court(-D - 5, 0, 10)], true)
      g.fill()
      g.globalAlpha = inked
      g.lineWidth = thin * 1.4
      g.beginPath()
      seg(court(-D - 5, 0, 10), court(D + 5, 0, 10))
      g.stroke()
      g.strokeStyle = colors.ink
      g.beginPath()
      for (const u of [-D - 5, D + 5]) seg(court(u, 0), court(u, 0, 10.7))
      g.stroke()

      const rally = window4(p, 0.13, 0.16, 0.24, 0.27)
      if (rally > 0) {
        // Each shot crosses from one baseline to the other, bounces three quarters of the way, and
        // rises to the next racket
        const shot = (n) => {
          const side = n % 2 ? 1 : -1
          return { side, from: [(hash(n, 1) - 0.5) * S * 1.4, side * (L - 6)], to: [(hash(n + 1, 1) - 0.5) * S * 1.4, -side * (L - 6)] }
        }
        const BOUNCE = 0.72
        const n = Math.floor(time / RALLY)
        const u = (time % RALLY) / RALLY
        const ball = (tm) => {
          const f = (tm % RALLY) / RALLY
          const { from, to } = shot(Math.floor(tm / RALLY))
          const h = f < BOUNCE ? lerp(9, 0, f / BOUNCE) + Math.sin((f / BOUNCE) * Math.PI) * 24 : Math.sin(((f - BOUNCE) / (1 - BOUNCE)) * Math.PI * 0.5) * 9
          return [lerp(from[0], to[0], f), lerp(from[1], to[1], f), h]
        }
        const ellipse = (cu, cv, ru, rv) => path(Array.from({ length: 24 }, (_, i) => court(cu + Math.cos((i / 24) * Math.PI * 2) * ru, cv + Math.sin((i / 24) * Math.PI * 2) * rv)), true)

        // Where the last two balls landed
        for (const k of [n - 1, n]) {
          const age = time - (k + BOUNCE) * RALLY
          if (age < 0 || age > 1400) continue
          const { from, to } = shot(k)
          const bu = lerp(from[0], to[0], BOUNCE)
          const bv = lerp(from[1], to[1], BOUNCE)
          const grow = ease(Math.min(1, age / 320))
          const fade = rally * (1 - age / 1400)
          g.globalAlpha = fade * 0.55
          g.fillStyle = colors.signal
          g.beginPath()
          ellipse(bu, bv, 0.9, 1.7)
          g.fill()
          g.globalAlpha = fade
          g.strokeStyle = colors.signal
          g.lineWidth = 1.5
          g.beginPath()
          ellipse(bu, bv, 1 + 3 * grow, 1.7 + 5 * grow)
          g.stroke()
        }

        // The players, each tracking toward where they'll hit next, swinging through the ball
        const body = clamp(1.3 * zs, 3, 8)
        for (const side of [-1, 1]) {
          const now = shot(n)
          const hitting = now.side === side
          const from = hitting ? shot(n - 1).to : shot(n - 1).from
          const to = hitting ? now.from : now.to
          const k = hitting ? 1 : ease(u)
          const pu = lerp(from[0], to[0], k)
          const pv = to[1] + side * 12
          const foot = at(...court(pu, pv))
          const head = at(...court(pu, pv, 17))
          if (!foot || !head) continue
          g.globalAlpha = rally * 0.25
          g.fillStyle = colors.ink
          g.beginPath()
          ellipse(pu, pv, 3, 4.5)
          g.fill()
          g.globalAlpha = rally
          g.strokeStyle = colors.ink
          g.fillStyle = colors.ink
          g.lineWidth = body
          g.beginPath()
          g.moveTo(foot[0], foot[1])
          g.lineTo(head[0], head[1])
          g.stroke()
          g.beginPath()
          g.arc(head[0], head[1], clamp(1.4 * zs, 3, 8), 0, Math.PI * 2)
          g.fill()

          const since = hitting ? u * RALLY : (u - 1) * RALLY
          const swing =
            since < -350 ? 0.8
              : since < -80 ? lerp(0.8, 3.4, ease((since + 350) / 270))
                : since < 150 ? lerp(3.4, 0.4, ease((since + 80) / 230))
                  : since < 500 ? lerp(0.4, 0.8, ease((since - 150) / 350)) : 0.8
          const hand = [pu + 2, pv - side * 2.5, 10]
          const tip = [hand[0], hand[1] - side * Math.cos(swing) * 7, hand[2] + Math.sin(swing) * 7]
          const neck = [lerp(hand[0], tip[0], 0.55), lerp(hand[1], tip[1], 0.55), lerp(hand[2], tip[2], 0.55)]
          g.lineWidth = body * 0.4
          g.beginPath()
          seg(court(...hand), court(...tip))
          g.stroke()
          g.lineWidth = body * 0.9
          g.beginPath()
          seg(court(...neck), court(...tip))
          g.stroke()
        }

        // The ball: where it is over the court, the arc it just flew, and the ball itself
        const [bu, bv, bh] = ball(time)
        g.globalAlpha = rally * 0.3 * (1 - bh / 50)
        g.fillStyle = colors.ink
        g.beginPath()
        ellipse(bu, bv, 1.2 / (1 + bh / 25), 1.8 / (1 + bh / 25))
        g.fill()
        const trail = Array.from({ length: 17 }, (_, k) => at(...court(...ball(time - k * 28))))
        g.strokeStyle = colors.signal
        g.lineWidth = clamp(0.5 * zs, 1.2, 3)
        for (let k = 1; k < trail.length; k++) {
          const a = trail[k - 1]
          const b = trail[k]
          if (!a || !b) continue
          g.globalAlpha = rally * (1 - k / trail.length) * 0.6
          g.beginPath()
          g.moveTo(a[0], a[1])
          g.lineTo(b[0], b[1])
          g.stroke()
        }
        if (trail[0]) {
          g.globalAlpha = rally
          g.fillStyle = colors.signal
          g.beginPath()
          g.arc(trail[0][0], trail[0][1], clamp(1.1 * zs, 3, 6), 0, Math.PI * 2)
          g.fill()
        }
      }
    }

    // A 9-1-1 call and the unit's route to it: drawn in from above, then driven
    const call = window4(p, 0.41, 0.44, 0.64, 0.7)
    const rise = smooth(0.44, 0.52, p)
    const s = driven(p)
    const toLocal = (pts) => pts.map((q) => local(...q))
    if (call > 0) {
      const drawn = smooth(0.42, 0.46, p)
      const planned = trim(ROUTE, drawn)
      const rw = clamp(2.2 / zs, 1.2, 4)
      g.globalAlpha = call
      g.fillStyle = colors.paper
      g.beginPath()
      ribbon(planned, rw * 2)
      g.fill()
      g.globalAlpha = call * 0.45
      g.fillStyle = colors.signal
      g.beginPath()
      ribbon(planned, rw)
      g.fill()
      if (s > 0) {
        g.globalAlpha = call
        g.beginPath()
        ribbon(trim(ROUTE, s / ROUTE_LENGTH), rw)
        g.fill()
      }
      const start = at(...ROUTE[0])
      if (start) {
        g.globalAlpha = call
        g.fillStyle = colors.ink
        g.fillRect(start[0] - 4, start[1] - 4, 8, 8)
      }
      const head = at(...planned[planned.length - 1])
      if (head && drawn < 1) {
        g.fillStyle = colors.paper
        g.strokeStyle = colors.signal
        g.lineWidth = 2.5
        g.beginPath()
        g.arc(head[0], head[1], 5, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }

      const pin = call * (1 - rise)
      const q = at(tu, tv)
      if (q && pin > 0) {
        const w = (time / 1800) % 1
        g.strokeStyle = colors.signal
        g.lineWidth = 1.5
        g.globalAlpha = pin * (1 - w) * 0.8
        g.beginPath()
        g.arc(q[0], q[1], 8 + w * 16, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = pin
        g.fillStyle = colors.paper
        g.beginPath()
        g.arc(q[0], q[1], 8, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = colors.signal
        g.beginPath()
        g.arc(q[0], q[1], 5.5, 0, Math.PI * 2)
        g.fill()
        tag(q, [['9-1-1 call', 650, 16, colors.ink]], pin, 1, 16)
      }
    }

    // The response unit: headlights down the road, its light bar flashing, a glow on the tarmac
    const car = ([u, v, a], alpha) => {
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const off = (f, l) => [u + c * f - sn * l, v + sn * f + c * l]
      const box = (f0, f1, l0, l1) => [off(f0, l0), off(f1, l0), off(f1, l1), off(f0, l1)]
      const flash = Math.floor(time / 240) % 2
      g.globalAlpha = alpha * (0.1 + 0.08 * flash)
      g.fillStyle = colors.signal
      g.beginPath()
      path(Array.from({ length: 20 }, (_, i) => off(Math.cos((i / 20) * Math.PI * 2) * 6, Math.sin((i / 20) * Math.PI * 2) * 3.6)), true)
      g.fill()
      g.globalAlpha = alpha * 0.16
      g.fillStyle = colors.paper
      g.beginPath()
      path([off(4, -1.5), off(24, -7), off(24, 7), off(4, 1.5)], true)
      g.fill()
      g.lineWidth = 0.75
      const body = { solid: alpha, faces: tones.car, top: tones.roof, edge: colors.ink, line: 0.35 }
      solid(box(-4, 4, -1.9, 1.9), 0.5, 2.4, body)
      solid(box(-2.6, 1.4, -1.6, 1.6), 2.4, 3.5, body)
      const lamp = (on) => ({ solid: alpha, faces: Array(4).fill(on ? colors.signal : colors.paper), top: on ? colors.signal : colors.paper, edge: colors.ink, line: 0.3 })
      solid(box(-1.5, -0.5, -1.3, 0), 3.5, 4.1, lamp(flash))
      solid(box(-1.5, -0.5, 0, 1.3), 3.5, 4.1, lamp(!flash))
    }

    // The blocks rise around the unit as the camera drops in behind it, and fall away once it is
    // inside the tower
    const city = rise * (1 - smooth(0.62, 0.67, p))
    const xray = smooth(0.6, 0.65, p)
    const lit = smooth(0.5, 0.56, p) * (1 - smooth(0.64, 0.68, p))
    const shell = 1 - smooth(0.66, 0.71, p)
    const unit = window4(p, 0.43, 0.46, 0.8, 0.85)
    const order = []
    if (rise > 0) {
      for (const b of blocks) {
        if (b.own ? shell <= 0 : city <= 0) continue
        const k = ease(clamp01(rise * 1.8 - b.delay * 0.6))
        if (k <= 0) continue
        const q = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2)
        if (q) order.push({ b, h: b.h * k, d: q[1] })
      }
    }
    let subject = H * 0.62
    if (unit > 0) {
      const [cu, cv] = along(s)
      const q = at(cu, cv)
      if (q) {
        order.push({ car: [cu, cv, heading(s, 5)], d: q[1] })
        subject = q[1]
      }
    }
    // Low over the street, anything between the camera and the unit thins out of the way
    const thin = smooth(0.45, 0.5, p)
    order.sort((x, y) => x.d - y.d)
    g.lineWidth = 0.75
    for (const { b, h, d, car: driving } of order) {
      if (driving) {
        car(driving, unit)
        g.lineWidth = 0.75
        continue
      }
      if (!b.own) {
        prism(b, 0, h, { solid: city * (1 - 0.85 * thin * smooth(subject - 60, subject + 120, d)) })
        continue
      }
      const body = (1 - 0.8 * xray) * shell
      const glow = lit > 0
      const sides = prism(b, 0, h, { solid: body, edge: glow ? colors.signal : colors['contour-strong'], line: glow ? (1 / Math.max(body, 0.01)) * shell : 0.55 })
      if (!sides || !glow) continue
      const base = rect(b)
      g.strokeStyle = colors.signal
      for (const i of sides) {
        const [ua, va] = base[i]
        const [ub, vb] = base[(i + 1) % 4]
        const level = (f) => [at(ua, va, (h * f) / TOWER.floors), at(ub, vb, (h * f) / TOWER.floors)]
        if (xray > 0) {
          g.globalAlpha = xray * 0.45 * shell
          g.beginPath()
          for (let f = 1; f < TOWER.floors; f++) {
            const [s0, s1] = level(f)
            if (!s0 || !s1) continue
            g.moveTo(s0[0], s0[1])
            g.lineTo(s1[0], s1[1])
          }
          g.stroke()
        }
        const [c0, d0] = level(TOWER.floor - 1)
        const [c1, d1] = level(TOWER.floor)
        if (!c0 || !d0 || !c1 || !d1) continue
        g.globalAlpha = lit * 0.9
        g.fillStyle = colors.signal
        poly([c0, d0, d1, c1])
        g.fill()
      }
    }

    const hw = clamp(1.8 / zs, 0.22, 4)
    const floorPath = (b, z = 0) => path(rect(floorBox(b)).map(([u, v]) => [u, v, z]), true)
    const depthOf = (u, v, z = 0) => at(u, v, z)?.[1] ?? 0

    // The ground floor as indoor navigation reads it: the exits, then the stairs, then the shared
    // rooms are picked out in turn, and the route walks from the curb to Stair A
    const lobby = window4(p, 0.63, 0.68, 0.84, 0.88)
    if (lobby > 0 && tower) {
      const exits = smooth(0.665, 0.69, p)
      const stairs = smooth(0.69, 0.715, p)
      const rooms = smooth(0.715, 0.74, p)
      const named = 1 - smooth(0.765, 0.79, p)
      g.globalAlpha = lobby
      g.fillStyle = tones.land
      g.beginPath()
      floorPath([0, 0, TOWER.width, DEPTH])
      g.fill()

      if (rooms > 0) {
        g.globalAlpha = lobby * rooms * 0.16
        g.fillStyle = colors.signal
        g.beginPath()
        for (const r of ROOMS) floorPath(r.b)
        g.fill()
      }

      g.globalAlpha = lobby * 0.7
      g.strokeStyle = colors['contour-strong']
      g.lineWidth = 1
      g.beginPath()
      for (const [x0, y0, x1, y1] of STAIRS) {
        const mid = (x0 + x1) / 2
        seg([...local(mid, y0 + 2), 0.02], [...local(mid, y1 - 0.4), 0.02])
        for (let y = y0 + 2; y < y1 - 0.3; y += 0.8) seg([...local(x0 + 0.4, y), 0.02], [...local(x1 - 0.4, y), 0.02])
      }
      g.stroke()

      const walk = trim(LOBBY_ROUTE, smooth(0.73, 0.775, p))
      if (walk.length > 1) {
        g.globalAlpha = lobby
        g.fillStyle = colors.paper
        g.beginPath()
        ribbon(toLocal(walk), hw * 1.9, 0.05)
        g.fill()
        g.fillStyle = colors.signal
        g.beginPath()
        ribbon(toLocal(walk), hw, 0.05)
        g.fill()
      }

      const boxes = [
        ...GROUND_WALLS.map((w) => ({ b: wallBox(w), z: WALL, cut: true })),
        { b: floorBox(CORE), z: WALL + 0.6, core: true },
      ]
        .map((box) => ({ ...box, d: depthOf((box.b.u0 + box.b.u1) / 2, (box.b.v0 + box.b.v1) / 2) }))
        .sort((x, y) => x.d - y.d)
      g.lineWidth = 0.75
      for (const box of boxes) {
        prism(box.b, 0, box.z, { solid: lobby, faces: box.core ? tones.core : tones.faces, top: tones.cut, line: 0.6 })
      }

      // A bracket that closes in on each feature as it is identified
      const lockOn = (b, k, z = WALL + 0.4) => {
        const grow = (1 - k) * 3
        g.globalAlpha = lobby * k
        g.strokeStyle = colors.signal
        g.lineWidth = 1.75
        g.beginPath()
        floorPath([b[0] - grow, b[1] - grow, b[2] + grow, b[3] + grow], z)
        g.stroke()
      }
      if (exits > 0) {
        for (const e of EXITS) {
          const [x, y] = e.at
          const [ox, oy] = e.out
          const half = e.span / 2
          g.globalAlpha = lobby * exits
          g.strokeStyle = colors.signal
          g.lineWidth = 4
          g.beginPath()
          seg([...local(x + oy * half, y - ox * half), 0.1], [...local(x - oy * half, y + ox * half), 0.1])
          g.stroke()
          if (!e.name) continue
          const d = 1.4 + pingpong(time * 0.003, 1.2)
          g.lineWidth = 2.5
          g.beginPath()
          path([
            [...local(x + ox * (d + 1) + oy * 1.4, y + oy * (d + 1) - ox * 1.4), 0.1],
            [...local(x + ox * (d + 2.4), y + oy * (d + 2.4)), 0.1],
            [...local(x + ox * (d + 1) - oy * 1.4, y + oy * (d + 1) + ox * 1.4), 0.1],
          ])
          g.stroke()
          tag(at(...local(x + ox * 5, y + oy * 5), 0.1), [[e.name, 650, 14, colors.ink]], lobby * exits * named, ox || 1, 0)
        }
      }
      if (stairs > 0) {
        STAIRS.forEach((b, i) => {
          lockOn(b, stairs)
          tag(at(...local((b[0] + b[2]) / 2, b[1]), WALL + 0.4), [[`Stair ${'AB'[i]}`, 650, 14, colors.ink]], lobby * stairs * named, 0)
        })
      }
      if (rooms > 0) {
        for (const r of ROOMS) {
          lockOn(r.b, rooms, 0.05)
          tag(at(...local((r.b[0] + r.b[2]) / 2, (r.b[1] + r.b[3]) / 2), 0.1), [[r.name, 650, 14, colors.ink]], lobby * rooms * named, 0)
        }
      }
    }

    // Up Stair A: the route climbs, the floors stream past the camera, and Floor 23 waits lit above
    const ghosts = smooth(0.66, 0.72, p) * (1 - smooth(0.93, 0.98, p))
    const climb = smooth(0.78, 0.88, p)
    const per = TOWER.height / TOWER.floors
    if (ghosts > 0 && tower) {
      const eye = cam.fz / U
      const outline = rect(tower)
      g.lineWidth = 1
      for (let n = 2; n <= TOWER.floors; n++) {
        const z = (n - 1) * per
        const near = 1 - clamp01(Math.abs(z - eye) / 80)
        g.globalAlpha = ghosts * (0.14 + 0.5 * near)
        g.strokeStyle = n === TOWER.floor ? colors.signal : colors['contour-strong']
        g.lineWidth = n === TOWER.floor ? 2.5 : 1
        g.beginPath()
        path(outline.map(([u, v]) => [u, v, z]), true)
        g.stroke()
        g.globalAlpha = ghosts * (0.2 + 0.5 * near)
        g.strokeStyle = colors.signal
        g.lineWidth = 1
        g.beginPath()
        floorPath(STAIRS[0], z)
        g.stroke()
      }
      g.globalAlpha = ghosts * 0.35
      g.strokeStyle = colors['contour-strong']
      g.beginPath()
      for (const [u, v] of outline) seg([u, v, 0], [u, v, TOWER.height])
      g.stroke()

      const callerDot = window4(p, 0.74, 0.78, 0.93, 0.97)
      const cq = at(caller[0], caller[1], ZF + 1.7)
      if (cq && callerDot > 0) {
        const w = (time / 1500) % 1
        g.strokeStyle = colors.signal
        g.lineWidth = 1.5
        g.globalAlpha = callerDot * (1 - w)
        g.beginPath()
        g.arc(cq[0], cq[1], 5 + w * 14, 0, Math.PI * 2)
        g.stroke()
        g.globalAlpha = callerDot
        g.fillStyle = colors.signal
        g.beginPath()
        g.arc(cq[0], cq[1], 4.5, 0, Math.PI * 2)
        g.fill()
      }

      if (climb > 0) {
        const [su, sv] = local(...UP)
        const top = [su, sv, climb * ZF]
        g.globalAlpha = ghosts
        g.strokeStyle = colors.paper
        g.lineWidth = 8
        g.beginPath()
        seg([su, sv, 0], top)
        g.stroke()
        g.strokeStyle = colors.signal
        g.lineWidth = 3.5
        g.beginPath()
        seg([su, sv, 0], top)
        g.stroke()
        const hq = atP(top)
        if (hq) {
          g.fillStyle = colors.paper
          g.lineWidth = 2.5
          g.beginPath()
          g.arc(hq[0], hq[1], 5, 0, Math.PI * 2)
          g.fill()
          g.stroke()
          const n = 1 + Math.round(climb * (TOWER.floor - 1))
          tag(hq, [[`Floor ${n}`, 700, 18, colors.ink]], ghosts * window4(p, 0.775, 0.79, 0.9, 0.93), 1, 16)
        }
      }
    }

    // Arrival: Floor 23 flashes and rings out across the field
    const flash = window4(p, 0.872, 0.885, 0.9, 0.95)
    if (flash > 0 && tower) {
      g.globalAlpha = flash * 0.75
      g.fillStyle = colors.signal
      g.beginPath()
      path(rect(tower).map(([u, v]) => [u, v, ZF]), true)
      g.fill()
    }
    const ripple = window4(p, 0.875, 0.89, 0.95, 0.99)
    if (ripple > 0) {
      const rounded = (grow) => {
        const pts = []
        const hu = TOWER.width / 2
        const hv = DEPTH / 2
        for (const [cx, cy, a0] of [[1, 1, 0], [-1, 1, 0.5], [-1, -1, 1], [1, -1, 1.5]]) {
          for (let i = 0; i <= 6; i++) {
            const a = (a0 + i / 12) * Math.PI
            pts.push([tu + cx * hu + Math.cos(a) * grow, tv + cy * hv + Math.sin(a) * grow, ZF])
          }
        }
        return pts
      }
      g.strokeStyle = colors.signal
      for (let i = 0; i < 4; i++) {
        const r = clamp01((p - 0.877 - i * 0.012) / 0.07)
        if (r <= 0 || r >= 1) continue
        g.globalAlpha = ripple * (1 - r) ** 1.5
        g.lineWidth = 0.75 + 3 * (1 - r)
        g.beginPath()
        path(rounded(1 + ease(r) * 95), true)
        g.stroke()
      }
    }

    // Inside floor 23: a cutaway plan, a radar on the south wall, and the people it tracks
    const room = window4(p, 0.93, 0.98, 1.11, 1.15)
    if (room > 0 && tower) {
      const tracked = window4(p, 0.97, 1, 1.08, 1.11)
      const fan = room * smooth(0.96, 1, p)

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
      g.fillStyle = colors.signal
      g.beginPath()
      path([[...sensor, ZF], ...arc(SENSOR.range)], true)
      g.fill()
      g.globalAlpha = fan * 0.4
      g.strokeStyle = colors.signal
      g.lineWidth = 1
      g.beginPath()
      for (const r of [8, 16, 24]) path(arc(r))
      g.stroke()
      g.globalAlpha = fan * 0.28
      g.beginPath()
      path([[...sensor, ZF], [...facing(beam - 0.05, SENSOR.range), ZF], [...facing(beam + 0.05, SENSOR.range), ZF]], true)
      g.fill()

      g.restore()

      g.globalAlpha = room
      g.strokeStyle = colors.signal
      g.lineWidth = 1.5
      g.beginPath()
      floorPath(slab, ZF)
      g.stroke()

      // Out of the stairwell and across the floor to the caller
      const crossing = window4(p, 0.93, 0.95, 1, 1.04)
      const walk = trim(FLOOR_ROUTE, smooth(0.93, 0.985, p))
      if (crossing > 0 && walk.length > 1) {
        g.globalAlpha = crossing
        g.fillStyle = colors.paper
        g.beginPath()
        ribbon(toLocal(walk), hw * 1.9, ZF + 0.05)
        g.fill()
        g.fillStyle = colors.signal
        g.beginPath()
        ribbon(toLocal(walk), hw, ZF + 0.05)
        g.fill()
      }

      const walker = (t) => [2 + pingpong(t * 0.0026, 36), 9.2]
      const pacer = (t) => [27 + pingpong(t * 0.0016, 11), 19.4]
      const people = [
        { at: walker, speed: 1.3 },
        { at: pacer, speed: 0.8 },
        { at: () => CALLER, speed: 0, caller: true },
      ].map((who) => ({ ...who, x: who.at(time)[0], y: who.at(time)[1], tall: 3.1 }))

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
            g.arc(q[0], q[1], 1.8, 0, Math.PI * 2)
            g.fill()
          }
        }
      }

      const boxes = [
        ...WALLS.map((w) => ({ b: wallBox(w), z: WALL, cut: true })),
        ...DESKS.map((d) => ({ b: floorBox(d), z: 1.5 })),
        { b: floorBox(CORE), z: WALL + 0.6, core: true },
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
            line: 0.6,
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
        g.ellipse(foot[0], foot[1], 0.7 * zs, 0.35 * zs, 0, 0, Math.PI * 2)
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
        g.arc(head[0], head[1], Math.max(2.5, 0.42 * zs), 0, Math.PI * 2)
        g.fill()
        g.lineWidth = 0.75
      }

      // Radar returns: the walls light as the beam passes, people return a fresh cluster every frame
      g.fillStyle = colors.signal
      for (const r of returns) {
        if (Math.abs(r.a - beam) < 0.05) r.hit = time
        const glow = Math.exp(-(time - r.hit) / 1000)
        if (glow < 0.04) continue
        const q = at(...local(r.x, r.y), ZF + r.z)
        if (!q) continue
        g.globalAlpha = fan * glow
        g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3)
      }
      const scan = Math.floor(time / 90)
      people.forEach((who, n) => {
        for (let i = 0; i < (who.speed ? 9 : 4); i++) {
          const q = at(...local(who.x + (hash(scan + n * 31, i) - 0.5) * 1.8, who.y + (hash(i + 7, scan + n * 17) - 0.5) * 1.8), ZF + 0.3 + hash(scan, i + n * 9) * 2.9)
          if (!q) continue
          g.globalAlpha = fan * 0.85
          g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3)
        }
      })

      const ink = [colors.ink, colors.ink, colors.ink, colors.ink]
      const unit = prism(floorBox([SENSOR.x - 1.4, SENSOR.y - 0.6, SENSOR.x + 1.4, SENSOR.y]), ZF + SENSOR.z - 0.8, ZF + SENSOR.z + 0.4, { solid: room, faces: ink, top: colors.ink, edge: colors.ink })
      const mount = at(...sensor, ZF)
      if (unit && mount) tag([mount[0], mount[1] + 30], [['mmWave radar', 650, 15, colors.ink]], room * tracked, 0)

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
        return [top.reduce((a, c) => (c[0] > a[0] ? c : a)), top.reduce((a, c) => (c[0] < a[0] ? c : a))]
      }
      if (tracked > 0) {
        for (const who of people) {
          const side = lock(who, tracked)
          if (!side) continue
          const meters = Math.hypot(who.x - SENSOR.x, who.y - SENSOR.y) * 0.5
          tag(side[0], [[`${meters.toFixed(1)} m`, 650, 15, colors.ink], [who.speed ? `${who.speed.toFixed(1)} m/s` : 'Standing still', 500, 13, colors.signal]], tracked, 1, 0, side[1])
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
