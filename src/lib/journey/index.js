import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { spline, lum, smooth } from './util'
import { createBoard } from './board'
import { createFelt } from './felt'
import { createCourt } from './court'
import { createWorld } from './world'

// The journey after the city: one renderer, one composite pass, two sets in scene time. Nothing
// fades between them. Each change is a cut on a frame both sides draw the same: the city's court
// and this court, flat and pixel for pixel; the ball's sheet of felt, once it has become circuit
// board, filling the frame on the court and on the device; and the page's own contour map, which
// the city turns into before the page takes over again.
export const CUTS = [0.36, 1.02, 3.7]

// Exposure, warmth, vignette, and how much of the image is shown as drawn rather than graded
const GRADE = spline([
  [0.36, [1.25, 0.55, 0, 1]],
  [0.44, [1.25, 0.55, 1, 0]],
  [0.6, [1.2, 0.56, 1, 0]],
  [0.86, [1.12, 0.58, 1, 0]],
  [1.0, [1.2, 0.34, 1, 0]],
  [1.24, [1.15, 0.32, 1, 0]],
  [1.8, [1.15, 0.3, 1, 0]],
  [2.0, [1.1, 0.38, 1, 0]],
  [2.3, [1.12, 0.64, 1, 0]],
  [2.9, [1.1, 0.56, 1, 0]],
  [3.1, [1.05, 0.5, 1, 0]],
  [3.3, [1.0, 0.5, 1, 0]],
  [3.4, [1.15, 0.26, 1, 0]],
  [3.5, [1.1, 0.3, 1, 0]],
  [3.56, [1.05, 0.4, 1, 0]],
  [3.68, [1.0, 0.5, 0, 0]],
])

const VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA; uniform sampler2D dA; uniform sampler2D tBloom; uniform float uBloom;
uniform vec4 uDof; uniform vec4 uGrade; uniform float uRawAlpha;
uniform vec2 uRes; uniform vec4 uBand; uniform vec3 uPaper; uniform float uTime; uniform float uMaxBlur;

