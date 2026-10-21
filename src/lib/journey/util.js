import * as THREE from 'three'

export const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const ease = (x) => x * x * (3 - 2 * x)
export const smooth = (a, b, v) => ease(clamp01((v - a) / (b - a)))
export const window4 = (p, a, b, c, d) => smooth(a, b, p) * (1 - smooth(c, d, p))
export const lerp = (a, b, k) => a + (b - a) * k

export function random(seed = 1) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Monotone cubic through [t, value | value[]] keys: never overshoots a key, and never stops dead
// between two keys heading the same way
export function spline(keys) {
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
  const out = new Array(series.length).fill(0)
  return (p) => {
    let i = 0
    if (p <= xs[0]) i = -1
    else if (p >= xs[n - 1]) i = n
    else while (xs[i + 1] < p) i++
    for (let d = 0; d < series.length; d++) {
      const y = series[d]
      const m = slopes[d]
      if (i < 0) out[d] = y[0]
      else if (i >= n) out[d] = y[n - 1]
      else {
        const h = xs[i + 1] - xs[i]
        const t = (p - xs[i]) / h
        const t2 = t * t
        const t3 = t2 * t
        out[d] = (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * y[i + 1] + (t3 - t2) * h * m[i + 1]
      }
    }
    return multi ? out : out[0]
  }
}

// A camera rig keyed on [t, [tx, ty, tz, log distance, yaw, pitch, fov, aperture]]: it orbits its
// target, so distance can change by orders of magnitude while direction stays steady
export function rig(keys) {
  const s = spline(keys.map(([t, [tx, ty, tz, d, yaw, pitch, fov, ap]]) => [t, [tx, ty, tz, Math.log(d), yaw, pitch, fov, ap ?? 0]]))
  const pose = { target: new THREE.Vector3(), position: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), distance: 1, fov: 40, aperture: 0 }
  return (t) => {
    const [tx, ty, tz, ld, yaw, pitch, fov, ap] = s(t)
    const d = Math.exp(ld)
    pose.target.set(tx, ty, tz)
    const cp = Math.cos(pitch)
    const sp = Math.sin(pitch)
    pose.position.set(tx + Math.sin(yaw) * cp * d, ty + sp * d, tz + Math.cos(yaw) * cp * d)
    pose.up.set(-Math.sin(yaw) * sp, cp, -Math.cos(yaw) * sp)
    pose.distance = d
    pose.fov = fov
    pose.aperture = ap
    return pose
  }
}

export function applyPose(camera, pose, near = 0.02, far = 4e4) {
  camera.position.copy(pose.position)
  camera.up.copy(pose.up)
  camera.lookAt(pose.target)
  camera.fov = pose.fov
  camera.near = pose.distance * near
  camera.far = pose.distance * far
  camera.updateProjectionMatrix()
}

// Canvas-painted textures, made once
export function canvasTexture(size, paint, { repeat = 1, srgb = true } = {}) {
  const [w, h] = Array.isArray(size) ? size : [size, size]
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  paint(g, w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Speckle: many small dots of varied tone on a base, for grain, clay and felt
export function speckle(g, w, h, base, dots, rand) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  for (const [count, size, colors, alpha] of dots) {
    for (let i = 0; i < count; i++) {
      g.globalAlpha = alpha * (0.4 + 0.6 * rand())
      g.fillStyle = colors[Math.floor(rand() * colors.length)]
      const r = size * (0.4 + rand())
      g.beginPath()
      g.arc(rand() * w, rand() * h, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.globalAlpha = 1
}

export const lum = (hex) => {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}
