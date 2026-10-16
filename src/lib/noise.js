const GRAD = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
]
const F3 = 1 / 3
const G3 = 1 / 6

export function createNoise3D(seed = 1) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = seed
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  const mod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    mod12[i] = perm[i] % 12
  }

  const corner = (gi, x, y, z) => {
    let t = 0.6 - x * x - y * y - z * z
    if (t < 0) return 0
    const g = GRAD[gi]
    t *= t
    return t * t * (g[0] * x + g[1] * y + g[2] * z)
  }

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const z0 = zin - (k - t)

    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1 }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1 }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1 }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1 }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0 }
    }

    const ii = i & 255
    const jj = j & 255
    const kk = k & 255

    const n0 = corner(mod12[ii + perm[jj + perm[kk]]], x0, y0, z0)
    const n1 = corner(
      mod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]],
      x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3,
    )
    const n2 = corner(
      mod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]],
      x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3,
    )
    const n3 = corner(
      mod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]],
      x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3,
    )
    return 32 * (n0 + n1 + n2 + n3)
  }
}
