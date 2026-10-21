// The hero's city: Manhattan seen from the south over Midtown, with the evening traffic running.
// Scene positions are local units on Manhattan's grid, rotated 29° onto the screen the way the real
// grid sits; a unit is about 2.2 m.

const ANG = (29 * Math.PI) / 180
const CA = Math.cos(ANG)
const SA = Math.sin(ANG)
const TAU = Math.PI * 2
const PARK = { u: 115, v: 450 }
const AVENUES = [-475, -385, -295, -205, -115, 0, 115, 205, 295, 385, 475]
const STREET = 36
const ISLAND = [[-330, 1700], [-250, 2100], [60, 2150], [340, 1500], [420, 200], [360, -1100], [220, -2000], [-20, -2300], [-250, -1500], [-380, -200]]
const BROADWAY = [[260, 2150], [40, 1300], [-120, 470], [-200, -400], [-260, -1500]]
const TOWER = { k: 6, m: -2, height: 300, width: 40 }
const PER = TOWER.height / 40
const CENTER = { k: 3, m: 19, height: 52 }
const VIEW = { zoom: 0.5, pitch: 0.86, yaw: -ANG + 0.42, focus: [150, 900] }

const HAZE = 8
// Cloud shadows drifting over the island from the south, in local units and units a second; v is
// where each starts on the page's first frame
const CLOUDS = [
  { u: -140, v: 1300, r: 230, du: 3.2, dv: -5 },
  { u: 210, v: 520, r: 300, du: 2.6, dv: -4.2 },
  { u: -60, v: -260, r: 260, du: 3.6, dv: -5.6 },
  { u: 160, v: 2000, r: 210, du: 3, dv: -4.8 },
]

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const smooth = (a, b, v) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}
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

// Evening traffic: cars up and down the avenues and across the streets, each a short streak
const CARS = []
for (let i = 0; i < 760; i++) {
  const dir = hash(i, 31) < 0.5 ? 1 : -1
  CARS.push({ avenue: true, at: AVENUES[1 + Math.floor(hash(i, 32) * 9)] + dir * 3.5, dir, speed: 26 + hash(i, 33) * 34, phase: hash(i, 34) })
}
for (let i = 0; i < 300; i++) {
  const dir = hash(i, 41) < 0.5 ? 1 : -1
  CARS.push({ avenue: false, at: Math.round((hash(i, 42) - 0.5) * 120) * STREET + dir * 1.6, dir, speed: 16 + hash(i, 43) * 20, phase: hash(i, 44) })
}

