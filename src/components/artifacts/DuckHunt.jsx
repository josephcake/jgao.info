import { useRef } from 'react'
import useFrame from './useFrame'

const COLS = 19
const ROWS = 10
const CELL = 9
const GX = 9.5
const GY = 26
const START = 4 * COLS + 1
const DUCK = 5 * COLS + 17
const VISIT_MS = 16
const PATH_MS = 32
const HOLD_MS = 1600

const WALLS = new Set()
const wall = (col, from, to) => {
  for (let row = from; row <= to; row++) WALLS.add(row * COLS + col)
}
wall(5, 0, 6)
wall(10, 3, 9)
wall(14, 0, 5)
wall(14, 8, 9)

const neighbors = (i) => {
  const row = Math.floor(i / COLS)
  const col = i % COLS
  const out = []
  if (row > 0) out.push(i - COLS)
  if (col < COLS - 1) out.push(i + 1)
  if (row < ROWS - 1) out.push(i + COLS)
  if (col > 0) out.push(i - 1)
  return out.filter((n) => !WALLS.has(n))
}

const trace = (parent, end) => {
  const path = []
  for (let c = end; c !== -1; c = parent.get(c)) path.unshift(c)
  return path
}

function breadthFirst() {
  const parent = new Map([[START, -1]])
  const order = []
  const queue = [START]
  while (queue.length) {
    const c = queue.shift()
    order.push(c)
    if (c === DUCK) break
    for (const n of neighbors(c)) {
      if (!parent.has(n)) {
        parent.set(n, c)
        queue.push(n)
      }
    }
  }
  return { order, path: trace(parent, DUCK) }
}

function depthFirst() {
  const parent = new Map([[START, -1]])
  const seen = new Set()
  const order = []
  const stack = [START]
  while (stack.length) {
    const c = stack.pop()
    if (seen.has(c)) continue
    seen.add(c)
    order.push(c)
    if (c === DUCK) break
    for (const n of neighbors(c).reverse()) {
      if (!seen.has(n)) {
        parent.set(n, c)
        stack.push(n)
      }
    }
  }
  return { order, path: trace(parent, DUCK) }
}

function bidirectional() {
  const sides = [
    { parent: new Map([[START, -1]]), queue: [START] },
    { parent: new Map([[DUCK, -1]]), queue: [DUCK] },
  ]
  const order = []
  for (let turn = 0; sides[0].queue.length && sides[1].queue.length; turn ^= 1) {
    const side = sides[turn]
    const other = sides[turn ^ 1]
    const c = side.queue.shift()
    order.push(c)
    for (const n of neighbors(c)) {
      if (side.parent.has(n)) continue
      side.parent.set(n, c)
      if (other.parent.has(n)) {
        const fromStart = trace(sides[0].parent, n)
        const fromDuck = trace(sides[1].parent, n).reverse().slice(1)
        return { order, path: [...fromStart, ...fromDuck] }
      }
      side.queue.push(n)
    }
  }
  return { order, path: [] }
}

const RUNS = [
  { name: 'Breadth-first search', ...breadthFirst() },
  { name: 'Depth-first search', ...depthFirst() },
  { name: 'Bidirectional search', ...bidirectional() },
].map((run) => ({ ...run, ms: run.order.length * VISIT_MS + run.path.length * PATH_MS + HOLD_MS }))
const CYCLE_MS = RUNS.reduce((sum, run) => sum + run.ms, 0)

const cellClass = (i, visited, onPath) =>
  `duck__cell${WALLS.has(i) ? ' is-wall' : onPath.has(i) ? ' is-path' : visited.has(i) ? ' is-visited' : ''}`

const solved = new Set(RUNS[0].path)
const explored = new Set(RUNS[0].order)

const center = (i) => [GX + (i % COLS) * CELL + CELL / 2, GY + Math.floor(i / COLS) * CELL + CELL / 2]
const [ax, ay] = center(START)
const [dx, dy] = center(DUCK)

export default function DuckHunt({ drawn }) {
  const cellsRef = useRef([])
  const labelRef = useRef(null)
  const countRef = useRef(null)
  const lastRef = useRef('')

  useFrame(drawn, (t) => {
    let at = t % CYCLE_MS
    let run = RUNS[0]
    for (run of RUNS) {
      if (at < run.ms) break
      at -= run.ms
    }
    const visits = Math.min(run.order.length, Math.floor(at / VISIT_MS))
    const steps = visits < run.order.length ? 0 : Math.min(run.path.length, Math.floor((at - visits * VISIT_MS) / PATH_MS))
    const key = `${run.name}:${visits}:${steps}`
    if (key === lastRef.current) return
    lastRef.current = key

    const visited = new Set(run.order.slice(0, visits))
    const onPath = new Set(run.path.slice(0, steps))
    cellsRef.current.forEach((el, i) => el.setAttribute('class', cellClass(i, visited, onPath)))
    labelRef.current.textContent = run.name
    countRef.current.textContent = steps === run.path.length ? `Found in ${visits}` : `${visits} visited`
  })

  return (
    <g>
      {Array.from({ length: COLS * ROWS }, (_, i) => (
        <rect
          key={i}
          ref={(el) => (cellsRef.current[i] = el)}
          className={cellClass(i, explored, solved)}
          x={GX + (i % COLS) * CELL + 0.5}
          y={GY + Math.floor(i / COLS) * CELL + 0.5}
          width={CELL - 1}
          height={CELL - 1}
          rx="1"
        />
      ))}
      <path className="duck__arrow" d={`M${ax - 3} ${ay - 3} L${ax + 3.5} ${ay} L${ax - 3} ${ay + 3} Z`} />
      <g className="duck__duck">
        <ellipse cx={dx - 0.5} cy={dy + 1} rx="3.6" ry="2.5" />
        <circle cx={dx + 2} cy={dy - 1.8} r="1.9" />
        <path className="duck__beak" d={`M${dx + 3.6} ${dy - 2.2} L${dx + 5.4} ${dy - 1.6} L${dx + 3.6} ${dy - 1}`} />
      </g>
      <text ref={labelRef} className="art-label duck__label" x={GX} y="128">{RUNS[0].name}</text>
      <text ref={countRef} className="art-label duck__label" x={GX + COLS * CELL} y="128" textAnchor="end">
        Found in {RUNS[0].order.length}
      </text>
    </g>
  )
}
