import Matter from 'matter-js'

const { Engine, Bodies, Body, Composite, Query, Vertices, Sleeping } = Matter

const STEP = 1000 / 60
const FLIGHT_MS = 520
const DEPTH = 8
const BALL_R = 17
const MAX_PIECES = 200
const MAX_NODES = 400
const WALL = 200
// Cracks run out from the impact first; then the pieces give way in a wave from the hit outward
const CRACK_MS = 70
const SPREAD_MS = 130
const PERSPECTIVE = 900
const SVG_NS = 'http://www.w3.org/2000/svg'
// Copied from the original for every node; none of these should follow a shard around
const SKIP = /^(transition|animation|will-change|view-transition|cursor|pointer-events)/
// The root takes the shard's box instead of its place in the page
const SKIP_ROOT = /^(position|inset|top|left|right|bottom|margin|transform|translate|rotate|scale|float)/

const rand = (a, b) => a + Math.random() * (b - a)

function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function clipToRect(poly, w, h) {
  const edges = [
    [(p) => p.x >= 0, (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= w, (a, b) => ({ x: w, y: a.y + ((b.y - a.y) * (w - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= 0, (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 })],
    [(p) => p.y <= h, (a, b) => ({ x: a.x + ((b.x - a.x) * (h - a.y)) / (b.y - a.y), y: h })],
  ]
  let out = poly
  for (const [inside, cut] of edges) {
    const src = out
    out = []
    for (let i = 0; i < src.length; i++) {
      const a = src[i]
      const b = src[(i + 1) % src.length]
      if (inside(b)) {
        if (!inside(a)) out.push(cut(a, b))
        out.push(b)
      } else if (inside(a)) out.push(cut(a, b))
    }
    if (!out.length) break
  }
  return out
}

const area = (poly) => {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

// Rays out of the impact and rings round it, like a pane taking a stone: the cells tile the box
// exactly because neighbours share their jittered corners
// `budget` caps the cell count: every cell carries a full copy of the element, so a complex one
// breaks into fewer, bigger pieces
function shatter(w, h, ix, iy, budget = 40) {
  const size = Math.max(w, h)
  const tiny = size < 28
  let rays = tiny ? 4 : Math.round(Math.min(11, Math.max(5, 4 + Math.sqrt(w * h) / 70)))
  let rings = tiny ? 1 : size > 140 ? 3 : 2
  while (rays * rings > budget && rings > 1) rings--
  rays = Math.max(3, Math.min(rays, Math.floor(budget / rings)))
  const base = Math.random() * Math.PI * 2
  const step = (Math.PI * 2) / rays
  const angles = Array.from({ length: rays }, (_, i) => base + i * step + rand(-0.3, 0.3) * step)
  let widest = 0
  for (let i = 0; i < rays; i++) {
    const next = i === rays - 1 ? angles[0] + Math.PI * 2 : angles[i + 1]
    widest = Math.max(widest, next - angles[i])
  }
  const far = Math.max(Math.hypot(ix, iy), Math.hypot(w - ix, iy), Math.hypot(ix, h - iy), Math.hypot(w - ix, h - iy))
  const outer = far / Math.cos(Math.min(widest, Math.PI * 0.9) / 2) + 20
  const radius = (k) => (k === rings ? outer : far * Math.pow(k / rings, 1.25))
  const jitter = angles.map(() => Array.from({ length: rings + 1 }, (_, k) => (k === 0 || k === rings ? 1 : rand(0.85, 1.15))))
  const vertex = (i, k) => {
    const j = i % rays
    const r = radius(k) * jitter[j][k]
    return { x: ix + Math.cos(angles[j]) * r, y: iy + Math.sin(angles[j]) * r }
  }
  const cells = []
  for (let i = 0; i < rays; i++) {
    for (let k = 0; k < rings; k++) {
      const quad = k === 0 ? [vertex(i, 0), vertex(i + 1, 1), vertex(i, 1)] : [vertex(i, k), vertex(i + 1, k), vertex(i + 1, k + 1), vertex(i, k + 1)]
      const cell = hull(clipToRect(quad, w, h))
      if (cell.length >= 3 && area(cell) > 6) cells.push(cell)
    }
  }
  return cells
}

// The part of `poly` on one side of the line through a, b (side 1 or -1)
function cutPoly(poly, a, b, side) {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const inside = (p) => side * (ex * (p.y - a.y) - ey * (p.x - a.x)) >= 0
  const cross = (p, q) => {
    const t = (ex * (a.y - p.y) - ey * (a.x - p.x)) / (ex * (q.y - p.y) - ey * (q.x - p.x))
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
  }
  const out = []
  for (let j = 0; j < poly.length; j++) {
    const p = poly[j]
    const q = poly[(j + 1) % poly.length]
    if (inside(q)) {
      if (!inside(p)) out.push(cross(p, q))
      out.push(q)
    } else if (inside(p)) out.push(cross(p, q))
  }
  return out
}

// `poly` cut down to the inside of the convex polygon `clip`
function clipConvex(poly, clip) {
  let turn = 0
  for (let i = 0; i < clip.length; i++) turn += clip[i].x * clip[(i + 1) % clip.length].y - clip[(i + 1) % clip.length].x * clip[i].y
  const side = turn > 0 ? 1 : -1
  let out = poly
  for (let i = 0; i < clip.length && out.length; i++) out = cutPoly(out, clip[i], clip[(i + 1) % clip.length], side)
  return out
}

// The cells' inner edges as lines over the element, each drawn from its end nearest the impact
// so the cracks run outward; edges along the element's own border aren't cracks
function crackLines(rect, cells, ix, iy) {
  const { width: w, height: h } = rect
  const size = Math.max(w, h)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'break-cracks')
  svg.setAttribute('width', w)
  svg.setAttribute('height', h)
  Object.assign(svg.style, { left: `${rect.left}px`, top: `${rect.top}px` })
  const onBorder = (a, b) => (Math.abs(a.x - b.x) < 0.5 && (a.x < 0.5 || a.x > w - 0.5)) || (Math.abs(a.y - b.y) < 0.5 && (a.y < 0.5 || a.y > h - 0.5))
  const seen = new Set()
  for (const cell of cells) {
    for (let i = 0; i < cell.length; i++) {
      let a = cell[i]
      let b = cell[(i + 1) % cell.length]
      if (onBorder(a, b)) continue
      const key = [a, b].map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      if (Math.hypot(b.x - ix, b.y - iy) < Math.hypot(a.x - ix, a.y - iy)) [a, b] = [b, a]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const line = document.createElementNS(SVG_NS, 'line')
      line.setAttribute('x1', a.x.toFixed(1))
      line.setAttribute('y1', a.y.toFixed(1))
      line.setAttribute('x2', b.x.toFixed(1))
      line.setAttribute('y2', b.y.toFixed(1))
      line.style.strokeDasharray = `${len} ${len}`
      line.style.strokeDashoffset = `${len}`
      line.style.animationDelay = `${((Math.hypot(a.x - ix, a.y - iy) / size) * CRACK_MS * 0.8).toFixed(0)}ms`
      svg.appendChild(line)
    }
  }
  return svg
}

// What the debris looks like: the element's fill if it has one, otherwise its text colour
function debrisColour(el) {
  const cs = getComputedStyle(el)
  const bg = cs.backgroundColor
  return bg && !/rgba\(.*,\s*0\)|transparent/.test(bg) ? bg : cs.color
}

// A copy of the element that looks the same anywhere: every computed style written inline
function snapshot(el, rect) {
  const copy = el.cloneNode(true)
  copy.removeAttribute('id')
  const src = [el, ...el.querySelectorAll('*')].slice(0, MAX_NODES)
  const dst = [copy, ...copy.querySelectorAll('*')].slice(0, MAX_NODES)
  src.forEach((s, n) => {
    const d = dst[n]
    if (!d?.style) return
    const cs = getComputedStyle(s)
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i]
      if (SKIP.test(prop) || (n === 0 && SKIP_ROOT.test(prop))) continue
      d.style.setProperty(prop, cs.getPropertyValue(prop))
    }
    d.removeAttribute?.('id')
  })
  const display = getComputedStyle(el).display
  Object.assign(copy.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    margin: '0px',
    boxSizing: 'border-box',
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: display.startsWith('inline') && display !== 'inline-block' ? 'inline-block' : display,
  })
  return copy
}

function copyCanvases(from, to) {
  const a = from instanceof HTMLCanvasElement ? [from] : [...from.querySelectorAll('canvas')]
  const b = to instanceof HTMLCanvasElement ? [to] : [...to.querySelectorAll('canvas')]
  a.forEach((c, i) => {
    const d = b[i]
    if (!d || !c.width || !c.height) return
    d.width = c.width
    d.height = c.height
    try {
      d.getContext('2d').drawImage(c, 0, 0)
    } catch {
      // A WebGL canvas without a kept buffer reads blank; the piece just shows its frame
    }
  })
}

function pickTarget(x, y) {
  let el = document.elementFromPoint(x, y)
  if (!el || el.closest('.break, .break-layer, [data-unbreakable]')) return null
  for (let broken = el.closest('[data-broken]'); broken; broken = el?.closest('[data-broken]')) el = broken.parentElement
  if (el instanceof SVGElement) el = el.closest('svg:not(svg svg)') || el
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect()
    if (r.width >= 4 && r.height >= 4) break
    el = el.parentElement
  }
  if (!el || el === document.body || el === document.documentElement || el.tagName === 'MAIN' || el.id === 'root') return null
  const r = el.getBoundingClientRect()
  if (r.width * r.height > 0.55 * innerWidth * innerHeight) return null
  return el
}