float linear(float d, vec4 dof) {
  float z = d * 2.0 - 1.0;
  return 2.0 * dof.z * dof.w / (dof.w + dof.z - z * (dof.w - dof.z));
}
vec3 aces(vec3 x) {
  x *= 0.6;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// Depth of field by gathering a spiral of taps, as wide as the circle of confusion at this pixel
vec3 focused(vec3 c) {
  if (uDof.y <= 0.0) return c;
  float z = linear(texture2D(dA, vUv).r, uDof);
  float coc = clamp(abs(z - uDof.x) / max(z, 1e-6) * uDof.y, 0.0, 1.0) * uMaxBlur;
  if (coc < 0.5) return c;
  vec3 sum = c; float w = 1.0;
  for (int i = 0; i < 20; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / 20.0) * coc;
    float a = fi * 2.39996;
    vec2 o = vec2(cos(a), sin(a)) * r / uRes;
    vec3 s = texture2D(tA, vUv + o).rgb;
    float b = 1.0 + 2.0 * smoothstep(0.8, 3.0, dot(s, vec3(0.333)));
    sum += s * b; w += b;
  }
  return sum / w;
}
void main() {
  vec4 src = texture2D(tA, vUv);
  vec3 raw = focused(src.rgb);
  vec3 c = aces((raw + texture2D(tBloom, vUv).rgb * uBloom) * uGrade.x);
  // warm or cool the light a touch, keeping its brightness
  vec3 tint = mix(vec3(0.94, 0.99, 1.07), vec3(1.07, 1.0, 0.9), uGrade.y);
  c = c * mix(vec3(1.0), tint, abs(uGrade.y - 0.5) * 2.0);
  // drawn: colours already final, as the page draws them; materials say so in their alpha
  float drawn = max(uGrade.w, uRawAlpha * clamp(1.0 - src.a, 0.0, 1.0));
  vec3 col = mix(c, raw, drawn);
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.22 * uGrade.z * smoothstep(0.35, 0.85, length(q * vec2(uRes.x / uRes.y, 1.0)) / 1.1);
  col = toSrgb(clamp(col, 0.0, 1.0));
  col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.008 * (1.0 - drawn);
  float y = (1.0 - vUv.y) * uRes.y;
  float band = clamp((y - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);
  col = mix(uPaper, col, mix(1.0, band, uBand.z));
  gl_FragColor = vec4(col, 1.0);
}
`

// Bloom: the frame's highlights, halved down a chain and blurred back up (the dual filter), so
// only what is brighter than white spills light around it
const DOWN = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst;
vec3 bright(vec3 c) {
  if (uFirst < 0.5) return c;
  float l = max(c.r, max(c.g, c.b));
  float k = clamp(l - 1.25, 0.0, 0.6);
  return c * max(k * k / 1.2, l - 1.55) / max(l, 1e-4);
}
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = bright(texture2D(tSrc, vUv).rgb) * 4.0;
  s += bright(texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb) + bright(texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb);
  s += bright(texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb) + bright(texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb);
  gl_FragColor = vec4(s / 8.0, 1.0);
}
`
const UP = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc; uniform vec2 uTexel;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += (texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb + texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb) * 2.0;
  s += (texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb + texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb) * 2.0;
  gl_FragColor = vec4(s / 12.0, 1.0);
}
`

export function createJourney(canvas, context) {
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 600 || navigator.maxTouchPoints > 0
  const quality = { mobile, scale: mobile ? 1.25 : 1.5, samples: mobile ? 0 : 4 }

  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const target = (w, h, samples) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples })
    rt.depthTexture = new THREE.DepthTexture(w, h)
    rt.depthTexture.type = THREE.UnsignedIntType
    return rt
  }
  const rt = target(4, 4, quality.samples)
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tA: { value: rt.texture },
        dA: { value: rt.depthTexture },
        uDof: { value: new THREE.Vector4() },
        uGrade: { value: new THREE.Vector4(1, 0.5, 0, 0) },
        uRawAlpha: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uBand: { value: new THREE.Vector4(0, 1, 1, 0) },
        uPaper: { value: new THREE.Vector3(1, 1, 1) },
        uTime: { value: 0 },
        uMaxBlur: { value: 12 },
      },
    }),
  )
  quad.frustumCulled = false
  const post = new THREE.Scene()
  post.add(quad)
  const postCam = new THREE.Camera()
  const u = quad.material.uniforms

  const LEVELS = quality.mobile ? 4 : 5
  const chain = Array.from({ length: LEVELS }, () => new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }))
  const downMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: DOWN, depthTest: false, depthWrite: false, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } } })
  const upMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: UP, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } } })
  const pass = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), downMat)
  pass.frustumCulled = false
  const passScene = new THREE.Scene()
  passScene.add(pass)
  u.tBloom = { value: chain[0].texture }
  u.uBloom = { value: 0.45 }
  const bloom = () => {
    let src = rt.texture
    let w = rt.width
    let h = rt.height
    pass.material = downMat
    chain.forEach((t, i) => {
      downMat.uniforms.tSrc.value = src
      downMat.uniforms.uTexel.value.set(1 / w, 1 / h)
      downMat.uniforms.uFirst.value = i === 0 ? 1 : 0
      renderer.setRenderTarget(t)
      renderer.render(passScene, postCam)
      src = t.texture
      w = t.width
      h = t.height
    })
    pass.material = upMat
    for (let i = LEVELS - 1; i > 0; i--) {
      upMat.uniforms.tSrc.value = chain[i].texture
      upMat.uniforms.uTexel.value.set(1 / chain[i].width, 1 / chain[i].height)
      renderer.setRenderTarget(chain[i - 1])
      renderer.autoClear = false
      renderer.render(passScene, postCam)
      renderer.autoClear = true
    }
  }

  const ctx = { W: 1, H: 1, pr: 1, portrait: false, handoff: null, frame: null, quality, env, palette: null, colors: null, dark: false, time: 0, pointer: { x: 0, y: 0, s: 0 } }
  const board = createBoard(ctx)
  const felt = createFelt(ctx, board)
  const court = createCourt(ctx, felt)
  const world = createWorld(ctx, board, felt)
  const sets = [court, world]

  const resize = (W, H, dpr, frame, handoff) => {
    ctx.W = W
    ctx.H = H
    ctx.portrait = H > W
    ctx.frame = frame
    ctx.handoff = handoff
    const pr = Math.min(dpr, quality.scale)
    ctx.pr = pr
    renderer.setPixelRatio(pr)
    renderer.setSize(W, H, false)
    const w = Math.round(W * pr)
    const h = Math.round(H * pr)
    rt.setSize(w, h)
    chain.forEach((t, i) => t.setSize(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1))))
    u.uRes.value.set(w, h)
    u.uMaxBlur.value = (quality.mobile ? 7 : 12) * pr
    u.uBand.value.set(frame.from * pr, frame.to * pr, 1, 0)
    for (const s of sets) s.resize?.()
  }

  const theme = (colors) => {
    const paper = new THREE.Color(colors.paper)
    ctx.colors = colors
    ctx.palette = {
      paper,
      ink: new THREE.Color(colors.ink),
      signal: new THREE.Color(colors.signal),
      contour: new THREE.Color(colors.contour),
      strong: new THREE.Color(colors['contour-strong']),
      land: new THREE.Color(colors['map-land']),
    }
    ctx.dark = lum(colors.paper) < 0.3
    const s = paper.clone().convertLinearToSRGB()
    u.uPaper.value.set(s.r, s.g, s.b)
    felt.theme()
    for (const set of sets) set.theme?.()
  }

  const draw = (set, p, out) => {
    const look = set.update(p)
    const cam = set.camera
    cam.aspect = ctx.W / ctx.H
    // Tall screens see more of each scene from the same place; the court's opening keeps its exact
    // view so it meets the city pixel for pixel
    const widen = set === court ? Math.min(1, Math.max(0, (p - 0.44) / 0.1)) : 1
    if (widen > 0 && cam.aspect < 1) {
      const k = 1 + (Math.min(1.7, 0.78 / cam.aspect) - 1) * widen
      cam.fov = (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * k) * 180) / Math.PI
    }
    const f = ctx.frame
    // Keep the subject centred in the space below the captions, as the city view does
    if (f) cam.setViewOffset(ctx.W, ctx.H, 0, -(f.cy - ctx.H / 2), ctx.W, ctx.H)
    cam.updateProjectionMatrix()
    renderer.setRenderTarget(out)
    renderer.render(set.scene, cam)
    return look
  }

  const at = (p) => (p < CUTS[1] ? court : world)

  // p is scene time; returns whether the canvas is the picture now
  // run is how far along the run through the ball's fuzz the scroll is
  const render = (p, time, { band = 1, pointer, run = p < 0.85 ? 0 : 1 } = {}) => {
    if (p < CUTS[0] || p >= CUTS[2] || !ctx.palette) return 0
    ctx.time = time
    ctx.run = run
    if (pointer) Object.assign(ctx.pointer, pointer)
    const set = at(p)
    const look = draw(set, p, rt)
    const cam = set.camera
    u.uDof.value.set(look.focus ?? 1, look.aperture ?? 0, cam.near, cam.far)
    const [exposure, warm, vignette, raw] = GRADE(p)
    u.uGrade.value.set(exposure, warm, vignette, raw)
    u.uRawAlpha.value = look.rawAlpha ?? 0
    u.uTime.value = time / 1000
    // Under the page's map there is no caption band to keep clear: the page has none
    u.uBand.value.z = band * (1 - (look.site ?? 0))
    // no bloom on frames drawn as the page draws them
    u.uBloom.value = 0.45 * (1 - raw) * (1 - smooth(3.42, 3.5, p))
    if (u.uBloom.value > 0) bloom()
    renderer.setRenderTarget(null)
    renderer.render(post, postCam)
    return 1
  }

  // Before the journey is reached: compile every program and draw each set once off screen, a step
  // at a time when the page is idle, so nothing has to be built mid-scroll
  let warming = true
  const small = target(64, 40, 0)
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 60))
  const steps = [
    async () => {
      court.update(0.7)
      await renderer.compileAsync(court.scene, court.camera)
    },
    async () => {
      world.update(1.1)
      await renderer.compileAsync(world.scene, world.camera)
    },
    ...[0.37, 0.5, 0.8, 0.95].map((p) => () => draw(court, p, small)),
    ...[1.05, 1.6, 1.95, 2.4, 2.75, 2.95, 3.2, 3.42, 3.62].map((p) => () => draw(world, p, small)),
  ]
  const warm = async () => {
    for (const step of steps) {
      if (!warming) return
      while (warming && (!ctx.palette || !ctx.frame)) await new Promise((r) => setTimeout(r, 200))
      await new Promise((r) => idle(r))
      if (!warming) return
      await step()
    }
    renderer.setRenderTarget(null)
  }
  warm()

  const dispose = () => {
    warming = false
    rt.dispose()
    small.dispose()
    chain.forEach((t) => t.dispose())
    env.dispose()
    renderer.dispose()
  }

  return { resize, theme, render, dispose }
}