// The blocks: footprints between the avenues and streets, Midtown and the Financial District tallest
const FOOTPRINTS = []
const BLOCKS = []
for (let k = 0; k < AVENUES.length - 1; k++) {
  for (let m = -66; m <= 62; m++) {
    const b = { u0: AVENUES[k] + 7, u1: AVENUES[k + 1] - 7, v0: m * STREET + 4, v1: (m + 1) * STREET - 4 }
    const bu = (b.u0 + b.u1) / 2
    const bv = (b.v0 + b.v1) / 2
    if (inPark(bu, bv) || !inPoly(bu, bv, ISLAND)) continue
    if (k === TOWER.k && m === TOWER.m) {
      const own = { ...b, u1: b.u0 + TOWER.width }
      const annex = { ...b, u0: b.u0 + TOWER.width + 4 }
      FOOTPRINTS.push(own, annex)
      BLOCKS.push({ ...own, h: TOWER.height, blink: 0 }, { ...annex, h: 46, blink: 0 })
      continue
    }
    FOOTPRINTS.push(b)
    if (k === CENTER.k && m === CENTER.m) {
      BLOCKS.push({ ...b, center: true, h: CENTER.height, blink: 0 })
      continue
    }
    const r = hash(k, m)
    const midtown = 330 * Math.exp(-(((bv - 800) / 260) ** 2)) * (0.3 + 0.7 * hash(m, k))
    const downtown = 260 * Math.exp(-(((bv - 2000) / 200) ** 2)) * (0.3 + 0.7 * hash(k + 3, m))
    BLOCKS.push({ ...b, h: 18 + r * r * 120 + midtown + downtown, blink: hash(m, k + 9) })
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
const world = (u, v) => [u * CA - v * SA, u * SA + v * CA]

export function createCity() {
  let W = 0
  let H = 0
  let tones = null
  let tonesFrom = null
  let cloud = null
  const [fx, fy] = world(...VIEW.focus)
  const cam = { sin: Math.sin(VIEW.pitch), cos: Math.cos(VIEW.pitch), ys: Math.sin(VIEW.yaw), yc: Math.cos(VIEW.yaw), fd: 1, cx: 0, cy: 0 }
  // Down the screen the city sinks into the ground and its outlines thin into the page's contours,
  // between these two heights
  const sink = [0, 1]

  const resize = (width, height) => {
    W = width
    H = height
    const wide = W > H
    cam.fd = Math.max(W, H) * 1.2
    cam.cx = W * (wide ? 0.64 : 0.5)
    cam.cy = H * (wide ? 0.6 : 0.46)
    sink[0] = H * (wide ? 0.42 : 0.3)
    sink[1] = H * (wide ? 0.98 : 0.8)
  }

  // A point on the grid, h units up, through the pitched camera to the screen
  const at = (u, v, h = 0) => {
    const [x, y] = world(u, v)
    const dx = x - fx
    const dy = y - fy
    const px = (dx * cam.yc - dy * cam.ys) * VIEW.zoom
    const py = (dx * cam.ys + dy * cam.yc) * VIEW.zoom
    const z = h * VIEW.zoom
    const depth = cam.fd - z * cam.cos - py * cam.sin
    if (depth < 80) return null
    const s = cam.fd / depth
    return [cam.cx + px * s, cam.cy + (py * cam.cos - z * cam.sin) * s]
  }

  const theme = (colors) => {
    const { paper, ink } = colors
    const land = colors['map-land']
    tones = {
      land,
      block: mix(land, ink, 0.1),
      park: mix(land, colors['contour-strong'], 0.45),
      water: mix(land, ink, 0.12),
      faces: [mix(paper, ink, 0.17), mix(paper, ink, 0.1), mix(paper, ink, 0.02), mix(paper, ink, 0.06)],
      night: document.documentElement.dataset.theme === 'night',
      window: [mix('#ffc964', paper, 0.08), mix('#f4f7ff', paper, 0.1)],
    }
    // Aerial perspective: blocks further off sink into the paper
    tones.haze = Array.from({ length: HAZE }, (_, i) => {
      const k = (i / (HAZE - 1)) * 0.62
      return { faces: tones.faces.map((c) => mix(c, paper, k)), top: mix(land, paper, k), edge: mix(colors['contour-strong'], paper, k * 1.1) }
    })
    // A soft round shadow, stretched onto the ground for each passing cloud
    cloud = document.createElement('canvas')
    cloud.width = cloud.height = 128
    const cg = cloud.getContext('2d')
    const grad = cg.createRadialGradient(64, 64, 0, 64, 64, 64)
    const [r, gr, bl] = rgb(ink)
    for (const [stop, a] of [[0, 1], [0.45, 0.8], [0.75, 0.3], [1, 0]]) grad.addColorStop(stop, `rgba(${r},${gr},${bl},${a})`)
    cg.fillStyle = grad
    cg.fillRect(0, 0, 128, 128)
  }

  let g = null
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

  // The island or its blocks, filled in white, for the ground to take its shape from; blocks are
  // filled brighter the taller they stand
  const shape = (target, which) => {
    g = target
    g.fillStyle = '#fff'
    g.globalAlpha = 1
    if (which === 'island') {
      g.beginPath()
      path(ISLAND, true)
      g.fill()
      return
    }
    for (const b of BLOCKS) {
      g.globalAlpha = 0.55 + 0.45 * Math.min(1, b.h / 320)
      g.beginPath()
      path(rect(b), true)
      g.fill()
    }
    g.globalAlpha = 1
  }

  const draw = (target, time, colors) => {
    g = target
    if (tonesFrom !== colors) {
      tonesFrom = colors
      theme(colors)
    }
    const zs = VIEW.zoom
    // A shaded box from its projected bottom and top: visible sides, then the top. Returns which
    // sides were visible.
    const shade = (lo, hi, { faces = tones.faces, top = tones.land, edge: line = colors['contour-strong'], fill = 1, stroke = 0.55 } = {}) => {
      if (lo.some((q) => !q) || hi.some((q) => !q)) return null
      const winding = area(lo)
      const shown = []
      g.strokeStyle = line
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        const face = [lo[i], lo[j], hi[j], hi[i]]
        if (area(face) * winding <= 0) continue
        shown.push(i)
        poly(face)
        g.globalAlpha = fill
        g.fillStyle = faces[i]
        if (fill > 0.002) g.fill()
        g.globalAlpha = stroke
        g.stroke()
      }
      poly(hi)
      g.globalAlpha = fill
      g.fillStyle = top
      if (fill > 0.002) g.fill()
      g.globalAlpha = stroke
      g.stroke()
      return shown
    }
    const prism = (b, h, opts) => {
      const base = rect(b)
      return shade(base.map(([u, v]) => at(u, v, 0)), base.map(([u, v]) => at(u, v, h)), opts)
    }

    g.clearRect(0, 0, W, H)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    g.globalAlpha = 1

    // Manhattan on the ground: the island, its blocks, Central Park and its water, Broadway
    g.fillStyle = tones.land
    g.beginPath()
    path(ISLAND, true)
    g.fill()
    g.fillStyle = tones.block
    g.beginPath()
    for (const b of FOOTPRINTS) path(rect(b), true)
    g.fill()
    g.fillStyle = tones.park
    g.beginPath()
    path([[-PARK.u + 7, -PARK.v + 4], [PARK.u - 7, -PARK.v + 4], [PARK.u - 7, PARK.v - 4], [-PARK.u + 7, PARK.v - 4]], true)
    g.fill()
    g.fillStyle = tones.water
    g.beginPath()
    for (const w of [RESERVOIR, MEER, LAKE, POND]) path(w, true)
    g.fill()
    g.globalAlpha = 0.6
    g.fillStyle = tones.land
    g.beginPath()
    path(GREAT_LAWN, true)
    g.fill()
    g.globalAlpha = 1
    g.strokeStyle = tones.land
    g.lineWidth = 9 * zs
    g.beginPath()
    path(BROADWAY)
    g.stroke()

    // Traffic, drawn on the ground before the blocks so the blocks in front cover it
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
      g.globalAlpha = i ? 0.75 : 0.9
      g.strokeStyle = colors.ink
      g.beginPath()
      for (let n = 0; n < list.length; n += 2) {
        g.moveTo(list[n][0], list[n][1])
        g.lineTo(list[n + 1][0], list[n + 1][1])
      }
      g.stroke()
    })
    // The ground and its traffic go before the blocks standing on them
    const ground = g.createLinearGradient(0, sink[0], 0, lerp(sink[0], sink[1], 0.7))
    ground.addColorStop(0, 'rgba(0,0,0,1)')
    ground.addColorStop(0.5, 'rgba(0,0,0,0.45)')
    ground.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalCompositeOperation = 'destination-in'
    g.globalAlpha = 1
    g.fillStyle = ground
    g.fillRect(0, 0, W, H)
    g.globalCompositeOperation = 'source-over'

    // After dark: lit windows on the sides of each block, a few switching on and off at a time
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
            const y = (PER * 1.5 + r * PER * 2 + (hash(seed, r) - 0.5) * PER * 0.6) / h
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
              const x = lerp(x0, lerp(c3[0], c2[0], s), y)
              const yy = lerp(y0, lerp(c3[1], c2[1], s), y)
              g.rect(x - pane / 2, yy - pane / 2, pane, pane)
            }
          }
          g.fill()
        }
      }
    }

    // The blocks, back to front, the far ones sinking into the air
    const order = []
    const airy = smooth(0.3, 0.8, VIEW.pitch)
    for (const b of BLOCKS) {
      const bu = (b.u0 + b.u1) / 2
      const bv = (b.v0 + b.v1) / 2
      const q = at(bu, bv)
      if (!q || q[0] < -500 || q[0] > W + 500 || q[1] < -300 || q[1] > H + 700) continue
      const [wx, wy] = world(bu, bv)
      const far = -((wx - fx) * cam.ys + (wy - fy) * cam.yc) * VIEW.zoom
      const k = smooth(sink[0], sink[1], q[1])
      if (k > 0.999) continue
      order.push({ b, d: q[1], k, haze: airy * smooth(H * 0.05, H * 1.5, far) })
    }
    order.sort((x, y) => x.d - y.d)
    g.lineWidth = 0.75
    for (const { b, k, haze } of order) {
      // Each block sinks to its footprint, its faces going first and then its outline, in the
      // contours' colour and weight by then
      const h = b.h * (1 - k) ** 1.3
      const fill = 1 - smooth(0, 0.55, k)
      const stroke = 0.55 * (1 - smooth(0.25, 0.85, k))
      const ink = { fill, stroke }
      g.lineWidth = lerp(0.75, 0.7, k)
      if (b.center) {
        prism(b, h, ink)
        // Its mast, blinking
        const foot = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h)
        const top = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h + 24)
        if (foot && top) {
          g.globalAlpha = fill
          g.strokeStyle = colors.ink
          g.lineWidth = 1.5
          g.beginPath()
          g.moveTo(foot[0], foot[1])
          g.lineTo(top[0], top[1])
          g.stroke()
          g.fillStyle = colors.ink
          g.globalAlpha = fill * (Math.floor(time / 700) % 2 ? 1 : 0.35)
          g.beginPath()
          g.arc(top[0], top[1], 3, 0, TAU)
          g.fill()
          g.lineWidth = 0.75
        }
        continue
      }
      const air = tones.haze[Math.round(haze * (HAZE - 1))]
      const faces = prism(b, h, { faces: air.faces, top: air.top, edge: air.edge, ...ink })
      if (tones.night && faces && h > 20 && fill > 0.01) lights(b, h, faces, fill * (1 - 0.65 * haze))
      // Warning lights on the tallest roofs, after dark
      if (tones.night && h > 250 && Math.floor(time / 900 + b.blink * 2) % 2) {
        const q = at((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2, h + 1)
        if (q) {
          g.globalAlpha = fill
          g.fillStyle = '#ff5a4a'
          g.beginPath()
          g.arc(q[0], q[1], clamp(0.9 * zs, 1.5, 3.5), 0, TAU)
          g.fill()
        }
      }
    }

    // Cloud shadows sliding over the city by day, only where the city is drawn
    if (!tones.night && cloud) {
      const flat = Math.cos(VIEW.pitch)
      g.globalCompositeOperation = 'source-atop'
      g.globalAlpha = 0.075
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
    g.globalAlpha = 1
  }

  return { resize, draw, shape, sink: () => sink }
}
