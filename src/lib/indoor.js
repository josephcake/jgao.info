// A two-floor building as a walkable grid: one cell a metre square, walls on the edges between
// cells, doors as gaps in them, and the stairs and the elevator joining the floors. Routes run from a
// room to the front door with A* and are then pulled straight wherever the way is clear.

export const W = 24
export const H = 16
export const SPEED = 1.3
export const CLICKABLE = new Set(['room', 'open'])
// The vertical step of each way down: what it costs the search, in metres of walking, and the time
// it takes, in seconds, the wait for the elevator included
export const VERTICAL = { stairs: { cost: 12, time: 18, at: [6, 2] }, elevator: { cost: 18, time: 34, at: [19, 3] } }
export const EXIT = { floor: 0, cells: [[16, 15], [17, 15]], at: [17, 16] }

const core = (n) => [
  { id: `${n}01`, name: `Room ${n}01`, kind: 'room', r: [0, 0, 5, 6] },
  { id: 'stairs', name: 'Stairs', kind: 'stairs', r: [5, 0, 3, 6] },
  { id: `${n}02`, name: `Room ${n}02`, kind: 'room', r: [8, 0, 5, 6] },
  { id: `${n}03`, name: `Room ${n}03`, kind: 'room', r: [13, 0, 5, 6] },
  { id: 'utility', name: 'Utility', kind: 'service', r: [18, 0, 3, 2] },
  { id: 'elevator', name: 'Elevator', kind: 'elevator', r: [18, 2, 3, 4] },
  { id: `${n}04`, name: `Room ${n}04`, kind: 'room', r: [21, 0, 3, 6] },
  { id: 'hall', name: 'Hallway', kind: 'hall', r: [0, 6, 24, 2] },
]
const coreDoors = [[2, 5, 's'], [6, 5, 's'], [10, 5, 's'], [15, 5, 's'], [19, 5, 's'], [22, 5, 's'], [17, 1, 'e']]

const PLANS = [
  {
    name: 'Floor 1',
    areas: [
      ...core(1),
      { id: 'cafe', name: 'Cafeteria', kind: 'open', r: [0, 8, 10, 8] },
      { id: 'lobby', name: 'Lobby', kind: 'lobby', r: [10, 8, 14, 8] },
    ],
    open: [['hall', 'lobby'], ['cafe', 'lobby']],
    doors: [...coreDoors, [4, 7, 's'], [5, 7, 's']],
    // Cafeteria tables, the reception desk and a bench
    furniture: [[2, 10, 2, 1], [6, 10, 2, 1], [2, 13, 2, 1], [6, 13, 2, 1], [13, 10, 4, 1], [21, 11, 1, 3]],
  },
  {
    name: 'Floor 2',
    areas: [
      ...core(2),
      { id: '205', name: 'Room 205', kind: 'room', r: [0, 8, 5, 8] },
      { id: '206', name: 'Room 206', kind: 'room', r: [5, 8, 5, 8] },
      { id: 'lounge', name: 'Lounge', kind: 'open', r: [10, 8, 6, 8] },
      { id: '207', name: 'Room 207', kind: 'room', r: [16, 8, 4, 8] },
      { id: '208', name: 'Room 208', kind: 'room', r: [20, 8, 4, 8] },
    ],
    open: [['hall', 'lounge']],
    doors: [...coreDoors, [2, 7, 's'], [7, 7, 's'], [17, 7, 's'], [22, 7, 's']],
    // Two sofas in the lounge
    furniture: [[11, 11, 1, 3], [14, 11, 1, 3]],
  },
]

// Each floor's cells: which area each is in, what stands on it, and where the walls are
export const FLOORS = PLANS.map((plan) => {
  const area = new Int16Array(W * H).fill(-1)
  plan.areas.forEach((a, k) => {
    const [x0, y0, w, h] = a.r
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) area[y * W + x] = k
  })
  const block = new Uint8Array(W * H)
  for (const [x0, y0, w, h] of plan.furniture) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) block[y * W + x] = 1
  }
  const index = Object.fromEntries(plan.areas.map((a, k) => [a.id, k]))
  const open = new Set(plan.open.flatMap(([a, b]) => [`${index[a]}:${index[b]}`, `${index[b]}:${index[a]}`]))
  // Doors keyed by the cell on their west or north side and the way through
  const doors = new Set(
    plan.doors.map(([x, y, d]) => (d === 'n' ? `${x},${y - 1},s` : d === 'w' ? `${x - 1},${y},e` : `${x},${y},${d}`)),
  )
  const wallBetween = (a, b, key) => {
    const ka = area[a]
    const kb = area[b]
    if (ka < 0 || kb < 0) return true
    if (ka === kb || open.has(`${ka}:${kb}`)) return false
    return !doors.has(key)
  }
  const wallE = new Uint8Array(W * H)
  const wallS = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (x < W - 1) wallE[i] = wallBetween(i, i + 1, `${x},${y},e`) ? 1 : 0
      if (y < H - 1) wallS[i] = wallBetween(i, i + W, `${x},${y},s`) ? 1 : 0
    }
  }
  // The walls to draw, as runs along the grid lines: inside ones where areas part without a door,
  // and the outside, broken for the front door
  const exits = plan === PLANS[0] ? new Set(EXIT.cells.map(([x, y]) => `${x},${y}`)) : new Set()
  const h = []
  const v = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (area[i] < 0) continue
      if (y === 0) h.push([0, x])
      if (x === 0) v.push([0, y])
      if (y === H - 1 && !exits.has(`${x},${y}`)) h.push([H, x])
      if (x === W - 1) v.push([W, y])
      if (x < W - 1 && wallE[i]) v.push([x + 1, y])
      if (y < H - 1 && wallS[i]) h.push([y + 1, x])
    }
  }
  const runs = (list, horizontal) => {
    const out = []
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    for (const [line, at] of list) {
      const prev = out[out.length - 1]
      if (prev && prev.line === line && prev.to === at) prev.to = at + 1
      else out.push({ line, from: at, to: at + 1, horizontal })
    }
    return out.map((r) => (r.horizontal ? [r.from, r.line, r.to, r.line] : [r.line, r.from, r.line, r.to]))
  }
  const walls = [...runs(h, true), ...runs(v, false)]
  return { ...plan, area, block, wallE, wallS, walls }
})

