import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { canvasTexture, random, lerp } from './util'
import { createCase } from './board'

// A single-storey house on the hill, in metres, with the dining table at the origin and its top at
// y = 0. The front of the house is one open room: kitchen to the west, the table in the middle, and
// a sofa facing the big east window, which looks out over the city. Bedroom, office and bath are
// along the back. No roof: from above it reads as a cutaway; the ceiling shows only from inside.
export const FLOOR = -0.75
const H = 2.6
export const VIEW_WINDOW = { x: 5, z0: -4.4, z1: 0.8, y0: 0.35, y1: 2.45 }

// Walls as [x0, z0, x1, z1, thickness, openings], openings as [from, to, bottom, top, glass] in
// metres along the wall
const WALLS = [
  [-9, -5, 5, -5, 0.2, [[1.2, 3.4, 1.05, 2.15, 1], [5.6, 7.2, 1.05, 2.15, 1]]],
  [5, -5, 5, 6, 0.2, [[0.6, 5.8, VIEW_WINDOW.y0, VIEW_WINDOW.y1, 1], [8.2, 10.2, 0.9, 2.1, 1]]],
  [-9, 6, 5, 6, 0.2, [[4, 6.5, 0.9, 2.1, 1], [10.6, 12.6, 0.9, 2.1, 1]]],
  [-9, -5, -9, 6, 0.2, [[5.2, 6.3, 0, 2.15, 0]]],
  [-9, 1.6, 5, 1.6, 0.12, [[2, 3.2, 0, 2.15, 0], [6.6, 8.6, 0, 2.3, 0]]],
  [-9, 2.8, 5, 2.8, 0.12, [[1.3, 2.1, 0, 2.15, 0], [5.8, 6.6, 0, 2.15, 0], [10, 10.8, 0, 2.15, 0]]],
  [-1, 2.8, -1, 6, 0.12, []],
  [-6, 2.8, -6, 6, 0.12, []],
]

const oakPlanks = (rand) => (g, w, h) => {
  // Wide planks of pale oak, in courses of staggered lengths: 512 px to the metre
  const ROW = 97
  g.fillStyle = '#b9966c'
  g.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += ROW) {
    let x = -rand() * 900
    while (x < w) {
      const len = 620 + rand() * 620
      const l = 63 + rand() * 6
      g.fillStyle = `hsl(${32 + rand() * 4}, ${28 + rand() * 6}%, ${l}%)`
      g.fillRect(x + 1, y + 1, len - 2, ROW - 2)
      // grain running the length of each plank
      g.globalAlpha = 0.07
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = rand() < 0.6 ? '#7a5a3a' : '#e8d3b0'
        g.lineWidth = 0.6 + rand() * 1.4
        g.beginPath()
        const yy = y + 4 + rand() * (ROW - 8)
        g.moveTo(x, yy)
        g.bezierCurveTo(x + len * 0.33, yy + (rand() - 0.5) * 10, x + len * 0.66, yy + (rand() - 0.5) * 10, x + len, yy + (rand() - 0.5) * 6)
        g.stroke()
      }
      // the odd knot
      if (rand() < 0.25) {
        g.globalAlpha = 0.12
        g.fillStyle = '#6b4a2c'
        g.beginPath()
        g.ellipse(x + rand() * len, y + ROW / 2 + (rand() - 0.5) * 40, 6 + rand() * 6, 3 + rand() * 2, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      x += len
    }
  }
}

