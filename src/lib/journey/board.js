import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { random, smooth, lerp } from './util'

// The device, in metres, built around its main board: a socket of spring contacts with the
// processor above it, the parts around them, and a radar board at the front with its antennas.
// It sits in a group whose origin is the middle of its base; the shells, boards and cover each
// have a resting height and an exploded one.
// The case: 124 mm across, a squircle in plan, 34.6 mm tall
export const DEV = { half: 0.062, h: 0.0346 }
export const BOARD = 0.096
export const YB = 0.0136
export const SOCKET = { x: -0.016, z: -0.004, size: 0.026, pitch: 0.0004, n: 60, floor: 0, pin: 0.00048 }
export const SENSOR = { x: 0.012, z: 0.031 }
export const FRAME = { w: SOCKET.size + 0.004, wall: 0.002, h: 0.0009 }
// A run along the socket's near side kept clear of parts
const LEADS = { edge: SOCKET.x - FRAME.w / 2, z: SOCKET.z, half: 0.006 }
const inLanes = (x, z, pad = 0) => x < LEADS.edge + pad && Math.abs(z - LEADS.z) < LEADS.half + pad

const pcbTexture = (rand, parts) => {
  const S = 2048
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const px = (m) => ((m + BOARD / 2) / BOARD) * S
  g.fillStyle = '#0f2a20'
  g.fillRect(0, 0, S, S)
  // copper under the mask: routed in straight runs and 45° turns, around the lane the fibres become
  g.strokeStyle = '#1c4636'
  g.lineCap = 'round'
  for (let i = 0; i < 520; i++) {
    let x = rand() * S
    let y = rand() * S
    if (inLanes(x / S * BOARD - BOARD / 2, y / S * BOARD - BOARD / 2, 0.004)) continue
    g.lineWidth = 2 + rand() * 5
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 4; k++) {
      const len = 30 + rand() * 260
      const dir = Math.floor(rand() * 8) * (Math.PI / 4)
      x += Math.cos(dir) * len
      y += Math.sin(dir) * len
      g.lineTo(x, y)
    }
    g.stroke()
  }
  // vias
  g.fillStyle = '#b48a4a'
  for (let i = 0; i < 900; i++) {
    const x = rand() * S
    const y = rand() * S
    if (inLanes(x / S * BOARD - BOARD / 2, y / S * BOARD - BOARD / 2, 0.002)) continue
    g.beginPath()
    g.arc(x, y, 3.5, 0, Math.PI * 2)
    g.fill()
  }
  // pads and silkscreen outlines around every part
  g.font = '600 22px "Bricolage Grotesque", sans-serif'
  parts.forEach((p, i) => {
    const x0 = px(p.x - p.w / 2) - 6
    const y0 = px(p.z - p.d / 2) - 6
    const w = (p.w / BOARD) * S + 12
    const h = (p.d / BOARD) * S + 12
    g.strokeStyle = 'rgba(235,238,230,0.75)'
    g.lineWidth = 2
    g.strokeRect(x0, y0, w, h)
    g.fillStyle = 'rgba(235,238,230,0.8)'
    if (p.label) g.fillText(p.label + (i + 1), x0, y0 - 6)
    g.fillStyle = '#c9a25e'
    if (p.pads) {
      for (let k = 0; k < p.pads; k++) {
        g.fillRect(x0 + 4 + (k * (w - 12)) / p.pads, y0 - 4, (w - 12) / p.pads - 3, 6)
        g.fillRect(x0 + 4 + (k * (w - 12)) / p.pads, y0 + h - 2, (w - 12) / p.pads - 3, 6)
      }
    }
  })
  // the socket's body, dark plastic with a pad under each contact
  const fw = (FRAME.w / BOARD) * S
  g.fillStyle = '#1d2024'
  g.fillRect(px(SOCKET.x) - fw / 2, px(SOCKET.z) - fw / 2, fw, fw)
  g.fillStyle = '#6e5a32'
  const pad = (0.00018 / BOARD) * S
  for (let i = 0; i < SOCKET.n; i++) {
    for (let j = 0; j < SOCKET.n; j++) {
      const x = px(SOCKET.x + (i - (SOCKET.n - 1) / 2) * SOCKET.pitch)
      const z = px(SOCKET.z + (j - (SOCKET.n - 1) / 2) * SOCKET.pitch - 0.00005)
      g.fillRect(x - pad / 2, z - pad * 0.7, pad, pad * 1.4)
    }
  }
  g.fillStyle = 'rgba(235,238,230,0.85)'
  g.font = '700 46px "Bricolage Grotesque", sans-serif'
  g.fillText('JGAO  SENSE-1  REV C', px(-0.04), px(0.044))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