const BALL_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="48" fill="#d4ec3a"/>
  <path d="M14 20 C42 36 42 64 14 80" fill="none" stroke="#fbfdf2" stroke-width="5" stroke-linecap="round"/>
  <path d="M86 20 C58 36 58 64 86 80" fill="none" stroke="#fbfdf2" stroke-width="5" stroke-linecap="round"/>
</svg>`

// Pieces live in page coordinates: they fall past the fold and pile up at the bottom of the page,
// shrinking as they go so nothing big lies over the content
const SHRINK_MS = 700
const SHRUNK_PX = 26
const HOMING_SLACK = 40

// Elements that react to a hit instead of breaking listen for `break:hit` (cancelable, bubbles,
// detail { x, y } in viewport pixels) and call preventDefault. `data-break-homing` makes the ball
// follow a moving target; `data-unbreakable` areas never shatter. "Fix it" fires `break:fix` on window.
export function createBreaker() {
  const layer = document.createElement('div')
  layer.className = 'break-layer'
  layer.setAttribute('aria-hidden', 'true')
  document.body.appendChild(layer)

  const engine = Engine.create({ enableSleeping: true })
  engine.gravity.y = 1.1
  const wall = { isStatic: true, friction: 0.8, restitution: 0.1 }
  const floor = Bodies.rectangle(0, 0, 1, WALL, wall)
  const left = Bodies.rectangle(0, 0, WALL, 1, wall)
  const right = Bodies.rectangle(0, 0, WALL, 1, wall)
  let pageW = 0
  let pageH = 0
  const placeWalls = () => {
    layer.style.height = '0px'
    const w = document.documentElement.clientWidth
    const h = document.documentElement.scrollHeight
    layer.style.width = `${w}px`
    layer.style.height = `${h}px`
    if (w === pageW && h === pageH) return
    pageW = w
    pageH = h
    for (const [b, x, y, bw, bh] of [
      [floor, w / 2, h + WALL / 2, w + WALL * 2, WALL],
      [left, -WALL / 2, h / 2, WALL, h * 2],
      [right, w + WALL / 2, h / 2, WALL, h * 2],
    ]) {
      const bounds = b.bounds
      Body.scale(b, bw / (bounds.max.x - bounds.min.x), bh / (bounds.max.y - bounds.min.y))
      Body.setPosition(b, { x, y })
    }
    Composite.allBodies(engine.world).forEach((b) => Sleeping.set(b, false))
    wake()
  }
  Composite.add(engine.world, [floor, left, right])

  const pieces = []
  const flights = []
  const balls = []
  const grit = []
  const broken = new Set()
  let raf = 0
  let last = 0
  let acc = 0
  const wake = () => {
    if (raf) return
    last = performance.now()
    acc = 0
    raf = requestAnimationFrame(frame)
  }

  const removePiece = (p) => {
    Composite.remove(engine.world, p.body)
    p.node.remove()
  }
  const pieceAt = (x, y) => Query.point(pieces.filter((p) => p.released).map((p) => p.body), { x, y }).length > 0

  const blast = (x, y, power, reach) => {
    for (const p of pieces) {
      if (!p.released) continue
      const dx = p.body.position.x - x
      const dy = p.body.position.y - y
      const d = Math.hypot(dx, dy)
      if (d > reach) continue
      const k = power * (1 - d / reach)
      Sleeping.set(p.body, false)
      p.still = false
      Body.setVelocity(p.body, {
        x: p.body.velocity.x + (dx / (d || 1)) * k + rand(-1, 1),
        y: p.body.velocity.y + (dy / (d || 1)) * k - k * 0.6,
      })
      Body.setAngularVelocity(p.body, p.body.angularVelocity + rand(-0.15, 0.15))
      p.vrx += rand(-1, 1) * k * 0.012
      p.vry += rand(-1, 1) * k * 0.012
    }
  }

  // Fine grit thrown off the impact, too small to bother the physics (page coordinates)
  const dust = (x, y, colour, n) => {
    for (let i = 0; i < n; i++) {
      const node = document.createElement('div')
      node.className = 'break-grit'
      const s = rand(1.5, 4)
      Object.assign(node.style, { width: `${s}px`, height: `${s}px`, background: colour })
      layer.appendChild(node)
      const a = Math.random() * Math.PI * 2
      const v = rand(1.5, 6)
      grit.push({ node, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(1, 3), r: rand(0, 360), born: performance.now(), life: rand(450, 900) })
    }
  }

  const SHARD = { friction: 0.6, frictionAir: 0.014, restitution: 0.12, density: 0.0015 }

  // One piece: `cell` is a polygon in the element's own box (`src`: where that box sits on the page,
  // the copy every piece shows); `place` maps a cell point to where it is now, already turned by
  // `base` and scaled by `scale`
  const addPiece = (src, cell, place, base, scale, small, motion) => {
    const world = cell.map(place)
    const centre = Vertices.centre(world)
    const body = Bodies.fromVertices(centre.x, centre.y, [world], SHARD)
    if (!body) return null
    const c = Vertices.centre(cell)
    const node = document.createElement('div')
    node.className = 'break-shard'
    const origin = `${c.x.toFixed(1)}px ${c.y.toFixed(1)}px`
    Object.assign(node.style, { left: `${src.left}px`, top: `${src.top}px`, width: `${src.w}px`, height: `${src.h}px`, transformOrigin: origin })
    // physics moves the node, the tilt turns the piece in depth, the face is the clipped copy
    const tilt = document.createElement('div')
    tilt.className = 'break-shard__tilt'
    tilt.style.transformOrigin = origin
    const face = document.createElement('div')
    face.className = 'break-shard__face'
    face.style.clipPath = `polygon(${cell.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',')})`
    const copy = src.proto.cloneNode(true)
    if (src.canvas) copyCanvases(src.canvas, copy)
    face.appendChild(copy)
    tilt.appendChild(face)
    node.appendChild(tilt)
    layer.appendChild(node)
    const extent = Math.max(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / scale
    const a = Math.random() * Math.PI * 2
    const spin = motion.spin ?? 0.03
    const p = {
      body,
      node,
      tilt,
      face,
      src,
      cell,
      c,
      origin: { x: src.left + c.x, y: src.top + c.y },
      base,
      scale,
      small: small ?? Math.min(0.6, Math.max(0.18, SHRUNK_PX / extent)),
      releaseAt: motion.releaseAt ?? performance.now(),
      released: false,
      still: false,
      kick: motion.kick ?? { x: 0, y: 0 },
      turn: motion.turn ?? 0,
      z: 0,
      vz: motion.vz ?? 0,
      rx: 0,
      ry: 0,
      vrx: Math.cos(a) * spin,
      vry: Math.sin(a) * spin,
      shade: 1,
    }
    pieces.push(p)
    return p
  }

  // Where a cell point of `p` is right now, and back
  const poseOf = (p) => {
    const a = p.base + p.body.angle
    return { a, cos: Math.cos(a), sin: Math.sin(a), s: p.scale, pos: p.body.position }
  }
  const toWorld = (p, o) => (q) => {
    const dx = (q.x - p.c.x) * o.s
    const dy = (q.y - p.c.y) * o.s
    return { x: o.pos.x + dx * o.cos - dy * o.sin, y: o.pos.y + dx * o.sin + dy * o.cos }
  }
  const toCell = (p, o, x, y) => {
    const dx = x - o.pos.x
    const dy = y - o.pos.y
    return { x: p.c.x + (dx * o.cos + dy * o.sin) / o.s, y: p.c.y + (-dx * o.sin + dy * o.cos) / o.s }
  }

  // Swap a piece for smaller ones cut from it; `motion(centre)` says how each new one moves off
  const splitPiece = (p, cells, motion) => {
    const o = poseOf(p)
    const place = toWorld(p, o)
    const i = pieces.indexOf(p)
    if (i >= 0) pieces.splice(i, 1)
    removePiece(p)
    for (const cell of cells) addPiece(p.src, cell, place, o.a, o.s, o.s, motion(place(Vertices.centre(cell))))
  }

  // A ball landing on a piece big enough to see breaks it again, cracking out from the hit
  const SPLIT_PX = 22
  const shatterPiece = (p, x, y) => {
    const b = p.body.bounds
    if (Math.max(b.max.x - b.min.x, b.max.y - b.min.y) < SPLIT_PX) return false
    const o = poseOf(p)
    const q = toCell(p, o, x, y)
    const xs = p.cell.map((v) => v.x)
    const ys = p.cell.map((v) => v.y)
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    const w = Math.max(...xs) - x0
    const h = Math.max(...ys) - y0
    const cells = shatter(w, h, q.x - x0, q.y - y0, 7)
      .map((cell) => clipConvex(cell.map((v) => ({ x: v.x + x0, y: v.y + y0 })), p.cell))
      .filter((cell) => cell.length >= 3 && area(cell) * o.s * o.s > 4)
    if (cells.length < 2) return false
    splitPiece(p, cells, (centre) => {
      const dx = centre.x - x
      const dy = centre.y - y
      const d = Math.hypot(dx, dy) || 1
      return { kick: { x: (dx / d) * rand(1, 3), y: (dy / d) * rand(1, 3) - rand(2, 4) }, turn: rand(-0.2, 0.2), spin: 0.06 }
    })
    return true
  }

  // `x`, `y` in viewport pixels, like the rect
  const sourceOf = (el) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    placeWalls()
    const proto = snapshot(el, rect)
    return {
      rect,
      left: rect.left + scrollX,
      top: rect.top + scrollY,
      w: rect.width,
      h: rect.height,
      proto,
      nodes: Math.min(MAX_NODES, proto.getElementsByTagName('*').length + 1),
      canvas: el instanceof HTMLCanvasElement || el.querySelector('canvas') ? el : null,
    }
  }
  const markBroken = (el) => {
    while (pieces.length > MAX_PIECES) removePiece(pieces.shift())
    broken.add(el)
    el.setAttribute('data-broken', '')
  }

  const breakElement = (el, x, y) => {
    const src = sourceOf(el)
    if (!src) return false
    const { rect } = src
    const page = { left: src.left, top: src.top, width: src.w, height: src.h }
    const ix = Math.min(rect.width, Math.max(0, x - rect.left))
    const iy = Math.min(rect.height, Math.max(0, y - rect.top))
    const size = Math.max(rect.width, rect.height)
    const now = performance.now()
    const cells = shatter(rect.width, rect.height, ix, iy, Math.max(6, Math.min(40, Math.round(2400 / src.nodes))))
    const cracks = crackLines(page, cells, ix, iy)
    layer.appendChild(cracks)
    setTimeout(() => cracks.remove(), CRACK_MS + SPREAD_MS + 200)
    const place = (q) => ({ x: q.x + src.left, y: q.y + src.top })
    for (const cell of cells) {
      // Only what's round the impact takes the ball's push (mostly back into the page); the rest
      // just loses its hold and drops, tipping as it goes
      const centre = Vertices.centre(cell)
      const dx = centre.x - ix
      const dy = centre.y - iy
      const d = Math.hypot(dx, dy) || 1
      const near = Math.exp(-d / Math.max(30, size * 0.3))
      const push = 0.4 + 4.5 * near
      addPiece(src, cell, place, 0, 1, undefined, {
        releaseAt: now + CRACK_MS + (d / size) * SPREAD_MS * rand(0.8, 1.2),
        kick: { x: (dx / d) * push + rand(-0.5, 0.5), y: (dy / d) * push - rand(0, 1.5) * near },
        turn: rand(-1, 1) * (0.02 + 0.14 * near),
        vz: 2 + 9 * near * rand(0.7, 1.3),
        spin: 0.015 + 0.09 * near,
      })
    }
    dust(x + scrollX, y + scrollY, debrisColour(el), Math.round(Math.min(18, 6 + size / 30)))
    markBroken(el)
    return true
  }

  const ring = (x, y) => {
    const r = document.createElement('div')
    r.className = 'break-ring'
    r.style.left = `${x}px`
    r.style.top = `${y}px`
    r.addEventListener('animationend', () => r.remove())
    layer.appendChild(r)
  }

  // Tell whatever is under the ball it was hit (or the moving target it followed, which may have
  // run partly off screen); true if it handled the hit itself
  const notify = (x, y, homing) => {
    const el = homing?.isConnected ? homing : document.elementFromPoint(x, y)
    if (!el || el.closest('.break')) return false
    const ev = new CustomEvent('break:hit', { bubbles: true, cancelable: true, detail: { x, y } })
    el.dispatchEvent(ev)
    return ev.defaultPrevented
  }

  const land = (f) => {
    const { x, y } = f
    const px = x + scrollX
    const py = y + scrollY
    ring(px, py)
    f.node.classList.add('is-hit')
    const struck = Query.point(pieces.filter((p) => p.released).map((p) => p.body), { x: px, y: py })[0]
    const hitPiece = !!struck
    const handled = !hitPiece && notify(x, y, f.homing)
    const target = !handled && f.target && f.target.isConnected && !f.target.hasAttribute('data-broken') ? f.target : null
    const smashed = !hitPiece && target && breakElement(target, x, y)
    if (struck) shatterPiece(pieces.find((p) => p.body === struck), px, py)
    blast(px, py, hitPiece ? 12 : 6, hitPiece ? 140 : 90)
    if (hitPiece) dust(px, py, 'currentColor', 6)

    // The ball comes back off whatever it hit and drops to the bottom of the page
    const body = Bodies.circle(px, py, BALL_R, { restitution: 0.72, friction: 0.05, frictionAir: 0.004, density: 0.004 })
    Body.setVelocity(body, { x: rand(-4, 4), y: smashed || hitPiece ? rand(-3, 0) : rand(-7, -4) })
    Body.setAngularVelocity(body, rand(-0.3, 0.3))
    Composite.add(engine.world, body)
    balls.push({ body, node: f.node, born: performance.now() })
  }

  function frame(now) {
    const k = Math.min(4, (now - last) / STEP)
    acc = Math.min(acc + (now - last), STEP * 4)
    last = now

    for (const p of pieces) {
      if (p.released || now < p.releaseAt) continue
      p.released = true
      p.born = now
      Composite.add(engine.world, p.body)
      Body.setVelocity(p.body, p.kick)
      Body.setAngularVelocity(p.body, p.turn)
    }
    while (acc >= STEP) {
      Engine.update(engine, STEP)
      acc -= STEP
    }

    const sx = scrollX
    const sy = scrollY
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      // a moving target pulls the end of the flight along with it
      if (f.homing?.isConnected) {
        const r = f.homing.getBoundingClientRect()
        f.x = r.left + f.hx * r.width
        f.y = r.top + f.hy * r.height
        f.tx = ((f.x - innerWidth / 2) * DEPTH) / innerHeight
        f.ty = ((f.y - innerHeight / 2) * DEPTH) / innerHeight
      }
      const t = Math.min(1, (now - f.start) / FLIGHT_MS)
      const Z = 1 + (DEPTH - 1) * t
      const X = f.sx + (f.tx - f.sx) * t
      const Y = f.sy + (f.ty - f.sy) * t - 1.3 * 4 * t * (1 - t)
      const fl = innerHeight
      const px = innerWidth / 2 + (X / Z) * fl + sx
      const py = innerHeight / 2 + (Y / Z) * fl + sy
      const d = ((BALL_R * 2 * DEPTH) / Z) | 0
      f.node.style.transform = `translate(${px - d / 2}px, ${py - d / 2}px) rotate(${t * 900 * f.spin}deg)`
      f.node.style.width = f.node.style.height = `${d}px`
      if (t >= 1) {
        flights.splice(i, 1)
        land(f)
      }
    }

    let moving = false
    for (const p of pieces) {
      if (!p.released) continue
      const b = p.body
      if (p.still) {
        if (b.isSleeping) continue
        p.still = false
      }

      // Out of sight, skip the long fall: it reappears just above the bottom of the page and drops
      // the last stretch onto the pile, or, when the pile is on screen, falls in from the top edge
      const top = sy - 80
      const bottom = sy + innerHeight + 120
      const y0 = b.position.y
      if (y0 < top || y0 > bottom) {
        const drop = pageH - rand(260, 420)
        const into = drop > top && drop < bottom ? top : drop
        if (into > y0 + 200 && (into < top || into > bottom || y0 < top)) {
          Body.setPosition(b, { x: b.position.x, y: into })
          Body.setVelocity(b, { x: b.velocity.x * 0.5, y: Math.min(b.velocity.y, 8) })
        }
      }

      // shrinks to a small chip over its first moments of falling
      const target = p.small + (1 - p.small) * Math.max(0, 1 - (now - p.born) / SHRINK_MS)
      if (target < p.scale - 0.002) {
        Body.scale(b, target / p.scale, target / p.scale)
        p.scale = target
      }

      // Knocked back into the page, then drifting forward again as it falls; once it lands it stops
      // tumbling and lies flat
      p.z += p.vz * k
      p.vz = p.vz * Math.pow(0.9, k) - 0.006 * p.z * k
      const resting = b.speed < 0.3
      if (resting) {
        // face up again, so a resting piece shows its cell exactly where its body is
        const flat = (a) => Math.round(a / (Math.PI * 2)) * Math.PI * 2
        p.vrx *= Math.pow(0.8, k)
        p.vry *= Math.pow(0.8, k)
        p.rx += (flat(p.rx) - p.rx) * 0.2 * k
        p.ry += (flat(p.ry) - p.ry) * 0.2 * k
        p.z *= Math.pow(0.9, k)
      } else {
        p.rx += p.vrx * k
        p.ry += p.vry * k
      }
      const { x, y } = b.position
      p.node.style.transform = `translate(${(x - p.origin.x).toFixed(1)}px, ${(y - p.origin.y).toFixed(1)}px) rotate(${(p.base + b.angle).toFixed(3)}rad) scale(${p.scale.toFixed(3)})`
      p.tilt.style.transform = `perspective(${PERSPECTIVE}px) translateZ(${(-p.z).toFixed(1)}px) rotateX(${p.rx.toFixed(3)}rad) rotateY(${p.ry.toFixed(3)}rad)`
      // A piece turned away from the light reads darker
      const shade = 0.72 + 0.28 * Math.abs(Math.cos(p.rx) * Math.cos(p.ry))
      if (Math.abs(shade - p.shade) > 0.02 || (shade > 0.99 && p.shade !== 1)) {
        p.shade = shade > 0.99 ? 1 : shade
        p.face.style.filter = p.shade === 1 ? '' : `brightness(${shade.toFixed(2)})`
      }
      // asleep, flat and full-shrunk: nothing left to draw until something knocks it again
      if (b.isSleeping && p.scale <= p.small + 0.002 && Math.abs(p.z) < 0.5 && p.shade === 1) {
        p.still = true
        p.node.style.willChange = p.tilt.style.willChange = 'auto'
      } else {
        moving = true
      }
    }
    if (pieces.some((p) => !p.released)) moving = true

    for (let i = grit.length - 1; i >= 0; i--) {
      const g = grit[i]
      const age = now - g.born
      if (age > g.life) {
        g.node.remove()
        grit.splice(i, 1)
        continue
      }
      g.vy += 0.35 * k
      g.vx *= Math.pow(0.97, k)
      g.x += g.vx * k
      g.y += g.vy * k
      g.r += g.vx * 4 * k
      g.node.style.transform = `translate(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px) rotate(${g.r.toFixed(0)}deg)`
      g.node.style.opacity = String(1 - age / g.life)
    }

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i]
      const age = now - b.born
      if (age > 4000) {
        Composite.remove(engine.world, b.body)
        b.node.remove()
        balls.splice(i, 1)
        continue
      }
      const { x, y } = b.body.position
      b.node.style.transform = `translate(${x - BALL_R}px, ${y - BALL_R}px) rotate(${b.body.angle}rad)`
      b.node.style.opacity = age > 3400 ? String(1 - (age - 3400) / 600) : ''
    }

    raf = moving || flights.length || grit.length || balls.length ? requestAnimationFrame(frame) : 0
  }

  // A moving target under the pointer, or close enough to it that a quick click on something
  // running past still counts
  const homingNear = (x, y) => {
    const under = document.elementFromPoint(x, y)?.closest?.('[data-break-homing]')
    if (under) return under
    let best = null
    let bestD = HOMING_SLACK
    for (const el of document.querySelectorAll('[data-break-homing]')) {
      const r = el.getBoundingClientRect()
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))
      if (d <= bestD) {
        best = el
        bestD = d
      }
    }
    return best
  }

  placeWalls()
  addEventListener('resize', placeWalls)

  return {
    // Serve from just under the viewer's right hand toward the point on the screen
    fire(x, y) {
      const hitPiece = pieceAt(x + scrollX, y + scrollY)
      const homing = hitPiece ? null : homingNear(x, y)
      const target = hitPiece || homing ? null : pickTarget(x, y)
      const node = document.createElement('div')
      node.className = 'break-ball'
      node.innerHTML = BALL_SVG
      layer.appendChild(node)
      const fl = innerHeight
      const sx = innerWidth * rand(0.08, 0.22)
      const sy = innerHeight * 0.62
      const hr = homing?.getBoundingClientRect()
      flights.push({
        x,
        y,
        target,
        homing,
        hx: hr ? (x - hr.left) / (hr.width || 1) : 0,
        hy: hr ? (y - hr.top) / (hr.height || 1) : 0,
        node,
        start: performance.now(),
        spin: Math.random() < 0.5 ? -1 : 1,
        sx: sx / fl,
        sy: sy / fl,
        tx: ((x - innerWidth / 2) * DEPTH) / fl,
        ty: ((y - innerHeight / 2) * DEPTH) / fl,
      })
      wake()
    },
    destroy() {
      cancelAnimationFrame(raf)
      raf = 0
      removeEventListener('resize', placeWalls)
      for (const el of broken) el.removeAttribute('data-broken')
      Composite.clear(engine.world, false)
      Engine.clear(engine)
      layer.remove()
      window.dispatchEvent(new Event('break:fix'))
    },
  }
}
