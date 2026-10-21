import * as THREE from 'three'
import { COURT, LINES, NET, PLOT } from '../courtLines'
import { courtColors } from '../heroScene'
import { random, rig, applyPose, smooth } from './util'
import { feltKeys, BEND_X, BALL } from './felt'

// The court at the Central Park Tennis Center, in metres: X along the court, Z across it, the
// handover court at the origin and its neighbours in the same two rows of six as the city view.
// It opens exactly as the city drew it, flat and in the map's own colours, and stands up into the
// real place as the camera comes down: light and grain come into the clay, the nets and
// windscreens rise. A ball comes over from the next court and rolls to rest on the sideline, and
// the camera goes down into its felt.
const ROWS = [0, 1]
const COLS = [-3, -2, -1, 0, 1, 2]
const GRID = { x0: -PLOT.x / 2, x1: PLOT.x * 1.5, z0: -PLOT.y * 3.5, z1: PLOT.y * 2.5 }
const SIDELINE = COURT.singles / 2
const HALF = Math.PI / 2
const R = BALL / 1000
// Where the ball comes to rest, on the singles sideline
const REST = [1.2, SIDELINE]
// How far the ball turns under the camera during the run through its fuzz, in mm of its surface
const RUN_MM = 16
// The city view draws fences a little over a quarter metre wide, and the net as a 5 cm line
const FENCE_W = 0.12 * 2.2
const NET_W = 0.05

// Practice balls left lying about after a lesson, around the one the camera goes into, which sits
// on the sideline; [x, z, turn]
const BALLS = [
  [0.55, -0.35, 0.4], [1.75, -0.6, 2.1], [2.3, 0.25, 4.0], [0.2, -1.1, 1.3], [2.9, -1.4, 5.2], [1.4, -2.0, 0.9],
  [3.8, -0.5, 3.3], [-0.6, -0.4, 2.7], [4.6, -2.4, 1.8], [3.2, 0.9, 0.2], [5.6, -1.1, 4.4], [-1.5, -1.8, 3.9],
  [6.5, 0.4, 2.4], [2.1, -3.1, 5.8],
].map(([x, z, t]) => [x, SIDELINE + z, t])

const GROUND_V = `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const GROUND_F = `
precision highp float;
varying vec3 vW;
uniform vec4 uLines[${LINES.length}];
uniform vec2 uPlot;
uniform vec4 uGrid;
uniform vec3 uClay; uniform vec3 uPaint; uniform vec3 uFence; uniform vec3 uGrass;
uniform vec3 uSunDir; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uFog; uniform float uFogD;
uniform float uFlat; uniform vec3 uFlatClay; uniform vec3 uFlatPaint; uniform vec3 uFlatFence; uniform vec3 uFlatPark; uniform vec3 uFlatNet;
uniform vec3 uBalls[${BALLS.length + 1}];

