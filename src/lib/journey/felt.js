import * as THREE from 'three'
import { random, smooth, lerp } from './util'
import { BOARD, YB, SOCKET, FRAME } from './board'

// The tennis ball, in millimetres, and what it becomes. One sheet of felt is bent into the ball
// (x and z become longitude and latitude) and fibre grows all over it, densest where the camera
// comes down. The ball then unrolls flat into the device's circuit board, whose top this sheet is
// from then on. Most fibres lie down into it; the ones over the processor's socket slide onto its
// grid, straighten, and harden into its gold contacts, while the socket's frame rises around them.
// The same object sits on the court and then on the board, and the camera holds its place
// relative to it across the change.
export const BALL = 33
export const BEND_X = 36
const PIN_Z = -2
// The sheet's origin in the device's frame: the top of the ball lands on the socket
export const FELT_ORIGIN = [SOCKET.x - BEND_X / 1000, YB, SOCKET.z - PIN_Z / 1000]
const HALF = Math.PI / 2

// The camera from the ball's approach to the socket's contacts, in the ball's own millimetres:
// [p, [target x, y, z, distance, yaw, pitch, fov, aperture]]
export const FELT_KEYS = [
  [0.6, [BEND_X, -BALL, PIN_Z, 900, -HALF + 0.08, 0.5, 36, 0.3]],
  [0.66, [BEND_X, -12, PIN_Z, 260, -HALF + 0.04, 0.74, 36, 0.42]],
  [0.72, [BEND_X - 6, -1, PIN_Z, 60, -HALF, 0.9, 36, 0.55]],
  [0.77, [BEND_X - 8, 0.2, PIN_Z, 14, -HALF - 0.04, 0.6, 37, 0.72]],
  // in among the fibres, low, running through them while they turn
  [0.82, [BEND_X - 7, 0.8, PIN_Z, 4.5, -HALF - 0.06, 0.36, 38, 0.85]],
  [0.87, [BEND_X - 5.6, 0.8, PIN_Z + 0.2, 3.4, -HALF - 0.04, 0.38, 39, 0.88]],
  [0.92, [BEND_X - 4.2, 0.75, PIN_Z + 0.1, 3.1, -HALF - 0.02, 0.4, 39, 0.87]],
  [0.97, [BEND_X - 3, 0.7, PIN_Z, 3.0, -HALF, 0.45, 39, 0.84]],
  // then up out of the contacts in one long rise, never back down into them
  [1.02, [BEND_X - 2, 0.6, PIN_Z, 3.3, -HALF, 0.58, 39, 0.76]],
  [1.08, [BEND_X - 1, 0.45, PIN_Z, 4.2, -HALF, 0.8, 38, 0.62]],
  [1.15, [BEND_X + 0.2, 0.3, PIN_Z, 6.4, -HALF + 0.05, 1.0, 38, 0.48]],
  [1.24, [BEND_X + 1.5, 0.3, PIN_Z, 12, -HALF + 0.12, 1.0, 38, 0.38]],
  [1.32, [BEND_X + 2.5, 0.3, PIN_Z, 18, -HALF + 0.2, 0.85, 38, 0.32]],
]
// Felt keys in a frame where the sheet's origin sits at `at`, a millimetre being 0.001
export const feltKeys = (at) =>
  FELT_KEYS.map(([p, [x, y, z, d, ...rest]]) => [p, [at[0] + x / 1000, at[1] + y / 1000, at[2] + z / 1000, d / 1000, ...rest]])

// When each part of the change happens, in scene time
// loose fibres lie down one by one and are gone by the cut onto the device; the contacts take
// longer, and are still hardening as the camera rises off them
export const feltTimeline = (p) => ({
  curve: 1 - smooth(0.87, 0.98, p),
  hair: smooth(0.83, 1.0, p),
  morph: smooth(0.8, 1.15, p),
  board: smooth(0.84, 1.05, p),
  fog: smooth(0.68, 0.82, p) * (1 - smooth(1.03, 1.12, p)),
})