// Soft contact shadows under everything that stands on the board, for the board's own surface
const aoTexture = (shapes) => {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  const px = (m) => ((m + BOARD / 2) / BOARD) * S
  const k = S / BOARD
  for (const { x, z, w, d, r = 0.0012, a = 0.5 } of shapes) {
    for (let i = 6; i >= 0; i--) {
      const grow = (r * k * i) / 6
      g.fillStyle = `rgba(0,0,0,${(a / 7) * (1 - i / 7) * 1.6})`
      g.fillRect(px(x - w / 2) - grow, px(z - d / 2) - grow, w * k + grow * 2, d * k + grow * 2)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

// The radar laminate: off-white RF substrate, a transmit array and a receive array of series-fed
// gold patches with their feed lines back to the chip, and its silkscreen
const radarTextures = () => {
  const W = 1024
  const H = Math.round((W * 26) / 56)
  const make = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return [c, c.getContext('2d')]
  }
  const [mc, m] = make()
  const [kc, k] = make()
  const [rc, r] = make()
  const rr = random(9)
  const px = (x) => ((x + 0.028) / 0.056) * W
  const pz = (z) => ((z + 0.013) / 0.026) * H
  m.fillStyle = '#e6dfca'
  m.fillRect(0, 0, W, H)
  // the laminate's woven glass, faintly
  for (let i = 0; i < 2600; i++) {
    m.fillStyle = `rgba(120,105,70,${rr() * 0.05})`
    m.fillRect(rr() * W, rr() * H, 2 + rr() * 6, 1)
  }
  k.fillStyle = '#000'
  k.fillRect(0, 0, W, H)
  r.fillStyle = '#d0d0d0'
  r.fillRect(0, 0, W, H)
  const gold = (draw) => {
    for (const [g, col] of [[m, '#d4a94f'], [k, '#fff'], [r, '#3a3a3a']]) {
      g.fillStyle = col
      g.strokeStyle = col
      draw(g)
    }
  }
  const P = 0.0019
  const columns = [
    ...[0, 1, 2].map((i) => ({ x: -0.006 + i * 0.0052, z0: -0.0105, n: 4 })),
    ...[0, 1, 2, 3].map((i) => ({ x: 0.0105 + i * 0.0041, z0: -0.0105, n: 5 })),
  ]
  gold((g) => {
    g.lineWidth = 3
    for (const { x, z0, n } of columns) {
      g.beginPath()
      g.moveTo(px(x), pz(z0))
      g.lineTo(px(x), pz(z0 + (n - 1) * 0.0042 + P / 2))
      g.stroke()
      for (let j = 0; j < n; j++) {
        const z = z0 + j * 0.0042
        g.fillRect(px(x - P / 2), pz(z), (P / 0.056) * W, (P / 0.026) * H * 0.82)
      }
      // feed line back toward the chip, in two straight runs
      g.lineWidth = 2.4
      g.beginPath()
      g.moveTo(px(x), pz(z0))
      g.lineTo(px(x), pz(-0.0118))
      g.lineTo(px(-0.0118), pz(-0.0118 + (x + 0.006) * 0.12))
      g.stroke()
      g.lineWidth = 3
    }
    // the chip's ball pads, seen around its edge, and a ground ring
    g.lineWidth = 4
    g.strokeRect(px(-0.0195), pz(-0.004), (0.008 / 0.056) * W, (0.008 / 0.026) * H)
    for (let i = 0; i < 40; i++) g.fillRect(px(-0.027 + (i % 2) * 0.0012), pz(-0.0115 + i * 0.00058), 6, 6)
  })
  m.fillStyle = 'rgba(70,74,80,0.85)'
  m.font = '600 18px "Bricolage Grotesque", sans-serif'
  m.fillText('TX', px(-0.0062), pz(0.0115))
  m.fillText('RX', px(0.0102), pz(0.0115))
  m.fillText('60 GHz  JGAO-R2', px(-0.027), pz(0.0118))
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 16
    return t
  }
  return { map: tex(mc, true), metal: tex(kc), rough: tex(rc) }
}

// A squircle in plan (a superellipse), the shape of the whole case
const squircle = (half, n = 4.6, seg = 160) => {
  const s = new THREE.Shape()
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2
    const c = Math.cos(t)
    const n2 = Math.sin(t)
    const x = half * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = half * Math.sign(n2) * Math.abs(n2) ** (2 / n)
    if (i) s.lineTo(x, y)
    else s.moveTo(x, y)
  }
  s.closePath()
  return s
}
// A squircle slab from y0 to y0 + h with rounded edges, hollow if it has a wall
const slab = (half, y0, h, bevel, wall = 0) => {
  const shape = squircle(half - bevel)
  if (wall) shape.holes.push(squircle(half - wall + bevel))
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(h - 2 * bevel, 1e-6), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: 1 })
  g.rotateX(-Math.PI / 2).translate(0, y0 + bevel, 0)
  return toCreasedNormals(g, Math.PI / 5)
}
// Knit: rows of V stitches in a heathered yarn, as colour and as bump
const knitTextures = () => {
  const S = 256
  const cols = 8
  const rows = 12
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = S
    return [c, c.getContext('2d')]
  }
  const [cc, g] = make()
  const [bc, b] = make()
  g.fillStyle = '#24272b'
  g.fillRect(0, 0, S, S)
  b.fillStyle = '#000'
  b.fillRect(0, 0, S, S)
  const cw = S / cols
  const rh = S / rows
  const rand = random(5)
  for (let j = -1; j <= rows; j++) {
    for (let i = 0; i < cols; i++) {
      for (const side of [-1, 1]) {
        const cx = i * cw + cw / 2 + side * cw * 0.21
        const cy = j * rh + rh / 2
        for (const [ctx2, light] of [[g, true], [b, false]]) {
          ctx2.save()
          ctx2.translate(cx, cy)
          ctx2.rotate(side * 0.55)
          const gr = ctx2.createLinearGradient(0, -rh * 0.75, 0, rh * 0.75)
          const v = 0.85 + rand() * 0.3
          const hi = light ? `rgb(${Math.round(92 * v)},${Math.round(96 * v)},${Math.round(103 * v)})` : '#fff'
          const lo = light ? '#2a2d31' : '#333'
          gr.addColorStop(0, lo)
          gr.addColorStop(0.45, hi)
          gr.addColorStop(1, lo)
          ctx2.fillStyle = gr
          ctx2.beginPath()
          ctx2.ellipse(0, 0, cw * 0.24, rh * 0.78, 0, 0, Math.PI * 2)
          ctx2.fill()
          ctx2.restore()
        }
      }
    }
  }
  // heather: odd lighter fibres through the yarn
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(170,176,186,${rand() * 0.25})`
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1)
  }
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    // one tile is 16 mm of knit; the case's UVs are in metres
    t.repeat.set(1 / 0.016, 1 / 0.016)
    t.anisotropy = 16
    return t
  }
  return { map: tex(cc, true), bump: tex(bc) }
}

// The case: a bead-blasted aluminium base on a dark foot, a knit sleeve, a polished trim, and a
// smoked-glass top with a status light under it. Heights are its own, from the table up.
export function createCase(env) {
  const knit = knitTextures()
  const alu = new THREE.MeshPhysicalMaterial({ color: '#c4c7cb', metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 1 })
  const trimMat = new THREE.MeshPhysicalMaterial({ color: '#d6d8db', metalness: 1, roughness: 0.16, envMap: env, envMapIntensity: 1.2 })
  const rubber = new THREE.MeshStandardMaterial({ color: '#141517', roughness: 0.9 })
  const fabric = new THREE.MeshPhysicalMaterial({ map: knit.map, bumpMap: knit.bump, bumpScale: 1.2, roughness: 0.95, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#9aa2ad'), envMap: env, envMapIntensity: 0.35 })
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0b0c0e', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 1.3 })
  const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false })
  const H = DEV.half
  const base = new THREE.Group()
  base.add(new THREE.Mesh(slab(H - 0.012, 0, 0.0016, 0.0005), rubber), new THREE.Mesh(slab(H, 0.0016, 0.006, 0.0016), alu))
  const sleeve = new THREE.Group()
  sleeve.add(new THREE.Mesh(slab(H, 0.0076, 0.023, 0.0004, 0.0022), fabric))
  const top = new THREE.Group()
  top.add(new THREE.Mesh(slab(H - 0.0003, 0.0306, 0.0008, 0.0002), trimMat), new THREE.Mesh(slab(H - 0.0003, 0.0314, 0.0032, 0.0014), glass))
  // the light: a short bar seen through the glass at the front
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.00012, 0.0016, 2, 0.00006), light)
  bar.position.set(0, DEV.h + 0.00002, H - 0.014)
  top.add(bar)
  return { base, sleeve, top, light }
}

export function createBoard(ctx) {
  const rand = random(31)
  const root = new THREE.Group()
  const env = ctx.env
  const steel = new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 1, roughness: 0.32, envMap: env })
  const black = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.45, envMap: env, envMapIntensity: 0.4 })
  const plastic = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.7 })

  // Parts on the board: [x, z, w, d, h, material, label, pads]
  const parts = [
    { x: 0.022, z: -0.012, w: 0.012, d: 0.008, h: 0.0012, m: black, label: 'U', pads: 8 },
    { x: 0.022, z: 0.0, w: 0.012, d: 0.008, h: 0.0012, m: black, label: 'U', pads: 8 },
    { x: 0.03, z: -0.034, w: 0.017, d: 0.012, h: 0.003, m: steel, label: 'RF', pads: 0 },
    { x: -0.034, z: 0.03, w: 0.009, d: 0.007, h: 0.0032, m: steel, label: 'J', pads: 0 },
    { x: 0.004, z: -0.033, w: 0.006, d: 0.006, h: 0.0035, m: plastic, label: 'L', pads: 2 },
    { x: -0.006, z: -0.033, w: 0.006, d: 0.006, h: 0.0035, m: plastic, label: 'L', pads: 2 },
    { x: -0.016, z: -0.033, w: 0.006, d: 0.006, h: 0.0035, m: plastic, label: 'L', pads: 2 },
    { x: 0.006, z: 0.012, w: 0.005, d: 0.005, h: 0.0009, m: black, label: 'Q', pads: 4 },
    { x: 0.04, z: 0.016, w: 0.004, d: 0.0025, h: 0.0011, m: steel, label: 'Y', pads: 2 },
  ]
  const caps = [[0.004, -0.02], [-0.004, -0.02], [-0.012, -0.02], [-0.02, -0.02], [0.036, 0.034], [0.042, -0.02]]
  const pcb = pcbTexture(rand, [...parts, { x: SOCKET.x, z: SOCKET.z, w: SOCKET.size + 0.004, d: SOCKET.size + 0.004, label: 'CPU' }])

  // Main board. Its top is the flattened tennis ball (see felt.js), so the box draws only its edges
  // and underside.
  const main = new THREE.Group()
  root.add(main)
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#173327', roughness: 0.5 })
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD, 0.0016, BOARD),
    [edgeMat, edgeMat, new THREE.MeshBasicMaterial({ visible: false }), plastic, edgeMat, edgeMat],
  )
  board.position.y = YB - 0.0008
  board.castShadow = board.receiveShadow = true
  main.add(board)
  for (const p of parts) {
    const geo = p.m === steel ? new RoundedBoxGeometry(p.w, p.h, p.d, 2, Math.min(p.h, 0.0006)) : new THREE.BoxGeometry(p.w, p.h, p.d)
    const m = new THREE.Mesh(geo, p.m)
    m.position.set(p.x, YB + p.h / 2, p.z)
    m.castShadow = m.receiveShadow = true
    main.add(m)
  }
  const capGeo = new THREE.CylinderGeometry(0.0031, 0.0031, 0.007, 28).translate(0, 0.0035, 0)
  const capMat = new THREE.MeshStandardMaterial({ color: '#b4b8bd', roughness: 0.28, metalness: 1, envMap: env })
  const capTop = new THREE.CylinderGeometry(0.0029, 0.0029, 0.0002, 28).translate(0, 0.0071, 0)
  for (const [x, z] of caps) {
    const c = new THREE.Mesh(capGeo, capMat)
    c.position.set(x, YB, z)
    c.castShadow = true
    const t = new THREE.Mesh(capTop, steel)
    t.position.set(x, YB, z)
    main.add(c, t)
  }
  // Tiny resistors and capacitors, each a body between two metal ends
  const SMD = ctx.quality.mobile ? 160 : 420
  const smdBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0006, 0.00032, 0.0003), new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6 }), SMD)
  const smdEnds = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(0.00018, 0.00036, 0.00032).translate(-0.00036, 0, 0), new THREE.BoxGeometry(0.00018, 0.00036, 0.00032).translate(0.00036, 0, 0)]), steel, SMD)
  const o = new THREE.Object3D()
  const clear = (x, z) => Math.abs(x - SOCKET.x) > SOCKET.size / 2 + 0.003 || Math.abs(z - SOCKET.z) > SOCKET.size / 2 + 0.003
  let n = 0
  while (n < SMD) {
    const x = (rand() - 0.5) * BOARD * 0.92
    const z = (rand() - 0.5) * BOARD * 0.92
    if (!clear(x, z) || inLanes(x, z, 0.004) || parts.some((p) => Math.abs(x - p.x) < p.w / 2 + 0.001 && Math.abs(z - p.z) < p.d / 2 + 0.001) || z > 0.018) continue
    o.position.set(x, YB + 0.00018, z)
    o.rotation.set(0, rand() < 0.5 ? 0 : Math.PI / 2, 0)
    o.scale.setScalar(0.8 + rand() * 0.8)
    o.updateMatrix()
    smdBody.setMatrixAt(n, o.matrix)
    smdEnds.setMatrixAt(n, o.matrix)
    n++
  }
  main.add(smdBody, smdEnds)

  // The socket: its frame and its field of contacts are the tennis ball's, see felt.js
  const fw = FRAME.w

  // The processor: substrate and lid, lowered onto the contacts as the view pulls away
  const cpu = new THREE.Group()
  const sub = new THREE.Mesh(new THREE.BoxGeometry(SOCKET.size - 0.0004, 0.0011, SOCKET.size - 0.0004), new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.5 }))
  const lidTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')
    g.fillStyle = '#b9bec4'
    g.fillRect(0, 0, 512, 512)
    g.fillStyle = 'rgba(40,44,50,0.55)'
    g.font = '600 34px "Bricolage Grotesque", sans-serif'
    g.fillText('JGAO', 40, 90)
    g.font = '500 24px "Bricolage Grotesque", sans-serif'
    g.fillText('SENSE CORE  X1', 40, 130)
    g.fillText('2026  NYC → SEA', 40, 466)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.002, 0.02, 2, 0.0006), [steel, steel, new THREE.MeshStandardMaterial({ map: lidTex, metalness: 0.9, roughness: 0.38, envMap: env }), steel, steel, steel])
  sub.position.y = 0.00055
  lid.position.y = 0.0011 + 0.001
  sub.castShadow = lid.castShadow = true
  cpu.add(sub, lid)
  cpu.position.set(SOCKET.x, YB + SOCKET.floor + SOCKET.pin, SOCKET.z)
  main.add(cpu)

  // Traces that light from the processor to the radar board, a pulse running along each
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: 'attribute float aAlong; varying float vA; void main() { vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // The light runs out along each trace from the processor, its head brightest
    fragmentShader: 'uniform float uTime; uniform float uGlow; uniform vec3 uColor; varying float vA; void main() { if (vA > uGlow * 1.05) discard; float p = fract(vA * 3.0 - uTime * 0.35); float pulse = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.08, 0.3, p)); float head = smoothstep(0.08, 0.0, uGlow * 1.05 - vA) * (1.0 - step(0.999, uGlow)); gl_FragColor = vec4(uColor * (0.25 + 2.5 * pulse + 3.0 * head), 1.0); }',
  })
  const glow = new THREE.Group()
  for (let i = 0; i < 6; i++) {
    const z0 = SOCKET.z + SOCKET.size / 2 + 0.002
    const pts = [
      [SOCKET.x + 0.004 + i * 0.0016, z0],
      [SOCKET.x + 0.004 + i * 0.0016, z0 + 0.004 + i * 0.0008],
      [SENSOR.x - 0.012 + i * 0.0018, z0 + 0.012 + i * 0.0008],
      [SENSOR.x - 0.012 + i * 0.0018, SENSOR.z - 0.012],
    ]
    const pos = []
    const along = []
    let total = 0
    const lens = pts.slice(1).map((q, j) => Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1]))
    const sum = lens.reduce((a, b) => a + b, 0)
    for (let j = 0; j < pts.length - 1; j++) {
      const [ax, az] = pts[j]
      const [bx, bz] = pts[j + 1]
      const dx = bx - ax
      const dz = bz - az
      const l = Math.hypot(dx, dz)
      const nx = (-dz / l) * 0.00007
      const nz = (dx / l) * 0.00007
      const y = YB + 0.00006
      const a0 = total / sum
      const a1 = (total + l) / sum
      pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz)
      along.push(a0, a1, a1, a0, a1, a0)
      total += l
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1))
    glow.add(new THREE.Mesh(geo, glowMat))
  }
  main.add(glow)

  // The radar board at the front: an RF laminate with its chip and the gold patch arrays it
  // transmits and listens through, and a flex to the main board
  const radar = new THREE.Group()
  const rf = radarTextures()
  const rfTop = new THREE.MeshPhysicalMaterial({ map: rf.map, metalnessMap: rf.metal, roughnessMap: rf.rough, metalness: 1, roughness: 1, envMap: env, envMapIntensity: 1.1, clearcoat: 0.4, clearcoatRoughness: 0.35 })
  const rfEdge = new THREE.MeshStandardMaterial({ color: '#d9d2bd', roughness: 0.6 })
  const rb = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.0012, 0.026), [rfEdge, rfEdge, rfTop, rfEdge, rfEdge, rfEdge])
  rb.castShadow = rb.receiveShadow = true
  radar.add(rb)
  const chip = new THREE.Mesh(new RoundedBoxGeometry(0.0068, 0.0008, 0.0068, 2, 0.0002), black)
  chip.position.set(-0.0155, 0.001, 0)
  radar.add(chip)
  const flexCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.024, -0.0006, -0.008), new THREE.Vector3(-0.026, -0.004, -0.012), new THREE.Vector3(-0.024, -0.006, -0.018)])
  const flex = new THREE.Mesh(new THREE.TubeGeometry(flexCurve, 32, 0.0012, 8), new THREE.MeshStandardMaterial({ color: '#c8862e', roughness: 0.4, envMap: env, envMapIntensity: 0.6 }))
  radar.add(flex)
  radar.position.set(SENSOR.x, YB + 0.006, SENSOR.z)
  root.add(radar)

  // The case around it all, in three parts that come apart: base, sleeve, top
  const shell = createCase(env)
  root.add(shell.base, shell.sleeve, shell.top)
  for (const m of [shell.base, shell.sleeve, shell.top]) m.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true))

  // Each part: exploded offset, and out of the way (under the board, or above the camera) while
  // the camera is on the board
  const shells = [
    [shell.base, -0.05, -0.2],
    [shell.sleeve, 0.045, 0.6],
    [shell.top, 0.075, 0.66],
  ]

  const ao = aoTexture([
    ...parts.map((p) => ({ x: p.x, z: p.z, w: p.w, d: p.d, r: 0.0008 + p.h * 0.5, a: 0.55 })),
    ...caps.map(([x, z]) => ({ x, z, w: 0.0062, d: 0.0062, r: 0.0026, a: 0.6 })),
    { x: SOCKET.x, z: SOCKET.z, w: fw, d: fw, r: 0.0012, a: 0.5 },
    { x: SENSOR.x, z: SENSOR.z, w: 0.05, d: 0.022, r: 0.006, a: 0.35 },
  ])

  // arrive: the shells come in around the boards; assemble: everything closes up; seat: the
  // processor goes into its socket; glowOn: how far the lit traces have run
  const update = ({ arrive, assemble, seat, glowOn, time, signal }) => {
    for (const [m, out, away] of shells) {
      m.position.y = lerp(lerp(away, out, arrive), 0, assemble)
      m.visible = arrive > 0.001
    }
    radar.position.y = lerp(YB + 0.006, YB + 0.032, arrive * (1 - assemble))
    // hovering well above the camera's climb out of the contacts until it comes down
    cpu.position.y = YB + SOCKET.floor + SOCKET.pin + lerp(0.032, 0, seat)
    cpu.rotation.y = lerp(0.12, 0, seat)
    glowMat.uniforms.uTime.value = time / 1000
    glowMat.uniforms.uGlow.value = glowOn
    glowMat.uniforms.uColor.value.copy(signal)
    glow.visible = glowOn > 0.001
    shell.light.color.copy(signal).multiplyScalar(1.6 + 1.4 * glowOn)
    // Once the case has closed there is nothing inside to see
    main.visible = assemble < 0.999
  }
  return { root, main, update, pcb, ao }
}

export const deviceTimeline = (p) => ({
  seat: smooth(1.5, 1.6, p),
  glowOn: smooth(1.62, 1.72, p) * (1 - smooth(2.2, 2.35, p)),
  arrive: smooth(1.84, 1.96, p),
  assemble: smooth(2.0, 2.12, p),
})