export function createHouse(ctx) {
  const rand = random(5)
  const root = new THREE.Group()
  const env = ctx.env

  const plaster = new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.92 })
  const floorTex = canvasTexture(2048, oakPlanks(rand))
  floorTex.repeat.set(14 / 4, 11 / 4)
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, envMap: env, envMapIntensity: 0.35 })
  const oak = canvasTexture([1024, 512], (g, w, h) => {
    g.fillStyle = '#c29f74'
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.12
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = rand() < 0.5 ? '#80603e' : '#e2c59a'
      g.lineWidth = 0.8 + rand() * 2
      g.beginPath()
      const y = rand() * h
      g.moveTo(0, y)
      g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 30, w * 0.7, y + (rand() - 0.5) * 30, w, y + (rand() - 0.5) * 20)
      g.stroke()
    }
    g.globalAlpha = 1
  })
  const tableMat = new THREE.MeshStandardMaterial({ map: oak, roughness: 0.42, envMap: env, envMapIntensity: 0.45 })
  const fabric = (hex, roughness = 0.95) => new THREE.MeshStandardMaterial({ color: hex, roughness })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dfe9ee', transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0, envMap: env, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false })
  const frameMat = new THREE.MeshStandardMaterial({ color: '#3a3733', roughness: 0.5 })
  const blackMetal = new THREE.MeshStandardMaterial({ color: '#232323', roughness: 0.45, metalness: 0.6 })
  const box = (w, h, d, mat, x, y, z, ry = 0, round = 0) => {
    const geo = round ? new RoundedBoxGeometry(w, h, d, 3, round) : new THREE.BoxGeometry(w, h, d)
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.rotation.y = ry
    m.castShadow = m.receiveShadow = true
    root.add(m)
    return m
  }
  const cyl = (r, h, mat, x, y, z, seg = 24, r2 = r) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    root.add(m)
    return m
  }

  // Floor, ceiling and walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 11).rotateX(-Math.PI / 2), floorMat)
  floor.position.set(-2, FLOOR, 0.5)
  floor.receiveShadow = true
  root.add(floor)
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 11).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.95 }))
  ceiling.position.set(-2, FLOOR + H, 0.5)
  root.add(ceiling)
  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3.2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(512, (g, w, h) => {
        g.fillStyle = '#c9ccc8'
        g.fillRect(0, 0, w, h)
        for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
          g.fillStyle = `hsl(150, 4%, ${84 + rand() * 4}%)`
          g.fillRect(x + 2, y + 2, 60, 60)
        }
      }, { repeat: 3 }),
      roughness: 0.3,
      envMap: env,
      envMapIntensity: 0.5,
    }),
  )
  tile.position.set(-7.5, FLOOR + 0.003, 4.4)
  root.add(tile)
  for (const [x0, z0, x1, z1, t, openings] of WALLS) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = -Math.atan2(z1 - z0, x1 - x0)
    const at = (s, y, h, w) => {
      const k = s / len
      box(w, h, t, plaster, lerp(x0, x1, k), FLOOR + y + h / 2, lerp(z0, z1, k), ry)
    }
    let s = 0
    for (const [a, b, lo, hi, isGlass] of [...openings].sort((p, q) => p[0] - q[0])) {
      if (a > s) at((s + a) / 2, 0, H, a - s)
      if (lo > 0) at((a + b) / 2, 0, lo, b - a)
      if (hi < H) at((a + b) / 2, hi, H - hi, b - a)
      if (isGlass) {
        const k = (a + b) / 2 / len
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, hi - lo), glass)
        pane.position.set(lerp(x0, x1, k), FLOOR + (lo + hi) / 2, lerp(z0, z1, k))
        pane.rotation.y = ry
        pane.renderOrder = 2
        root.add(pane)
        for (const [w, h, dy, dx] of [[b - a, 0.05, lo, 0], [b - a, 0.05, hi, 0], [0.05, hi - lo, (lo + hi) / 2, -(b - a) / 2], [0.05, hi - lo, (lo + hi) / 2, (b - a) / 2]]) {
          const kk = ((a + b) / 2 + dx) / len
          box(w, h, t + 0.02, frameMat, lerp(x0, x1, kk), FLOOR + dy, lerp(z0, z1, kk), ry)
        }
        // mullions on the big window
        if (b - a > 4) {
          for (const f of [1 / 3, 2 / 3]) {
            const kk = (a + (b - a) * f) / len
            box(0.04, hi - lo, t + 0.02, frameMat, lerp(x0, x1, kk), FLOOR + (lo + hi) / 2, lerp(z0, z1, kk), ry)
          }
        }
      }
      s = b
    }
    if (s < len) at((s + len) / 2, 0, H, len - s)
  }

  // Dining: an oak table with four chairs, a pendant over it
  box(1.6, 0.04, 0.9, tableMat, 0, -0.02, 0, 0, 0.012)
  for (const [x, z] of [[-0.68, -0.34], [0.68, -0.34], [-0.68, 0.34], [0.68, 0.34]]) cyl(0.022, 0.71, tableMat, x, FLOOR + 0.355, z, 12, 0.016)
  const pad = fabric('#d9d1c3')
  for (const [x, z, r] of [[-0.42, -0.66, 0], [0.42, -0.66, 0], [-0.42, 0.66, Math.PI], [0.42, 0.66, Math.PI]]) {
    const back = r ? 0.2 : -0.2
    box(0.46, 0.035, 0.44, tableMat, x, FLOOR + 0.44, z, r, 0.01)
    box(0.42, 0.03, 0.4, pad, x, FLOOR + 0.47, z, r, 0.012)
    box(0.46, 0.2, 0.025, tableMat, x, FLOOR + 0.78, z + back, r, 0.01)
    for (const [dx, dz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) cyl(0.014, 0.44, tableMat, x + dx, FLOOR + 0.22, z + dz, 8)
    for (const dx of [-0.2, 0.2]) cyl(0.012, 0.36, tableMat, x + dx, FLOOR + 0.62, z + back, 8)
  }
  // things that live on the table
  cyl(0.045, 0.1, new THREE.MeshStandardMaterial({ color: '#e9e3d6', roughness: 0.35 }), 0.5, 0.05, -0.18, 28, 0.04)
  box(0.22, 0.026, 0.16, fabric('#4d5f74'), -0.48, 0.013, 0.14, 0.3)
  box(0.2, 0.022, 0.15, fabric('#b8674a'), -0.5, 0.037, 0.12, 0.22)
  cyl(0.13, 0.018, new THREE.MeshStandardMaterial({ color: '#d7cfbf', roughness: 0.6 }), 0.42, 0.009, 0.22, 40)

  // Living: a linen sofa facing the window, a round coffee table on a rug, an armchair, a lamp
  const linen = fabric('#cbc3b5')
  const SX = 1.85
  const SZ = -1.8
  box(0.95, 0.4, 2.6, linen, SX, FLOOR + 0.2, SZ, 0, 0.07)
  box(0.24, 0.48, 2.6, linen, SX - 0.36, FLOOR + 0.62, SZ, 0, 0.09)
  for (const dz of [-1.22, 1.22]) box(0.95, 0.58, 0.2, linen, SX, FLOOR + 0.29, SZ + dz, 0, 0.08)
  for (const dz of [-0.75, 0, 0.75]) box(0.7, 0.14, 0.74, fabric('#d6cfc2'), SX + 0.08, FLOOR + 0.47, SZ + dz, 0, 0.06)
  box(0.14, 0.4, 0.46, fabric('#b8674a'), SX - 0.18, FLOOR + 0.72, SZ - 0.8, 0, 0.06).rotation.z = -0.15
  box(0.14, 0.38, 0.44, fabric('#8a9a7b'), SX - 0.18, FLOOR + 0.71, SZ + 0.85, 0, 0.06).rotation.z = -0.12
  const rugTex = canvasTexture(1024, (g, w, h) => {
    g.fillStyle = '#ddd4c4'
    g.fillRect(0, 0, w, h)
    g.globalAlpha = 0.25
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = rand() < 0.5 ? '#c9bfae' : '#ebe3d5'
      g.fillRect(0, y, w, 1.5)
    }
    g.globalAlpha = 1
    g.strokeStyle = '#a8977f'
    g.lineWidth = 14
    g.strokeRect(40, 40, w - 80, h - 80)
    g.lineWidth = 3
    g.strokeRect(70, 70, w - 140, h - 140)
  })
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }))
  rug.position.set(3.1, FLOOR + 0.004, SZ)
  rug.receiveShadow = true
  root.add(rug)
  cyl(0.48, 0.035, tableMat, 3.2, FLOOR + 0.4, SZ, 48)
  cyl(0.1, 0.38, tableMat, 3.2, FLOOR + 0.19, SZ, 24, 0.16)
  cyl(0.07, 0.12, new THREE.MeshStandardMaterial({ color: '#3f5a4c', roughness: 0.4 }), 3.05, FLOOR + 0.48, SZ + 0.12, 24, 0.05)
  box(0.24, 0.04, 0.18, fabric('#e9e4d8'), 3.35, FLOOR + 0.44, SZ - 0.15, 0.4)
  const boucle = fabric('#8d9a86')
  const arm = new THREE.Group()
  arm.position.set(3.75, FLOOR, -3.95)
  arm.rotation.y = -0.75
  root.add(arm)
  for (const [w, h, d, x, y, z] of [[0.85, 0.42, 0.85, 0, 0.21, 0], [0.85, 0.44, 0.2, 0, 0.62, -0.33], [0.18, 0.56, 0.85, -0.34, 0.28, 0], [0.18, 0.56, 0.85, 0.34, 0.28, 0]]) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.08), boucle)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    arm.add(m)
  }
  const brass = new THREE.MeshStandardMaterial({ color: '#b8915a', metalness: 1, roughness: 0.35, envMap: env })
  cyl(0.012, 1.5, brass, 1.25, FLOOR + 0.75, -3.45, 8)
  cyl(0.16, 0.025, brass, 1.25, FLOOR + 0.012, -3.45, 24)
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f2e6cf', emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0, roughness: 0.8, side: THREE.DoubleSide })
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.26, 32, 1, true), shadeMat)
  lampShade.position.set(1.25, FLOOR + 1.55, -3.45)
  root.add(lampShade)
  // Bookshelf along the north wall
  const shelfX = [-2.7, 0.3]
  const shelfZ = -4.72
  box(shelfX[1] - shelfX[0], 0.03, 0.34, tableMat, (shelfX[0] + shelfX[1]) / 2, FLOOR + 2.1, shelfZ, 0)
  for (let i = 0; i < 6; i++) box(shelfX[1] - shelfX[0], 0.03, 0.34, tableMat, (shelfX[0] + shelfX[1]) / 2, FLOOR + 0.06 + i * 0.4, shelfZ, 0)
  for (let i = 0; i <= 4; i++) box(0.03, 2.1, 0.34, tableMat, shelfX[0] + ((shelfX[1] - shelfX[0]) * i) / 4, FLOOR + 1.05, shelfZ, 0)
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 260)
  const o = new THREE.Object3D()
  const bookTones = ['#7d3b2a', '#29435c', '#c79a4b', '#3d5a45', '#e3ddcf', '#5a4a6b', '#a64d3b', '#2b3036', '#8a9a7b', '#d9c7a4']
  let bi = 0
  for (let shelf = 0; shelf < 5; shelf++) {
    let x = shelfX[0] + 0.04
    while (x < shelfX[1] - 0.06 && bi < 260) {
      // leave the odd gap for a vase or a stack lying flat
      if (rand() < 0.06) {
        x += 0.18 + rand() * 0.2
        continue
      }
      const w = 0.022 + rand() * 0.035
      const h = 0.2 + rand() * 0.12
      o.position.set(x + w / 2, FLOOR + 0.075 + shelf * 0.4 + h / 2, shelfZ + 0.02)
      o.scale.set(w, h, 0.2 + rand() * 0.06)
      o.rotation.set(0, 0, rand() < 0.08 ? 0.18 : 0)
      o.updateMatrix()
      books.setMatrixAt(bi, o.matrix)
      books.setColorAt(bi, new THREE.Color(bookTones[Math.floor(rand() * bookTones.length)]))
      bi++
      x += w + 0.003
    }
  }
  books.count = bi
  books.castShadow = books.receiveShadow = true
  root.add(books)
  // the pendant over the table
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shadeMat)
  pendant.position.set(0, FLOOR + 1.9, 0)
  root.add(pendant)
  cyl(0.004, 0.7, frameMat, 0, FLOOR + 2.25, 0, 6)
  const lamp = new THREE.PointLight('#ffc98a', 0, 7, 1.6)
  lamp.position.set(1.25, FLOOR + 1.5, -3.45)
  const hang = new THREE.PointLight('#ffd29a', 0, 6, 1.6)
  hang.position.set(0, FLOOR + 1.8, 0)
  root.add(lamp, hang)
  // plants by the window
  const leaf = new THREE.MeshStandardMaterial({ color: '#5a8250', roughness: 0.75, side: THREE.DoubleSide })
  const pot = new THREE.MeshStandardMaterial({ color: '#d8ccb8', roughness: 0.7 })
  const leafGeo = new THREE.SphereGeometry(1, 10, 6)
  const plant = (x, z, s) => {
    cyl(0.17 * s, 0.34 * s, pot, x, FLOOR + 0.17 * s, z, 24, 0.13 * s)
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(leafGeo, leaf)
      m.scale.set(0.17 * s, 0.025 * s, 0.07 * s)
      const a = rand() * Math.PI * 2
      const r = (0.05 + rand() * 0.2) * s
      m.position.set(x + Math.cos(a) * r, FLOOR + (0.42 + rand() * 0.75) * s, z + Math.sin(a) * r)
      m.rotation.set(rand() - 0.5, a, 0.3 + rand() * 0.7)
      m.castShadow = true
      root.add(m)
    }
  }
  plant(4.45, -4.45, 1.4)
  plant(4.45, 0.95, 1.1)
  plant(-6.3, 5.5, 1)

  // Kitchen: sage cabinets under a white quartz counter, open oak shelves, an island with stools
  const cab = new THREE.MeshStandardMaterial({ color: '#93a593', roughness: 0.55, envMap: env, envMapIntensity: 0.2 })
  const quartz = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.22, envMap: env, envMapIntensity: 0.55 })
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd3d6', metalness: 1, roughness: 0.28, envMap: env })
  box(4.6, 0.86, 0.62, cab, -6.0, FLOOR + 0.43, -4.62, 0, 0.01)
  box(4.7, 0.04, 0.66, quartz, -6.0, FLOOR + 0.88, -4.6, 0, 0.005)
  const splash = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 0.6),
    new THREE.MeshStandardMaterial({
      map: canvasTexture([1024, 128], (g, w, h) => {
        g.fillStyle = '#d8d6cf'
        g.fillRect(0, 0, w, h)
        for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
          g.fillStyle = `hsl(40, 12%, ${92 + rand() * 4}%)`
          g.fillRect(x + 1.5, y + 1.5, 61, 29)
        }
      }),
      roughness: 0.25,
      envMap: env,
      envMapIntensity: 0.6,
    }),
  )
  splash.position.set(-6.0, FLOOR + 1.2, -4.89)
  root.add(splash)
  for (const y of [1.65, 2.05]) box(2.6, 0.04, 0.3, tableMat, -5.6, FLOOR + y, -4.75)
  for (let i = 0; i < 9; i++) cyl(0.05 + rand() * 0.03, 0.08 + rand() * 0.12, fabric(['#e9e3d6', '#cfc3ad', '#3f5a4c', '#b8674a'][i % 4], 0.5), -6.7 + i * 0.27, FLOOR + 1.72 + (i % 3 === 0 ? 0.4 : 0), -4.75, 20)
  box(0.78, 2.05, 0.68, steel, -8.5, FLOOR + 1.025, -4.6, 0, 0.02)
  box(2.6, 0.88, 1.0, cab, -6.0, FLOOR + 0.44, -2.5, 0, 0.01)
  box(2.7, 0.04, 1.1, quartz, -6.0, FLOOR + 0.9, -2.5, 0, 0.005)
  for (const x of [-6.8, -6.0, -5.2]) {
    cyl(0.18, 0.04, tableMat, x, FLOOR + 0.66, -1.72, 24)
    cyl(0.012, 0.64, blackMetal, x, FLOOR + 0.32, -1.72, 8)
    cyl(0.16, 0.012, blackMetal, x, FLOOR + 0.25, -1.72, 24)
  }
  for (const x of [-6.6, -5.4]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), blackMetal)
    dome.position.set(x, FLOOR + 1.75, -2.5)
    root.add(dome)
    cyl(0.003, 0.85, blackMetal, x, FLOOR + 2.17, -2.5, 6)
  }
  cyl(0.13, 0.18, new THREE.MeshStandardMaterial({ color: '#c96b3c', roughness: 0.6 }), -5.6, FLOOR + 1.01, -2.4, 24, 0.1)

  // Bedroom
  const sheet = fabric('#ece7de')
  box(1.8, 0.32, 2.1, tableMat, 2.5, FLOOR + 0.16, 4.9, 0, 0.02)
  box(1.74, 0.22, 2.0, sheet, 2.5, FLOOR + 0.43, 4.85, 0, 0.06)
  box(1.84, 0.07, 1.25, fabric('#6e7f8d'), 2.5, FLOOR + 0.56, 4.4, 0, 0.03)
  for (const x of [2.06, 2.94]) box(0.68, 0.14, 0.4, sheet, x, FLOOR + 0.61, 5.6, 0, 0.06)
  box(1.9, 1.0, 0.08, tableMat, 2.5, FLOOR + 0.5, 5.9, 0, 0.01)
  for (const x of [1.3, 3.7]) box(0.45, 0.5, 0.4, tableMat, x, FLOOR + 0.25, 5.7, 0, 0.01)
  const bedRug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }))
  bedRug.position.set(2.5, FLOOR + 0.004, 3.7)
  root.add(bedRug)
  box(0.6, 2.0, 1.8, fabric('#e2dbcf', 0.7), -0.66, FLOOR + 1.0, 4.2, 0, 0.01)
  const bedLamp = new THREE.PointLight('#ffc98a', 0, 4, 1.8)
  bedLamp.position.set(3.7, FLOOR + 0.9, 5.7)
  root.add(bedLamp)
  cyl(0.12, 0.2, shadeMat, 3.7, FLOOR + 0.62, 5.7, 24, 0.14)

  // Office
  box(2.2, 0.035, 0.7, tableMat, -3.6, FLOOR + 0.74, 5.55, 0, 0.008)
  for (const x of [-4.6, -2.6]) box(0.035, 0.72, 0.65, blackMetal, x, FLOOR + 0.36, 5.55)
  box(0.62, 0.38, 0.025, new THREE.MeshStandardMaterial({ color: '#111316', roughness: 0.2, emissive: new THREE.Color('#2d4a6b'), emissiveIntensity: 0.5 }), -3.6, FLOOR + 1.02, 5.8, 0, 0.004)
  box(0.5, 0.08, 0.5, fabric('#33383d'), -3.6, FLOOR + 0.48, 5.0, 0, 0.04)
  box(0.5, 0.5, 0.06, fabric('#33383d'), -3.6, FLOOR + 0.8, 4.75, 0, 0.03)
  plant(-1.5, 5.5, 0.8)

  // Bathroom
  const porcelain = new THREE.MeshStandardMaterial({ color: '#f6f5f2', roughness: 0.15, envMap: env, envMapIntensity: 0.6 })
  box(1.6, 0.55, 0.75, porcelain, -8.1, FLOOR + 0.275, 5.5, 0, 0.12)
  box(0.6, 0.85, 0.45, porcelain, -6.5, FLOOR + 0.425, 5.65, 0, 0.05)
  box(0.4, 0.42, 0.6, porcelain, -8.6, FLOOR + 0.21, 3.4, 0, 0.12)

  // Hall runner and a bench by the door
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.8).rotateX(-Math.PI / 2), fabric('#8a6a52'))
  runner.position.set(-3, FLOOR + 0.004, 2.2)
  root.add(runner)
  box(1.2, 0.45, 0.4, tableMat, -8.3, FLOOR + 0.225, -0.5, 0, 0.01)

  // Outside: a deck under the window, the driveway and a car, a fence, hedges and trees. The lawn
  // is the hill's own ground (see land.js).
  const deck = canvasTexture(512, (g, w, h) => {
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = `hsl(28, 22%, ${50 + rand() * 8}%)`
      g.fillRect(0, y, w, 30)
    }
  }, { repeat: 2 })
  box(3.2, 0.12, 6, new THREE.MeshStandardMaterial({ map: deck, roughness: 0.8 }), 6.7, FLOOR - 0.06, -1.6)
  const concrete = new THREE.MeshStandardMaterial({ color: '#bdbab2', roughness: 0.9 })
  box(11, 0.04, 4, concrete, -15, FLOOR - 0.02, 4.3)
  box(1.4, 0.04, 13, concrete, -10.5, FLOOR - 0.02, -5)
  const paint = new THREE.MeshStandardMaterial({ color: '#2f4f6d', metalness: 0.6, roughness: 0.35, envMap: env })
  box(4.5, 0.8, 1.85, paint, -15, FLOOR + 0.6, 4.3, 0, 0.25)
  box(2.6, 0.6, 1.7, new THREE.MeshPhysicalMaterial({ color: '#1b2733', roughness: 0.1, metalness: 0.2, envMap: env }), -15.3, FLOOR + 1.25, 4.3, 0, 0.2)
  for (const [x, z] of [[-13.5, 3.4], [-13.5, 5.2], [-16.6, 3.4], [-16.6, 5.2]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20).rotateX(Math.PI / 2), frameMat)
    w.position.set(x, FLOOR + 0.33, z)
    root.add(w)
  }
  const fence = new THREE.MeshStandardMaterial({ color: '#8a7355', roughness: 0.9 })
  for (const [x0, z0, x1, z1] of [[-25, -22, 16, -22], [-25, 24, 16, 24], [-25, -22, -25, 0], [-25, 9, -25, 24]]) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const ry = -Math.atan2(z1 - z0, x1 - x0)
    box(len, 0.08, 0.06, fence, (x0 + x1) / 2, FLOOR + 1.0, (z0 + z1) / 2, ry)
    box(len, 0.08, 0.06, fence, (x0 + x1) / 2, FLOOR + 0.5, (z0 + z1) / 2, ry)
    for (let s = 0; s <= len; s += 2.5) box(0.1, 1.2, 0.1, fence, lerp(x0, x1, s / len), FLOOR + 0.6, lerp(z0, z1, s / len))
  }
  const hedge = new THREE.MeshStandardMaterial({ color: '#4f7343', roughness: 1 })
  box(0.9, 1.1, 9, hedge, -23.5, FLOOR + 0.55, 15, 0, 0.3)
  box(12, 1.1, 0.9, hedge, 10, FLOOR + 0.55, 22.5, 0, 0.3)
  const crown = new THREE.MeshStandardMaterial({ color: '#5a7f4a', roughness: 0.95 })
  const fir = new THREE.MeshStandardMaterial({ color: '#34573a', roughness: 0.95 })
  const bark = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 })
  for (const [x, z, s, conifer] of [[14, -14, 1.3, 1], [17, 12, 1.1, 0], [-20, -16, 1.4, 1], [-6, 15, 1.2, 0], [9, 17, 0.9, 1], [-18, 16, 1, 0]]) {
    cyl(0.22 * s, 3.4 * s, bark, x, FLOOR + 1.7 * s, z, 8)
    if (conifer) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry((2.2 - i * 0.45) * s, 2.4 * s, 16), fir)
        m.position.set(x, FLOOR + (2.4 + i * 1.25) * s, z)
        m.castShadow = true
        root.add(m)
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + rand() * 0.6) * s, 3), crown)
        m.position.set(x + (rand() - 0.5) * 2.6 * s, FLOOR + (3.5 + rand() * 1.8) * s, z + (rand() - 0.5) * 2.6 * s)
        m.castShadow = true
        root.add(m)
      }
    }
  }

  // The sensors: the hub on the table, others around the rooms and the property
  const SENSORS = [
    { at: [0, 0.032, 0], r: 0, hub: true },
    { at: [4.8, FLOOR + 2.4, -4.8], r: 5.5, dir: Math.PI * 0.75 },
    { at: [-8.8, FLOOR + 2.4, -4.8], r: 5, dir: Math.PI * 0.25 },
    { at: [4.8, FLOOR + 2.4, 5.8], r: 4, dir: -Math.PI * 0.75 },
    { at: [-5.8, FLOOR + 2.4, 5.8], r: 4, dir: -Math.PI * 0.25 },
    { at: [-4, FLOOR + 2.4, 2.2], r: 5, dir: 0, wide: true },
    { at: [-9.2, FLOOR + 2.0, 0.75], r: 8, dir: Math.PI, out: true },
    { at: [-20.5, FLOOR + 1.2, 6.8], r: 9, dir: Math.PI * 0.9, out: true },
    { at: [8.2, FLOOR + 1.0, 1.4], r: 10, dir: 0.1, out: true },
    { at: [12, FLOOR + 1.0, -18], r: 10, dir: 2.2, out: true },
  ]
  // the others are the same case as the hub
  const unit = createCase(ctx.env)
  const model = new THREE.Group().add(unit.base, unit.sleeve, unit.top)
  model.traverse((o) => o.isMesh && (o.castShadow = true))
  const net = new THREE.Group()
  root.add(net)
  // A sensor's reach: a fan that sweeps out from it to the walls, its leading edge brightest
  const fanMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReach: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform float uReach; uniform vec3 uColor; uniform float uPhase; uniform float uSpan; varying vec2 vP;
      void main() {
        float r = length(vP);
        if (r > uReach) discard;
        float a = atan(vP.y, vP.x);
        float head = sin(uTime * 0.7 + uPhase) * uSpan * 0.5;
        float trail = exp(-abs(a - head) * 6.0);
        float front = smoothstep(uReach - 0.08, uReach, r) * (1.0 - step(0.999, uReach));
        float alpha = (0.05 + 0.4 * trail) * (1.0 - smoothstep(0.8, 1.0, r)) + front * 0.8;
        gl_FragColor = vec4(uColor * alpha, 1.0);
      }`,
  })
  const domeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 w = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -w.xyz; gl_Position = projectionMatrix * w; }',
    fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 4.0); gl_FragColor = vec4(uColor * f * 0.12, 1.0); }',
  })
  const fans = []
  const domes = []
  for (const [i, s] of SENSORS.entries()) {
    const [x, y, z] = s.at
    if (!s.hub) {
      const m = model.clone()
      m.position.set(x, y - 0.015, z)
      root.add(m)
    }
    if (s.r) {
      const span = s.wide ? Math.PI * 1.6 : Math.PI * 0.62
      // a fan in the sensor's own frame, scaled to the room it watches
      const geo = new THREE.CircleGeometry(1, 64, -span / 2, span)
      const mat = fanMat.clone()
      mat.uniforms = THREE.UniformsUtils.clone(fanMat.uniforms)
      mat.uniforms.uPhase = { value: i * 1.7 }
      mat.uniforms.uSpan = { value: span }
      const fan = new THREE.Mesh(geo, mat)
      fan.scale.setScalar(s.r)
      fan.position.set(x, s.out ? FLOOR + 0.05 : FLOOR + 0.04, z)
      fan.rotation.set(-Math.PI / 2, 0, s.dir)
      fan.userData.out = !!s.out
      net.add(fan)
      fans.push(fan)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(s.r * 0.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat)
      dome.position.set(x, FLOOR, z)
      dome.userData.out = !!s.out
      net.add(dome)
      domes.push(dome)
    }
  }
  // Connections from each sensor to the hub, drawn out from the sensor, pulses running in
  const linkPos = []
  const linkAlong = []
  for (const s of SENSORS) {
    if (s.hub) continue
    const [x, y, z] = s.at
    const steps = 24
    for (let k = 0; k < steps; k++) {
      for (const kk of [k, k + 1]) {
        const t = kk / steps
        linkPos.push(lerp(x, 0, t), lerp(y, 0.04, t) + Math.sin(t * Math.PI) * 0.8, lerp(z, 0, t))
        linkAlong.push(t)
      }
    }
  }
  const linkGeo = new THREE.BufferGeometry()
  linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkPos, 3))
  linkGeo.setAttribute('aAlong', new THREE.Float32BufferAttribute(linkAlong, 1))
  const linkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReach: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: 'attribute float aAlong; varying float vA; void main() { vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; uniform float uReach; uniform vec3 uColor; varying float vA; void main() { if (vA > uReach) discard; float p = fract(vA - uTime * 0.4); float pulse = smoothstep(0.0, 0.05, p) * (1.0 - smoothstep(0.05, 0.2, p)); float head = smoothstep(0.06, 0.0, uReach - vA) * (1.0 - step(0.999, uReach)); gl_FragColor = vec4(uColor * (0.2 + 1.6 * pulse + 2.0 * head), 1.0); }',
  })
  const links = new THREE.LineSegments(linkGeo, linkMat)
  net.add(links)
  // The property's edge: a ring spreading out to it, with a slow wave going round
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vP; void main() { float r = length(vP); float edge = smoothstep(0.985, 0.995, r) * (1.0 - smoothstep(0.995, 1.0, r)); float wave = smoothstep(0.03, 0.0, abs(r - fract(uTime * 0.12))) * 0.3 * (1.0 - r); gl_FragColor = vec4(uColor * (edge * 1.2 + wave + 0.03 * (1.0 - r)), 1.0); }',
  })
  const ring = new THREE.Mesh(new THREE.CircleGeometry(30, 128), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.set(-2, FLOOR + 0.06, 1)
  net.add(ring)

  // fields: rooms watched, links: lines to the hub, wide: the property, each how far it has
  // reached; warm: the lamps; sink: the house going down into the ground as the model replaces it
  const update = ({ fields, linked, wide, warm, sink, time, signal }) => {
    const t = time / 1000
    for (const f of fans) {
      const reach = f.userData.out ? wide : fields
      f.material.uniforms.uTime.value = t
      f.material.uniforms.uReach.value = reach
      f.material.uniforms.uColor.value.copy(signal)
      f.visible = reach > 0.001
    }
    for (const d of domes) {
      const reach = d.userData.out ? wide : fields
      d.scale.setScalar(Math.max(reach, 1e-3))
      d.visible = reach > 0.001
    }
    domeMat.uniforms.uColor.value.copy(signal)
    linkMat.uniforms.uTime.value = t
    linkMat.uniforms.uReach.value = linked
    linkMat.uniforms.uColor.value.copy(signal)
    links.visible = linked > 0.001
    ringMat.uniforms.uTime.value = t
    ringMat.uniforms.uColor.value.copy(signal)
    ring.scale.setScalar(Math.max(wide, 1e-3))
    ring.visible = wide > 0.001
    unit.light.color.copy(signal).multiplyScalar(0.8 + 2.4 * Math.max(fields, linked))
    shadeMat.emissiveIntensity = 1.6 * warm
    lamp.intensity = 3 * warm
    hang.intensity = 2.4 * warm
    bedLamp.intensity = 1.5 * warm
    root.position.y = -9 * sink
    root.visible = sink < 0.999
  }
  return { root, update }
}