const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
`
// The sheet wraps onto the ball: x and z become angles around a sphere under it. Curvature, not
// radius, runs from the ball's to none, so it opens out steadily; the terms are arranged to stay
// exact when it is nearly flat, where the sphere's centre is very far away.
const BEND = `
uniform float uCurve;
float sinc(float u) { return abs(u) < 1e-3 ? 1.0 - u * u / 6.0 : sin(u) / u; }
vec3 bend(vec3 p) {
  float k = uCurve / ${BALL.toFixed(1)};
  float dx = p.x - ${BEND_X.toFixed(1)};
  float a = dx * k;
  float b = p.z * k;
  float ca = cos(a);
  float cb = cos(b);
  return vec3(
    ${BEND_X.toFixed(1)} + cb * (dx * sinc(a) + p.y * sin(a)),
    p.y * ca * cb - (dx * sin(a * 0.5) * sinc(a * 0.5) + ca * p.z * sin(b * 0.5) * sinc(b * 0.5)),
    p.z * sinc(b) + p.y * sin(b));
}
`
// Each part turns from felt to board a little after the part nearer the middle of the view
const SPREAD = `
uniform float uMorph; uniform float uHair; uniform float uBoardK; uniform vec2 uMorphC;
float spread(float amount, vec2 p, float reach) {
  float k = clamp(amount * 1.3 - 0.3 * clamp(length(p - uMorphC) / reach, 0.0, 1.0), 0.0, 1.0);
  return k * k * (3.0 - 2.0 * k);
}
`

const STRAND_V = `
attribute float aS;
attribute float aA;
attribute vec3 iRoot;
attribute vec4 iSeed;
attribute vec4 iPin;
uniform float uTime;
varying vec3 vN;
varying vec3 vT;
varying vec3 vW;
varying float vS;
varying vec4 vSeed;
varying float vMetal;
${BEND}
${SPREAD}
const float TAU = 6.2831853;
vec3 lying(float s) {
  float L = iRoot.z;
  return vec3(iRoot.x + s * L, 0.012 + iSeed.x * 0.03 + sin(s * 7.0 + iSeed.y * TAU) * 0.008, iRoot.y + sin(s * 3.0 + iSeed.z * TAU) * 0.06 * L);
}
float stage(float m, float a, float b) { float k = clamp((m - a) / (b - a), 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
vec3 standing(float s) {
  float L = iRoot.z * (0.55 + 0.35 * iSeed.w);
  vec2 lean = vec2(cos(iSeed.y * TAU), sin(iSeed.y * TAU)) * (0.25 + 0.5 * iSeed.x);
  float curl = 2.0 + iSeed.z * 4.0;
  vec3 p = vec3(iRoot.x, 0.0, iRoot.y);
  p.y += s * L;
  p.xz += lean * s * s * L;
  p.x += sin(s * curl + iSeed.x * TAU) * 0.16 * L * s;
  p.z += cos(s * curl * 1.3 + iSeed.w * TAU) * 0.16 * L * s;
  // a slow stir, as if from breath
  p.xz += vec2(sin(uTime * 0.6 + iSeed.y * 9.0), cos(uTime * 0.5 + iSeed.z * 7.0)) * 0.02 * s * s;
  return p;
}
// A socket contact: a foot on the board, an arm sprung up at an angle, a rounded tip
vec3 contact(float s) {
  vec3 b = vec3(iPin.x, 0.0, iPin.y);
  if (s < 0.2) return b + vec3(0.0, 0.016, mix(-0.1, 0.0, s / 0.2));
  float k = (s - 0.2) / 0.8;
  return b + vec3(0.0, mix(0.016, 0.45, k), 0.15 * k);
}
// about as fine as the fibre it was
float contactR(float s) {
  if (s < 0.2) return 0.05;
  if (s < 0.8) return 0.017;
  float u = (s - 0.8) / 0.2;
  return mix(0.017, 0.0, u) + 0.03 * sin(u * 3.14159);
}
// The same fibre straightened and standing on its contact's place
vec3 upright(float s) {
  float L = iRoot.z * (0.55 + 0.35 * iSeed.w);
  return vec3(iPin.x, s * L, iPin.y);
}
// A contact's fibre straightens onto its place, then bends into the contact; the rest lie down
vec3 centre(float s, float m) {
  if (iPin.z < 0.5) return mix(standing(s), lying(s), m);
  return mix(mix(standing(s), upright(s), stage(m, 0.0, 0.45)), contact(s), stage(m, 0.35, 0.85));
}
void main() {
  float s = aS;
  float m = iPin.z > 0.5
    ? clamp(uMorph * 1.2 - 0.12 * clamp(length(iRoot.xy - uMorphC) / 26.0, 0.0, 1.0) - iSeed.x * 0.08, 0.0, 1.0)
    : clamp((spread(uHair, iRoot.xy, 26.0) - iSeed.z * 0.6) / 0.4, 0.0, 1.0);
  vec3 c = centre(s, m);
  vec3 T = normalize(centre(min(s + 0.02, 1.0), m) - centre(max(s - 0.02, 0.0), m));
  vec3 up = abs(T.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 N = normalize(cross(T, up));
  vec3 B = cross(N, T);
  float hair = (0.012 + iSeed.w * 0.008) * (1.0 - 0.5 * pow(s, 3.0));
  float r = hair;
  vec3 o = N * cos(aA) + B * sin(aA);
  if (iPin.z > 0.5) {
    float shape = stage(m, 0.55, 1.0);
    r = mix(hair, contactR(s), shape);
    // the foot is a flat pad
    o.y *= mix(1.0, s < 0.2 ? 0.3 : 1.0, shape);
  } else {
    // the rest lie down into the board and are gone
    r *= 1.0 - smoothstep(0.35, 1.0, m);
  }
  vec3 p = bend(c + o * r);
  vN = normalize(mat3(modelMatrix) * (bend(c + o * (r + 0.01)) - p));
  vT = normalize(mat3(modelMatrix) * (bend(c + T * 0.05) - bend(c)));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vS = s;
  vSeed = iSeed;
  vMetal = iPin.z * stage(m, 0.25, 0.9);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
// Fog runs per millimetre, the sheet's own unit
const LIGHT = `
uniform vec3 uKey; uniform vec3 uKeyCol; uniform vec3 uFill; uniform vec3 uFog; uniform float uFogD;
uniform vec3 uFelt; uniform vec3 uGold;
`
const STRAND_F = `
precision highp float;
varying vec3 vN;
varying vec3 vT;
varying vec3 vW;
varying float vS;
varying vec4 vSeed;
varying float vMetal;
${LIGHT}
void main() {
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  vec3 T = normalize(vT);
  vec3 base = uFelt * (0.8 + 0.4 * vSeed.x) * mix(0.55, 1.0, smoothstep(0.0, 0.5, vS));
  // hair: light along the fibre, a sheen where it catches the key, light through it from behind
  vec3 H = normalize(uKey + V);
  float th = dot(T, H);
  float sheen = pow(sqrt(max(1.0 - th * th, 0.0)), 70.0);
  float wrap = max((dot(N, uKey) + 0.5) / 1.5, 0.0);
  float back = pow(max(dot(-V, uKey), 0.0), 3.0) * 0.6;
  vec3 hairCol = base * (uFill + uKeyCol * wrap) + uKeyCol * (sheen * 0.35 + back * 0.4) * mix(vec3(1.0), base, 0.6);
  // gold: a polished metal, bright where it faces the key, coloured by its own reflection
  float ndh = max(dot(N, H), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 metal = uGold * (0.3 * uFill + uKeyCol * (0.4 * max(dot(N, uKey), 0.0) + 2.4 * pow(ndh, 50.0))) + mix(uGold, vec3(1.0), 0.35) * fres * 0.7;
  vec3 col = mix(hairCol, metal, vMetal);
  float d = length(cameraPosition - vW) * 1000.0;
  col = mix(col, uFog, 1.0 - exp(-d * uFogD));
  gl_FragColor = vec4(col, 1.0);
}
`
const BASE_V = `
varying vec3 vW;
varying vec2 vP;
varying vec3 vN;
${BEND}
void main() {
  vP = position.xz;
  vec3 p = bend(position);
  vN = normalize(mat3(modelMatrix) * (bend(position + vec3(0.0, 0.5, 0.0)) - p));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const BASE_F = `
precision highp float;
varying vec3 vW;
varying vec2 vP;
varying vec3 vN;
${LIGHT}
${NOISE}
${SPREAD}
uniform vec3 uSeamCol;
uniform sampler2D uBoard; uniform sampler2D uAO; uniform vec4 uMap; uniform float uClip;
void main() {
  vec2 p = vP;
  // Where this is on the device's board, which the sheet becomes
  vec2 b = uMap.xy + p * 0.001;
  vec2 uv = (b + uMap.z * 0.5) / uMap.z;
  uv.y = 1.0 - uv.y;
  if (uClip > 0.5 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  // felt, its finest fuzz averaged out once it is smaller than a pixel
  float px = max(length(fwidth(p)), 1e-5);
  float fuzz = 0.5 + (noise(p * 6.0) - 0.5) * 0.5 * (1.0 - smoothstep(0.08, 0.3, px * 6.0))
    + (noise(p * 19.0) - 0.5) * 0.3 * (1.0 - smoothstep(0.08, 0.3, px * 19.0))
    + (noise(p * 60.0) - 0.5) * 0.2 * (1.0 - smoothstep(0.08, 0.3, px * 60.0));
  vec3 felt = uFelt * (0.5 + 0.4 * fuzz);
  // the ball's white rubber seam: two lobes, crossing the middle four times
  float lon = (p.x - ${BEND_X.toFixed(1)}) / ${BALL.toFixed(1)};
  float lat = p.y / ${BALL.toFixed(1)};
  float seamD = abs(lat - 0.62 * sin(2.0 * (lon + 0.785))) * ${BALL.toFixed(1)};
  float seam = 1.0 - smoothstep(0.75, 0.75 + max(px * 1.5, 0.25), seamD);
  felt = mix(felt, uSeamCol * (0.9 + 0.1 * fuzz), seam);
  // the board: its own artwork, solder mask with a faint weave at this scale
  float weave = noise(p * vec2(30.0, 3.0)) * 0.5 + noise(p * vec2(3.0, 30.0)) * 0.5;
  vec3 board = texture2D(uBoard, uv).rgb * (0.84 + 0.28 * mix(0.5, weave, 1.0 - smoothstep(0.02, 0.08, px)));
  float m = spread(uBoardK, p, 40.0);
  vec3 col = mix(felt, board, m);
  float ao = mix(1.0, texture2D(uAO, uv).r, m);
  float ndl = max(dot(N, uKey), 0.0);
  vec3 H = normalize(uKey + V);
  // fuzz catches light at the ball's edge; the mask is a little glossy
  float rim = pow(1.0 - abs(dot(N, V)), 2.5) * (1.0 - m) * (1.0 - seam);
  float gloss = pow(max(dot(N, H), 0.0), 40.0) * 0.45 * m;
  vec3 lit = col * (uFill + uKeyCol * ndl * 0.85) * ao + uKeyCol * gloss + uFelt * uKeyCol * rim * 0.3;
  float d = length(cameraPosition - vW) * 1000.0;
  gl_FragColor = vec4(mix(lit, uFog, 1.0 - exp(-d * uFogD)), 1.0);
}
`
// The socket's frame, rising out of the board as the contacts form
const WALL_V = `
uniform float uWallH;
varying vec3 vW;
varying vec3 vN;
${BEND}
void main() {
  vec3 q = position;
  q.y *= uWallH;
  vec3 p = bend(q);
  vN = normalize(mat3(modelMatrix) * (bend(q + normal * 0.05) - p));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const WALL_F = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
${LIGHT}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 col = vec3(0.025, 0.027, 0.032);
  float spec = pow(max(dot(N, normalize(uKey + V)), 0.0), 30.0) * 0.25;
  vec3 lit = col * (uFill + uKeyCol * max(dot(N, uKey), 0.0)) + uKeyCol * spec;
  float d = length(cameraPosition - vW) * 1000.0;
  gl_FragColor = vec4(mix(lit, uFog, 1.0 - exp(-d * uFogD)), 1.0);
}
`

// One fibre: rings of `sides` around it at points along it, closer together where a contact
// bends at its foot and rounds off at its tip
const strandGeometry = (along, sides) => {
  const g = new THREE.InstancedBufferGeometry()
  const steps = along.length - 1
  const s = []
  const a = []
  const index = []
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= sides; j++) {
      s.push(along[i])
      a.push((j / sides) * Math.PI * 2)
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const k = i * (sides + 1) + j
      index.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2)
    }
  }
  g.setIndex(index)
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(s.length * 3), 3))
  g.setAttribute('aS', new THREE.Float32BufferAttribute(s, 1))
  g.setAttribute('aA', new THREE.Float32BufferAttribute(a, 1))
  return g
}
const instances = (g, list) => {
  const root = new Float32Array(list.length * 3)
  const seed = new Float32Array(list.length * 4)
  const pin = new Float32Array(list.length * 4)
  list.forEach((f, i) => {
    root.set(f.root, i * 3)
    seed.set(f.seed, i * 4)
    pin.set(f.pin || [0, 0, 0, 0], i * 4)
  })
  g.setAttribute('iRoot', new THREE.InstancedBufferAttribute(root, 3))
  g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 4))
  g.setAttribute('iPin', new THREE.InstancedBufferAttribute(pin, 4))
  g.instanceCount = list.length
}

export function createFelt(ctx, { pcb, ao }) {
  const root = new THREE.Group()
  const rand = random(7)
  const mobile = ctx.quality.mobile
  const seed4 = () => [rand(), rand(), rand(), rand()]

  // The contacts come first: one fibre for each, rooted a little off its place on the grid
  const dense = []
  const half = ((SOCKET.n - 1) / 2) * SOCKET.pitch * 1000
  for (let i = 0; i < SOCKET.n; i++) {
    for (let j = 0; j < SOCKET.n; j++) {
      const x = BEND_X - half + i * SOCKET.pitch * 1000
      const z = PIN_Z - half + j * SOCKET.pitch * 1000
      dense.push({ root: [x + (rand() - 0.5) * 0.5, z + (rand() - 0.5) * 0.5, 1.6 + rand() * 1.8], seed: seed4(), pin: [x, z, 1, 0] })
    }
  }
  const PINS = dense.length
  // then the thick of the felt where the camera comes down and runs on through it
  const DENSE = PINS + (mobile ? 2800 : 12400)
  while (dense.length < DENSE) {
    const r = 34 * Math.sqrt(rand()) * (0.6 + 0.4 * rand())
    const a = rand() * Math.PI * 2
    dense.push({ root: [BEND_X - 10 + Math.cos(a) * r * 1.2, PIN_Z + Math.sin(a) * r * 0.8, 1.6 + rand() * 1.8], seed: seed4() })
  }
  // and a coat over the whole ball, evenly over its surface
  const coat = []
  const COAT = mobile ? 10000 : 36000
  for (let i = 0; i < COAT; i++) {
    const lon = (rand() * 2 - 1) * Math.PI
    const lat = Math.asin(rand() * 2 - 1) * 0.995
    coat.push({ root: [BEND_X + lon * BALL, lat * BALL, 1.3 + rand() * 1.4], seed: seed4() })
  }

  const shared = {
    uMorph: { value: 0 },
    uHair: { value: 0 },
    uBoardK: { value: 0 },
    uMorphC: { value: new THREE.Vector2(BEND_X, PIN_Z) },
    uCurve: { value: 1 },
    uTime: { value: 0 },
    uKey: { value: new THREE.Vector3() },
    uKeyCol: { value: new THREE.Color() },
    uFill: { value: new THREE.Color() },
    uFog: { value: new THREE.Color() },
    uFogD: { value: 0 },
    uFelt: { value: new THREE.Color('#cddc39') },
    uSeamCol: { value: new THREE.Color('#f2f1e8') },
    uGold: { value: new THREE.Color('#e2b65c') },
    uBoard: { value: pcb },
    uAO: { value: ao },
    uMap: { value: new THREE.Vector4(FELT_ORIGIN[0], FELT_ORIGIN[2], BOARD, 0) },
    uClip: { value: 0 },
    uWallH: { value: 0 },
  }
  const strandMat = new THREE.ShaderMaterial({ vertexShader: STRAND_V, fragmentShader: STRAND_F, uniforms: shared })
  const denseGeo = strandGeometry([0, 0.1, 0.19, 0.21, 0.32, 0.46, 0.6, 0.72, 0.8, 0.85, 0.9, 0.94, 0.97, 1], mobile ? 6 : 9)
  instances(denseGeo, dense)
  const denseMesh = new THREE.Mesh(denseGeo, strandMat)
  denseMesh.frustumCulled = false
  // seen from further off, so fewer points do
  const coatGeo = strandGeometry([0, 0.3, 0.6, 0.85, 1], 3)
  instances(coatGeo, coat)
  const coatMesh = new THREE.Mesh(coatGeo, strandMat)
  coatMesh.frustumCulled = false
  root.add(denseMesh, coatMesh)

  // The sheet: a whole sphere's worth of felt, longitude by latitude, a hair over at the poles
  const W = Math.PI * 2 * BALL
  const D = Math.PI * BALL + 0.6
  const seg = mobile ? [180, 90] : [320, 160]
  const baseGeo = new THREE.PlaneGeometry(W, D, ...seg).rotateX(-Math.PI / 2).translate(BEND_X, 0, 0)
  const base = new THREE.Mesh(baseGeo, new THREE.ShaderMaterial({ vertexShader: BASE_V, fragmentShader: BASE_F, uniforms: shared }))
  base.frustumCulled = false
  root.add(base)

  // The other balls on the court: the same felt and light, always round, with a lighter coat
  const still = { ...shared, uCurve: { value: 1 }, uMorph: { value: 0 }, uHair: { value: 0 }, uBoardK: { value: 0 }, uClip: { value: 0 } }
  const skinGeo = new THREE.PlaneGeometry(W, D, mobile ? 48 : 72, mobile ? 24 : 36).rotateX(-Math.PI / 2).translate(BEND_X, 0, 0)
  const skinMat = new THREE.ShaderMaterial({ vertexShader: BASE_V, fragmentShader: BASE_F, uniforms: still })
  const furMat = new THREE.ShaderMaterial({ vertexShader: STRAND_V, fragmentShader: STRAND_F, uniforms: still })
  const furGeo = strandGeometry([0, 0.3, 0.6, 0.85, 1], 3)
  instances(furGeo, coat.slice(0, mobile ? 2500 : 7000))
  const others = []
  const makeBall = () => {
    const g = new THREE.Group()
    const inner = new THREE.Group()
    inner.position.set(-BEND_X / 1000, BALL / 1000, 0)
    inner.scale.setScalar(0.001)
    const skin = new THREE.Mesh(skinGeo, skinMat)
    const fur = new THREE.Mesh(furGeo, furMat)
    skin.frustumCulled = fur.frustumCulled = false
    inner.add(skin, fur)
    g.add(inner)
    others.push({ g, fur })
    return g
  }
  // Fur is only drawn on the balls near enough for it to show
  const nearBalls = (camera) => {
    for (const { g, fur } of others) fur.visible = g.visible && g.getWorldPosition(_v).distanceTo(camera.position) < 1.2
  }
  const _v = new THREE.Vector3()

  // The socket's frame, a unit tall, in the sheet's own millimetres
  const fw = FRAME.w * 1000
  const t = FRAME.wall * 1000
  const wallGeo = []
  for (const [x, z, w, d] of [[0, -(fw - t) / 2, fw, t], [0, (fw - t) / 2, fw, t], [-(fw - t) / 2, 0, t, fw - 2 * t], [(fw - t) / 2, 0, t, fw - 2 * t]]) {
    wallGeo.push(new THREE.BoxGeometry(w, 1, d, Math.ceil(w / 2), 1, Math.ceil(d / 2)).translate(BEND_X + x, 0.5, PIN_Z + z))
  }
  const walls = new THREE.Group()
  for (const g of wallGeo) walls.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: WALL_V, fragmentShader: WALL_F, uniforms: shared })))
  walls.children.forEach((m) => (m.frustumCulled = false))
  root.add(walls)
  root.scale.setScalar(0.001)

  // Light: the court's sun on the ball, the bench light on the board, the evening sun after
  const court = { dir: new THREE.Vector3(-0.45, 0.82, 0.36).normalize(), col: new THREE.Color(1.15, 1.08, 0.98), fill: new THREE.Color(0.34, 0.36, 0.4) }
  const bench = { dir: new THREE.Vector3(-0.5, 0.8, 0.35).normalize(), col: new THREE.Color(0.95, 0.99, 1.08), fill: new THREE.Color(0.3, 0.33, 0.38) }
  const warmSun = { dir: new THREE.Vector3(-0.2, 0.32, 0.92).normalize(), col: new THREE.Color(1.05, 0.86, 0.62), fill: new THREE.Color(0.42, 0.4, 0.38) }
  const fogCol = new THREE.Color()

  // Where it is placed: on the court it is the ball; on the board it is clipped to the board, and
  // of its fibres only the contacts are left
  const place = ({ onBoard, near = false, seen = false }) => {
    shared.uClip.value = onBoard ? 1 : 0
    denseGeo.instanceCount = onBoard ? PINS : dense.length
    // Fibres are far finer than a pixel until the camera is close
    denseMesh.visible = onBoard || near
    coatMesh.visible = !onBoard && seen
    walls.visible = shared.uWallH.value > 0.002
  }

  const update = (p, { warm = 0 } = {}) => {
    const { curve, hair, morph, board, fog } = feltTimeline(p)
    shared.uCurve.value = curve
    shared.uMorph.value = morph
    shared.uHair.value = hair
    shared.uBoardK.value = board
    shared.uWallH.value = FRAME.h * 1000 * smooth(0.55, 1, morph)
    walls.visible = shared.uWallH.value > 0.002
    shared.uTime.value = ctx.time / 1000
    const k = smooth(0.86, 1.06, p)
    shared.uKey.value.copy(court.dir).lerp(bench.dir, k).lerp(warmSun.dir, warm).normalize()
    shared.uKeyCol.value.copy(court.col).lerp(bench.col, k).lerp(warmSun.col, warm)
    shared.uFill.value.copy(court.fill).lerp(bench.fill, k).lerp(warmSun.fill, warm)
    if (ctx.dark) {
      shared.uKeyCol.value.multiplyScalar(lerp(0.75, 0.9, k))
      shared.uFill.value.multiplyScalar(0.7)
    }
    shared.uFog.value.copy(fogCol)
    shared.uFogD.value = 0.012 * fog
  }

  const theme = () => fogCol.set(ctx.dark ? '#1b2633' : '#dfe7ea')

  return { root, update, place, theme, makeBall, nearBalls }
}