export const areaAt = (f, x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return -1
  return FLOORS[f].area[Math.floor(y) * W + Math.floor(x)]
}

// One step between neighbouring cells, straight or diagonal; a diagonal needs both of the straight
// ways round its corner to be clear, so it never cuts a wall's end
const free = (F, i) => F.area[i] >= 0 && !F.block[i]
const straight = (F, x, y, dx, dy) => {
  const nx = x + dx
  const ny = y + dy
  if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false
  const i = y * W + x
  const n = ny * W + nx
  if (!free(F, n)) return false
  if (dx === 1) return !F.wallE[i]
  if (dx === -1) return !F.wallE[n]
  if (dy === 1) return !F.wallS[i]
  return !F.wallS[n]
}
const step = (F, x, y, dx, dy) => {
  if (!dx || !dy) return straight(F, x, y, dx, dy)
  return straight(F, x, y, dx, 0) && straight(F, x + dx, y, 0, dy) && straight(F, x, y, 0, dy) && straight(F, x, y + dy, dx, 0)
}

// Whether a straight walk from a to b stays clear, with some room either side of it
const clear = (F, a, b) => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return true
  const nx = (-dy / len) * 0.3
  const ny = (dx / len) * 0.3
  const n = Math.ceil(len / 0.05)
  for (const o of [0, 1, -1]) {
    let cx = Math.floor(a[0] + nx * o)
    let cy = Math.floor(a[1] + ny * o)
    if (!free(F, cy * W + cx)) return false
    for (let s = 1; s <= n; s++) {
      const t = s / n
      const x = Math.floor(a[0] + dx * t + nx * o)
      const y = Math.floor(a[1] + dy * t + ny * o)
      if (x === cx && y === cy) continue
      if (Math.abs(x - cx) > 1 || Math.abs(y - cy) > 1 || !step(F, cx, cy, x - cx, y - cy)) return false
      cx = x
      cy = y
    }
  }
  return true
}

const centre = (a) => [a.r[0] + a.r[2] / 2, a.r[1] + a.r[3] / 2]

// The start of a route: the free cell nearest the middle of the area
const startCell = (f, k) => {
  const F = FLOORS[f]
  const [mx, my] = centre(F.areas[k])
  let best = null
  for (let i = 0; i < W * H; i++) {
    if (F.area[i] !== k || F.block[i]) continue
    const d = Math.hypot((i % W) + 0.5 - mx, Math.floor(i / W) + 0.5 - my)
    if (!best || d < best.d) best = { i, d }
  }
  return best.i
}