float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Acrylic hard court: sand grain from 1.5 cm down to a tenth of a millimetre, finest the strongest;
// octaves finer than a pixel fade out
float grain(vec2 p, float px) {
  float s = 0.0; float a = 0.3; float f = 70.0; float n = 0.0;
  for (int i = 0; i < 8; i++) {
    float fade = 1.0 - smoothstep(0.25, 0.6, px * f);
    s += a * (noise(p * f + float(i) * 7.13) - 0.5) * fade;
    n += a;
    a *= 0.92; f *= 2.2;
  }
  return s / n;
}
float box(vec2 p, vec4 r) {
  vec2 c = (r.xy + r.zw) * 0.5; vec2 h = abs(r.zw - r.xy) * 0.5;
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
vec2 cellOf(vec2 w) {
  return vec2(clamp(floor((w.x + uPlot.x * 0.5) / uPlot.x), 0.0, 1.0) * uPlot.x, clamp(floor((w.y + uPlot.y * 0.5) / uPlot.y), -3.0, 2.0) * uPlot.y);
}
float lineDist(vec2 w) {
  vec2 p = w - cellOf(w);
  float d = 1e3;
  for (int i = 0; i < ${LINES.length}; i++) d = min(d, box(p, uLines[i]));
  return d;
}
// How much paint is here, with edges that wander and dust lying over it
float paint(vec2 w, float px, float d) {
  float ragged = (noise(w * 300.0) - 0.5) * 0.0024 + (noise(w * 2200.0) - 0.5) * 0.0006 * (1.0 - smoothstep(0.0002, 0.0006, px));
  float e = max(px * 0.7, 0.00025);
  float m = 1.0 - smoothstep(-e, e, d + ragged);
  // worn where players slide and brush clay over the lines
  m *= 1.0 - 0.45 * smoothstep(0.55, 0.85, noise(w * 18.0)) * smoothstep(0.4, 0.8, noise(w * 3.0));
  return m;
}
float height(vec2 w, float px, float m) {
  float g = grain(w, px);
  float clay = g * 0.0005 + (noise(w * 900.0) - 0.5) * 0.0003 * (1.0 - smoothstep(0.0003, 0.001, px));
  float coat = 0.00045 + g * 0.00025;
  float cr = abs(noise(w * 160.0) - 0.5);
  coat -= (1.0 - smoothstep(0.0, 0.025, cr)) * 0.00025;
  return mix(clay, coat, m);
}
// Coverage of a strip of width wd at distance d, for a pixel px wide
float strip(float d, float wd, float px) {
  return clamp((min(d + px * 0.5, wd * 0.5) - max(d - px * 0.5, -wd * 0.5)) / px, 0.0, 1.0);
}
// The court as the city view draws it: flat colour, crisp edges
vec3 drawn(vec2 w, float px, float d) {
  float inGrid = step(uGrid.x, w.x) * step(w.x, uGrid.y) * step(uGrid.z, w.y) * step(w.y, uGrid.w);
  vec3 col = mix(uFlatPark, uFlatClay, inGrid);
  float gx = clamp(floor((w.x - uGrid.x) / uPlot.x + 0.5), 0.0, 2.0) * uPlot.x + uGrid.x;
  float gz = clamp(floor((w.y - uGrid.z) / uPlot.y + 0.5), 0.0, 6.0) * uPlot.y + uGrid.z;
  float hw = ${(FENCE_W / 2).toFixed(4)};
  float alongX = step(uGrid.x - hw, w.x) * step(w.x, uGrid.y + hw);
  float alongZ = step(uGrid.z - hw, w.y) * step(w.y, uGrid.w + hw);
  float fence = max(strip(abs(w.x - gx), ${FENCE_W.toFixed(4)}, px) * alongZ, strip(abs(w.y - gz), ${FENCE_W.toFixed(4)}, px) * alongX);
  col = mix(col, uFlatFence, fence);
  col = mix(col, uFlatPaint, clamp(0.5 - d / px, 0.0, 1.0) * inGrid);
  vec2 q = w - cellOf(w);
  float net = strip(abs(q.x), ${NET_W.toFixed(3)}, px) * step(abs(q.y), ${NET.y.toFixed(3)}) * inGrid;
  return mix(col, uFlatNet, net);
}
void main() {
  vec2 w = vW.xz;
  float px = max(length(fwidth(w)), 1e-6);
  float d = lineDist(w);
  float m = paint(w, px, d);
  float inGrid = step(uGrid.x, w.x) * step(w.x, uGrid.y) * step(uGrid.z, w.y) * step(w.y, uGrid.w);
  vec2 q = vec2(mod(w.x - uGrid.x, uPlot.x), mod(w.y - uGrid.z, uPlot.y));
  float fence = (1.0 - smoothstep(0.12, 0.12 + px, min(min(q.x, uPlot.x - q.x), min(q.y, uPlot.y - q.y)))) * inGrid;
  float g = grain(w, px);
  vec3 base = uClay * (1.0 + g * 0.32) * (0.97 + 0.06 * noise(w * 0.35));
  vec3 col = mix(base, uPaint * (1.0 + g * 0.25), m * inGrid);
  col = mix(col, uFence, fence);
  col = mix(uGrass * (1.0 + g * 0.4), col, inGrid);
  // a surface normal from the height field, at this pixel's own scale
  float e = max(px, 0.00004);
  float h0 = height(w, px, m);
  float hx = height(w + vec2(e, 0.0), px, m);
  float hz = height(w + vec2(0.0, e), px, m);
  vec3 n = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e) * vec3(0.55, 1.0, 0.55));
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 lit = col * (uSky * (0.55 + 0.45 * n.y) + uSun * ndl);
  float spec = pow(max(dot(reflect(-uSunDir, n), normalize(cameraPosition - vW)), 0.0), 24.0) * m * 0.12;
  lit += uSun * spec;
  // each ball's own shadow, a little toward the sun's far side
  float shade = 0.0;
  for (int i = 0; i < ${BALLS.length + 1}; i++) {
    vec2 bd = w - uBalls[i].xy - uSunDir.xz * ${(R * 0.5).toFixed(4)};
    shade = max(shade, uBalls[i].z * exp(-dot(bd, bd) / ${(R * R * 0.9).toFixed(6)}));
  }
  lit *= 1.0 - 0.55 * shade;
  float dist = length(cameraPosition - vW);
  float fog = (1.0 - exp(-pow(dist * uFogD, 1.4))) * (1.0 - uFlat);
  gl_FragColor = vec4(mix(mix(lit, uFog, fog), drawn(w, px, d), uFlat), 1.0);
}
`


const srgb = (c) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c)
  if (hex) return new THREE.Color(c)
  const [r, g, b] = (c.match(/[\d.]+/g) || [128, 128, 128]).map(Number)
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
}

export function createCourt(ctx, felt) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)
  const rand = random(23)
  const sunDir = new THREE.Vector3(-0.45, 0.82, 0.36).normalize()

  const lines = LINES.map(([x0, y0, x1, y1]) => new THREE.Vector4(x0, y0, x1, y1))
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_V,
      fragmentShader: GROUND_F,
      uniforms: {
        uLines: { value: lines },
        uPlot: { value: new THREE.Vector2(PLOT.x, PLOT.y) },
        uGrid: { value: new THREE.Vector4(GRID.x0, GRID.x1, GRID.z0, GRID.z1) },
        uClay: { value: new THREE.Color('#4a78ab') },
        uPaint: { value: new THREE.Color('#f1f2ea').multiplyScalar(1.9) },
        uFence: { value: new THREE.Color('#263a57') },
        uGrass: { value: new THREE.Color('#7d9a72') },
        uSunDir: { value: sunDir },
        uSun: { value: new THREE.Color(1, 0.97, 0.9) },
        uSky: { value: new THREE.Color(1, 1, 1) },
        uFog: { value: new THREE.Color() },
        uFogD: { value: 0.006 },
        uFlat: { value: 1 },
        uFlatClay: { value: new THREE.Color() },
        uFlatPaint: { value: new THREE.Color() },
        uFlatFence: { value: new THREE.Color() },
        uFlatPark: { value: new THREE.Color() },
        uFlatNet: { value: new THREE.Color() },
        uBalls: { value: [REST, ...BALLS].map(([x, z]) => new THREE.Vector3(x, z, 0)) },
      },
    }),
  )
  scene.add(ground)
  const gu = ground.material.uniforms

  // Nets, posts and the windscreens on the fences between plots: all rise out of the map
  const risers = []
  const dark = new THREE.MeshStandardMaterial({ color: '#22304a', roughness: 0.7 })
  const netTex = (() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 64
    const g = c.getContext('2d')
    g.strokeStyle = 'rgba(20,24,22,0.9)'
    g.lineWidth = 1.4
    for (let x = 0; x <= 512; x += 6) {
      g.beginPath()
      g.moveTo(x, 8)
      g.lineTo(x, 64)
      g.stroke()
    }
    for (let y = 8; y <= 64; y += 6) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(512, y)
      g.stroke()
    }
    g.fillStyle = '#f4f4ee'
    g.fillRect(0, 0, 512, 8)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(4, 1)
    t.anisotropy = 8
    return t
  })()
  const net = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.05 })
  const screenMat = new THREE.MeshStandardMaterial({ color: '#22355a', roughness: 0.95, side: THREE.DoubleSide })
  const post = new THREE.CylinderGeometry(0.04, 0.04, NET.posts, 10).translate(0, NET.posts / 2, 0)
  const netGeo = new THREE.PlaneGeometry(NET.y * 2, NET.height).rotateY(Math.PI / 2).translate(0, NET.height / 2, 0)
  for (const r of ROWS) {
    for (const c of COLS) {
      const x = r * PLOT.x
      const z = c * PLOT.y
      const m = new THREE.Mesh(netGeo, net)
      m.position.set(x, 0, z)
      scene.add(m)
      risers.push([m, false])
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(post, dark)
        p.position.set(x, 0, z + s * NET.y)
        scene.add(p)
        risers.push([p, true])
      }
    }
  }
  const wallX = new THREE.PlaneGeometry(PLOT.y * COLS.length, 2.4).translate(0, 1.2, 0).rotateY(Math.PI / 2)
  const wallZ = new THREE.PlaneGeometry(PLOT.x * ROWS.length, 2.4).translate(0, 1.2, 0)
  for (let i = 0; i <= ROWS.length; i++) {
    const m = new THREE.Mesh(wallX, screenMat)
    m.position.set(GRID.x0 + i * PLOT.x, 0, (GRID.z0 + GRID.z1) / 2)
    scene.add(m)
    risers.push([m, false])
  }
  for (let j = 0; j <= COLS.length; j++) {
    const m = new THREE.Mesh(wallZ, screenMat)
    m.position.set((GRID.x0 + GRID.x1) / 2, 0, GRID.z0 + j * PLOT.y)
    scene.add(m)
    risers.push([m, false])
  }

  // The park beyond the fences: tree crowns in a loose ring
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#5a7a50', roughness: 1, flatShading: true }), 160)
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1, 6).translate(0, 0.5, 0), dark, 160)
  const o = new THREE.Object3D()
  for (let i = 0; i < 160; i++) {
    const a = rand() * Math.PI * 2
    const r = 95 + rand() * 120
    const x = (GRID.x0 + GRID.x1) / 2 + Math.cos(a) * r
    const z = (GRID.z0 + GRID.z1) / 2 + Math.sin(a) * r * 0.8
    const s = 4 + rand() * 4
    o.position.set(x, 3 + s * 0.6, z)
    o.scale.set(s, s * (0.8 + rand() * 0.3), s)
    o.rotation.set(rand(), rand() * 6, rand())
    o.updateMatrix()
    crowns.setMatrixAt(i, o.matrix)
    o.position.set(x, 0, z)
    o.scale.set(1, 3 + s * 0.6, 1)
    o.rotation.set(0, 0, 0)
    o.updateMatrix()
    trunks.setMatrixAt(i, o.matrix)
  }
  scene.add(crowns, trunks)

  // The ball: the felt sheet, bent round, sits in this group with the sheet's middle on top
  const ball = new THREE.Group()
  const holder = new THREE.Group()
  holder.position.set(-BEND_X / 1000, R, 0)
  ball.add(holder)
  ball.position.set(REST[0], R, REST[1])
  scene.add(ball)
  const others = BALLS.map(([x, z, turn]) => {
    const g = felt.makeBall()
    g.position.set(x, R, z)
    g.rotation.set(turn * 0.7, turn, turn * 1.3)
    scene.add(g)
    return g
  })

  const hemi = new THREE.HemisphereLight(0xffffff, 0x4a78ab, 0.9)
  const sun = new THREE.DirectionalLight(0xfff4e2, 1.6)
  sun.position.copy(sunDir).multiplyScalar(50)
  scene.add(hemi, sun)

  let path = null
  const resize = () => {
    const h = ctx.handoff
    if (!h) return
    // The height at which this camera sees the court at the city view's scale, pixel for pixel. The
    // city's zoom is still running when it hands over, so the first keys carry on at its rate.
    const top = ctx.H / (2 * Math.tan((30 * Math.PI) / 360) * h.ppm)
    const y0 = h.portrait ? -HALF : 0
    const along = -HALF
    const origin = [REST[0] - BEND_X / 1000, 2 * R, REST[1]]
    path = rig([
      [0.31, [0, 0, 0, top * Math.exp(0.7), y0, HALF, 30, 0]],
      [0.36, [0, 0, 0, top, y0, HALF, 30, 0]],
      [0.42, [0.5, 0, 1.4, top * Math.exp(-0.9), y0 + (along - y0) * 0.15, 1.42, 30, 0.02]],
      [0.48, [2.4, 0, 3.0, 8, y0 + (along - y0) * 0.65, 0.95, 32, 0.06]],
      [0.54, [REST[0] + 0.8, 0.02, REST[1], 2.6, along + 0.14, 0.62, 34, 0.14]],
      ...feltKeys(origin),
    ])
  }

  const theme = () => {
    const sky = ctx.dark ? new THREE.Color('#1b2633') : new THREE.Color('#dfe7ea')
    scene.background = sky
    gu.uFog.value.copy(sky)
    gu.uSky.value.set(ctx.dark ? 0.55 : 0.62, ctx.dark ? 0.6 : 0.64, ctx.dark ? 0.72 : 0.66)
    gu.uSun.value.set(ctx.dark ? 0.55 : 0.5, ctx.dark ? 0.56 : 0.48, ctx.dark ? 0.6 : 0.44)
    scene.fog = new THREE.FogExp2(sky, 0.006)
    hemi.intensity = ctx.dark ? 0.6 : 0.9
    const c = courtColors(ctx.colors)
    gu.uFlatClay.value.copy(srgb(c.clay))
    gu.uFlatPaint.value.copy(srgb(c.paint))
    gu.uFlatFence.value.copy(srgb(c.fence))
    gu.uFlatPark.value.copy(srgb(c.park))
    gu.uFlatNet.value.copy(srgb(c.net))
  }

  const update = (p) => {
    if (!path) resize()
    const pose = path(p)
    applyPose(camera, pose)
    camera.near = Math.max(0.00005, pose.distance * 0.05)
    camera.far = 2000
    camera.updateProjectionMatrix()

    gu.uFlat.value = 1 - smooth(0.36, 0.44, p)
    // Down in the felt, the court beyond is lost in the same haze as the felt's own
    gu.uFogD.value = 0.006 + 30 * smooth(0.74, 0.84, p)
    scene.fog.density = gu.uFogD.value
    const rise = smooth(0.37, 0.46, p)
    for (const [m, whole] of risers) {
      m.scale.set(whole ? rise : 1, Math.max(rise, 1e-4), whole ? rise : 1)
      m.visible = rise > 0.001
    }

    // The balls come up with the rest of the court out of the flat map, where they are a pixel or two
    for (const g of [ball, ...others]) {
      g.scale.setScalar(Math.max(rise, 1e-3))
      g.visible = rise > 0.001
    }
    for (const s of gu.uBalls.value) s.z = rise
    // The run: story time all but stops while the ball turns under the camera, the felt flowing back
    // beneath it as though it flew on through the fibres
    ball.rotation.z = (-RUN_MM / BALL) * (1 - (ctx.run ?? 1))
    holder.add(felt.root)
    felt.update(p)
    const away = pose.position.distanceTo(ball.position)
    felt.place({ onBoard: false, near: away < 0.6, seen: rise > 0.001 && away < 2.5 })
    felt.nearBalls(camera)
    return { focus: pose.distance, aperture: pose.aperture }
  }

  return { scene, camera, update, resize, theme }
}