export function route(f0, k, mode) {
  const t0 = performance.now()
  const N = W * H
  const g = new Float32Array(2 * N).fill(Infinity)
  const came = new Int32Array(2 * N).fill(-1)
  const done = new Uint8Array(2 * N)
  const link = VERTICAL[mode]
  const linkCell = link.at[1] * W + link.at[0]
  const goals = new Set(EXIT.cells.map(([x, y]) => y * W + x))
  const h = (node) => {
    const i = node % N
    const d = Math.hypot((i % W) + 0.5 - EXIT.at[0], Math.floor(i / W) + 0.5 - EXIT.at[1])
    return d + (node >= N ? link.cost : 0)
  }
  // A binary heap of [priority, node]
  const heap = []
  const push = (p, n) => {
    heap.push([p, n])
    let c = heap.length - 1
    while (c > 0) {
      const up = (c - 1) >> 1
      if (heap[up][0] <= heap[c][0]) break
      ;[heap[up], heap[c]] = [heap[c], heap[up]]
      c = up
    }
  }
  const pop = () => {
    const top = heap[0]
    const end = heap.pop()
    if (heap.length) {
      heap[0] = end
      let c = 0
      for (;;) {
        const l = 2 * c + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const start = f0 * N + startCell(f0, k)
  g[start] = 0
  push(h(start), start)
  let explored = 0
  let end = -1
  while (heap.length) {
    const [, node] = pop()
    if (done[node]) continue
    done[node] = 1
    explored++
    const f = node >= N ? 1 : 0
    const i = node % N
    if (f === EXIT.floor && goals.has(i)) {
      end = node
      break
    }
    const x = i % W
    const y = Math.floor(i / W)
    const F = FLOORS[f]
    const relax = (next, cost) => {
      const ng = g[node] + cost
      if (ng < g[next]) {
        g[next] = ng
        came[next] = node
        push(ng + h(next), next)
      }
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && step(F, x, y, dx, dy)) relax(f * N + (y + dy) * W + x + dx, dx && dy ? Math.SQRT2 : 1)
      }
    }
    if (i === linkCell) relax((1 - f) * N + i, link.cost)
  }
  const ms = performance.now() - t0
  if (end < 0) return null

  // Back from the door, split where the route changes floor, each part pulled straight
  const chain = []
  for (let n = end; n >= 0; n = came[n]) chain.push(n)
  chain.reverse()
  const legs = []
  for (const n of chain) {
    const f = n >= N ? 1 : 0
    const i = n % N
    const p = [(i % W) + 0.5, Math.floor(i / W) + 0.5]
    if (!legs.length || legs[legs.length - 1].f !== f) legs.push({ f, cells: [] })
    legs[legs.length - 1].cells.push(p)
  }
  for (const leg of legs) {
    const F = FLOORS[leg.f]
    const pts = [leg.cells[0]]
    let a = 0
    while (a < leg.cells.length - 1) {
      let b = leg.cells.length - 1
      while (b > a + 1 && !clear(F, leg.cells[a], leg.cells[b])) b--
      pts.push(leg.cells[b])
      a = b
    }
    leg.pts = pts
  }
  legs[legs.length - 1].pts.push([EXIT.at[0], EXIT.at[1]])
  return { legs, explored, ms, mode, from: FLOORS[f0].areas[k], floor: f0 }
}

const heading = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north')
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1)

// Turn-by-turn steps: the route walked in quarter metres, cut where it passes from one area into the
// next, with the stairs or the elevator as one step between floors
export function directions(r) {
  const steps = []
  let walked = 0
  r.legs.forEach((leg, li) => {
    const F = FLOORS[leg.f]
    const runs = []
    for (let s = 0; s < leg.pts.length - 1; s++) {
      const [ax, ay] = leg.pts[s]
      const [bx, by] = leg.pts[s + 1]
      const len = Math.hypot(bx - ax, by - ay)
      const n = Math.max(1, Math.ceil(len / 0.25))
      for (let t = 0; t < n; t++) {
        const x = ax + ((bx - ax) * (t + 0.5)) / n
        const y = ay + ((by - ay) * (t + 0.5)) / n
        const k = Math.max(0, areaAt(leg.f, Math.min(x, W - 0.01), Math.min(y, H - 0.01)))
        const run = runs[runs.length - 1]
        if (run && run.k === k) {
          run.d += len / n
          run.to = [x, y]
        } else runs.push({ k, d: len / n, from: [x, y], to: [x, y] })
      }
    }
    // A door's width of another area is part of the walk on either side of it
    const merged = []
    for (const run of runs) {
      const prev = merged[merged.length - 1]
      if (prev && (run.d < 0.9 || prev.k === run.k)) {
        prev.d += run.d
        prev.to = run.to
      } else merged.push({ ...run })
    }
    for (const [ri, run] of merged.entries()) {
      walked += run.d
      const a = F.areas[run.k]
      if (a.kind === 'stairs' || a.kind === 'elevator') continue
      const d = Math.max(1, Math.round(run.d))
      const dir = heading(run.to[0] - run.from[0], run.to[1] - run.from[1])
      let text
      if (li === 0 && ri === 0) text = `Leave ${a.name.startsWith('Room') ? a.name : `the ${lower(a.name)}`}`
      else if (a.kind === 'hall') text = `Walk ${dir} along the hallway`
      else if (a.kind === 'lobby') text = 'Cross the lobby to the front door'
      else text = `Go ${dir} through the ${lower(a.name)}`
      steps.push({ text, d })
    }
    if (li < r.legs.length - 1) {
      steps.push({ text: r.mode === 'stairs' ? 'Take the stairs down to floor 1' : 'Take the elevator down to floor 1', d: 0, vertical: true })
    }
  })
  steps.push({ text: 'Out the front door', d: 0, end: true })
  const changes = r.legs.length - 1
  const seconds = walked / SPEED + changes * VERTICAL[r.mode].time
  return { steps, metres: Math.round(walked), seconds: Math.round(seconds), changes }
}
