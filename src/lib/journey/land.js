import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createNoise3D } from '../noise'
import { random } from './util'

// Seattle around the house, in metres, with the house's floor at y = -0.75 on Queen Anne's
// south-west slope. Everything is placed from its real latitude and longitude: the view window
// faces +x, bearing 142°, south-east, down over the Space Needle and downtown to Rainier, with
// Elliott Bay and the Sound to the right and Lake Union and Lake Washington to the left. Shorelines
// are the real ones, simplified; the mountains are brought nearer than they are.
//
// Two fronts cross it at the end. The digital twin spreads out from the house: the ground goes to
// a dark model with its contours and a grid, and the trees go down into it. Then the page's own map
// spreads out from the middle of the view: the city flattens, and its contour lines bend into the
// page's, which are worked out here from the same noise and the same screen position as the page
// draws them, so that when the page takes over nothing moves.
const ORIGIN = [47.6295, -122.3645]
export const BEARING = (142 * Math.PI) / 180
const M_LAT = 111320
const M_LON = 111320 * Math.cos((ORIGIN[0] * Math.PI) / 180)
const FX = Math.sin(BEARING)
const FN = Math.cos(BEARING)
// A place, by latitude and longitude, as [x, z] here
export const geo = (lat, lon) => {
  const e = (lon - ORIGIN[1]) * M_LON
  const n = (lat - ORIGIN[0]) * M_LAT
  return [e * FX + n * FN, e * FN - n * FX]
}
// and back to metres east and north of the house
const toEN = (x, z) => [x * FX + z * FN, x * FN - z * FX]
// Turn about y that lays a box's x axis along a compass bearing, in degrees
const facing = (deg) => BEARING - (deg * Math.PI) / 180
export const DOWNTOWN = geo(47.6065, -122.3335)
export const NEEDLE = geo(47.6205, -122.3493)
// Rainier on its own bearing, at 60 km rather than 97
const RAINIER = (() => {
  const [x, z] = geo(46.8523, -121.7603)
  const k = 60000 / Math.hypot(x, z)
  return [x * k, z * k]
})()
// The page's contour levels (see Terrain.jsx)
const PAGE = { min: -0.95, step: (1.35 + 0.95) / 16, levels: 16 }

// Value noise for the terrain, deterministic
const perm = (() => {
  const r = random(99)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  return [...p, ...p]
})()
const grad = (h) => (h & 255) / 255
const vnoise = (x, z) => {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = grad(perm[(perm[xi & 255] + zi) & 255])
  const b = grad(perm[(perm[(xi + 1) & 255] + zi) & 255])
  const c = grad(perm[(perm[xi & 255] + zi + 1) & 255])
  const d = grad(perm[(perm[(xi + 1) & 255] + zi + 1) & 255])
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, z, n = 5) => {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < n; i++) {
    s += a * (vnoise(x * f, z * f) - 0.5)
    a *= 0.5
    f *= 2.03
  }
  return s
}
const ridge = (x, z, n = 6) => {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < n; i++) {
    s += a * (1 - Math.abs(vnoise(x * f, z * f) * 2 - 1)) ** 2
    a *= 0.5
    f *= 2.1
  }
  return s
}
const sm = (a, b, v) => {
  const x = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
// Shapes by latitude and longitude, into this frame, with their bounds
const shape = (pts) => {
  const p = pts.map(([la, lo]) => geo(la, lo))
  const xs = p.map((q) => q[0])
  const zs = p.map((q) => q[1])
  return { p, box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] }
}
// Signed distance to a closed shape, negative inside; far outside its bounds only roughly
const sdShape = ({ p, box }, x, z) => {
  const ox = Math.max(box[0] - x, 0, x - box[1])
  const oz = Math.max(box[2] - z, 0, z - box[3])
  if (ox > 600 || oz > 600) return Math.hypot(ox, oz)
  let d = Infinity
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j]
    const [bx, bz] = p[i]
    const ex = bx - ax
    const ez = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)))
    d = Math.min(d, (x - ax - ex * t) ** 2 + (z - az - ez * t) ** 2)
    if (az > z !== bz > z && x < ax + ((z - az) * ex) / ez) inside = !inside
  }
  return inside ? -Math.sqrt(d) : Math.sqrt(d)
}
// Distance from a channel's middle line, less its half width
const sdChannel = ({ p, box }, half, x, z) => {
  if (x < box[0] - half - 600 || x > box[1] + half + 600 || z < box[2] - half - 600 || z > box[3] + half + 600) return 1e4
  let d = Infinity
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = p[i - 1]
    const [bx, bz] = p[i]
    const ex = bx - ax
    const ez = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)))
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t))
  }
  return d - half
}

// Puget Sound and Elliott Bay: the city's shore from Richmond Beach round Magnolia, the downtown
// piers, Harbor Island, Duwamish Head and Alki, down to Des Moines; closed across the Sound along
// Bainbridge Island
const SOUND = shape([
  [47.8, -122.395], [47.77, -122.385], [47.72, -122.381], [47.69, -122.405], [47.676, -122.406], [47.668, -122.399],
  [47.662, -122.418], [47.6605, -122.436], [47.65, -122.429], [47.64, -122.419], [47.632, -122.406], [47.6285, -122.393],
  [47.6305, -122.384], [47.6235, -122.379], [47.627, -122.3725], [47.6235, -122.369], [47.6185, -122.3612], [47.6165, -122.356],
  [47.6117, -122.3497], [47.6061, -122.3425], [47.6025, -122.3386], [47.598, -122.3377], [47.5925, -122.342], [47.5895, -122.343],
  [47.5885, -122.355], [47.5862, -122.3625], [47.5845, -122.369], [47.591, -122.378], [47.5955, -122.3865], [47.5845, -122.405],
  [47.576, -122.4205], [47.565, -122.41], [47.531, -122.398], [47.523, -122.395], [47.48, -122.37], [47.4, -122.33],
  [47.4, -122.5], [47.585, -122.497], [47.62, -122.493], [47.7, -122.5], [47.8, -122.48],
])
const LAKE_UNION = shape([
  [47.6465, -122.3378], [47.648, -122.333], [47.6475, -122.3255], [47.6405, -122.3265], [47.633, -122.3295],
  [47.6285, -122.332], [47.627, -122.3365], [47.63, -122.341], [47.638, -122.3437], [47.646, -122.3447],
])
const GREEN_LAKE = shape([
  [47.6865, -122.338], [47.684, -122.331], [47.678, -122.33], [47.6735, -122.336], [47.6745, -122.345], [47.68, -122.349], [47.6855, -122.346],
])
const WASHINGTON = shape([
  [47.757, -122.262], [47.735, -122.276], [47.705, -122.272], [47.69, -122.262], [47.683, -122.25], [47.676, -122.262],
  [47.665, -122.272], [47.655, -122.282], [47.646, -122.283], [47.636, -122.279], [47.624, -122.282], [47.61, -122.284],
  [47.598, -122.284], [47.585, -122.284], [47.57, -122.272], [47.56, -122.258], [47.548, -122.265], [47.53, -122.262],
  [47.512, -122.25], [47.502, -122.215], [47.505, -122.2], [47.53, -122.198], [47.56, -122.195], [47.585, -122.2],
  [47.6, -122.208], [47.615, -122.215], [47.63, -122.225], [47.648, -122.225], [47.665, -122.212], [47.68, -122.208],
  [47.7, -122.222], [47.72, -122.232], [47.745, -122.25], [47.758, -122.255],
])
const MERCER = shape([
  [47.592, -122.235], [47.588, -122.212], [47.56, -122.212], [47.533, -122.22], [47.528, -122.232], [47.548, -122.245], [47.575, -122.245],
])
// The Ship Canal from Lake Union to the locks, the cut through to Lake Washington, the Duwamish
const CHANNELS = [
  [shape([[47.647, -122.344], [47.6495, -122.35], [47.652, -122.36], [47.656, -122.371], [47.66, -122.38], [47.6655, -122.397], [47.668, -122.399]]), 55],
  [shape([[47.6475, -122.326], [47.6465, -122.318], [47.6455, -122.31], [47.647, -122.302], [47.65, -122.29], [47.652, -122.282]]), 110],
  [shape([[47.586, -122.352], [47.575, -122.355], [47.56, -122.34], [47.545, -122.325], [47.525, -122.31], [47.5, -122.29]]), 90],
]
// How far a place is from the water, metres; negative out on it
const coast = (x, z) => {
  let d = Math.min(sdShape(SOUND, x, z), sdShape(LAKE_UNION, x, z), sdShape(GREEN_LAKE, x, z), Math.max(sdShape(WASHINGTON, x, z), -sdShape(MERCER, x, z)))
  for (const [c, half] of CHANNELS) d = Math.min(d, sdChannel(c, half, x, z))
  return d + fbm(x / 500, z / 500) * 50
}
// How much of a place is under water, 0 to 1
export const water = (x, z) => 1 - sm(-25, 25, coast(x, z))

// The hills: [lat, lon, height, radius, steepness]. Queen Anne is a flat top with steep sides,
// the house on its south-west rim.
const HILLS = [
  [47.6375, -122.3575, 145, 1150, 4], // Queen Anne
  [47.646, -122.405, 110, 1400], // Magnolia
  [47.626, -122.316, 120, 1100], [47.638, -122.318, 115, 1000], // Capitol Hill
  [47.6075, -122.324, 90, 750], // First Hill
  [47.612, -122.296, 95, 1200], // Madrona and Leschi
  [47.575, -122.312, 100, 1300], [47.553, -122.304, 95, 1300], // Beacon Hill
  [47.575, -122.39, 140, 1700], [47.545, -122.376, 130, 2300], // West Seattle
  [47.672, -122.36, 95, 1500], [47.69, -122.382, 80, 1700], // Phinney Ridge, Ballard
  [47.659, -122.335, 60, 1200], [47.672, -122.3, 70, 1900], // Wallingford, the University
  [47.6, -122.165, 120, 4200], [47.56, -122.225, 70, 1500], // the Eastside, Mercer Island
  [47.64, -122.54, 80, 4200], [47.58, -122.65, 110, 9000], // Bainbridge, Kitsap
].map(([la, lo, h, r, k = 2]) => [...geo(la, lo), h, r, k])
// Valley floors kept low: Interbay, SoDo, the Duwamish
const FLATS = [[47.64, -122.377, 600], [47.58, -122.335, 1300], [47.545, -122.325, 1100]].map(([la, lo, r]) => [...geo(la, lo), r])

// Rainier: a broad glaciated cone with a rounded summit dome, ridges running down between its
// glaciers, Little Tahoma on its eastern shoulder, and foothills around its base
function rainier(x, z) {
  const dx = x - RAINIER[0]
  const dz = z - RAINIER[1]
  const r = Math.hypot(dx, dz)
  if (r > 40000) return 0
  const a = Math.atan2(dz, dx)
  const ribs = 1 + (0.06 * Math.sin(a * 7 + 1.3) + 0.045 * Math.sin(a * 12 + 0.4) + 0.03 * Math.sin(a * 19 + 2.1)) * sm(900, 5000, r)
  const body = 4450 * Math.exp(-((r / 6900) ** 1.8)) * ribs
  const tahoma = 650 * Math.exp(-((Math.hypot(dx + 1500, dz + 2800) / 1500) ** 2))
  const foot = 900 * Math.exp(-((r / 20000) ** 2)) * (0.75 + 0.5 * (ridge(x / 4500, z / 4500) - 0.3))
  return body + tahoma + foot + 120 * fbm(x / 1800, z / 1800) * sm(1500, 8000, r)
}

// Height above the water, in metres, before the lawn is levelled
function natural(x, z) {
  const d = coast(x, z)
  const [e, n] = toEN(x, z)
  let flat = 1
  for (const [fx, fz, r] of FLATS) flat *= 1 - 0.85 * Math.exp(-((Math.hypot(x - fx, z - fz) / r) ** 2))
  // the ground comes up off the shore, rolling, and rises into the hills
  const land = sm(-40, 500, d)
  let h = 3 + 26 * land * (0.55 + fbm(x / 1300, z / 1300)) * flat
  // Queen Anne falls away steeply just past the house's terrace
  const face = 1 - 0.55 * sm(40, 420, x) * Math.exp(-((z / 1200) ** 2))
  HILLS.forEach(([hx, hz, hh, r, k], i) => {
    h += hh * Math.exp(-((Math.hypot(x - hx, z - hz) / r) ** k)) * sm(-60, 320, d) * (0.4 + 0.6 * flat) * (i === 0 ? face : 1)
  })
  h += rainier(x, z)
  // the Cascades out east, the Olympics across the Sound to the west
  h += 2100 * sm(55000, 85000, e) * (1 - sm(140000, 170000, e)) * ridge(e / 9000, n / 9000)
  h += 2000 * sm(-50000, -75000, e) * (1 - sm(-125000, -145000, e)) * sm(-40000, 0, n) * (1 - sm(70000, 90000, n)) * ridge(e / 8000 + 3, n / 8000)
  const w = 1 - sm(-25, 25, d)
  return h * (1 - w) + -20 * w
}
// The lawn is levelled at the hill's own height there, and the water sits wherever that puts it,
// with the ground just under the house floor
const TOP = natural(0, 0)
export const SEA = -0.85 - TOP
const relief = (x, z) => TOP + (natural(x, z) - TOP) * sm(22, 46, Math.hypot(x, z))
export const heightAt = (x, z) => SEA + relief(x, z)
// Where the city is which: downtown, its old brick south end, South Lake Union, SoDo's warehouses
const ZONES = {
  downtown: shape([[47.6175, -122.356], [47.6118, -122.35], [47.6062, -122.3427], [47.6025, -122.3388], [47.5975, -122.3378], [47.5965, -122.329], [47.599, -122.3225], [47.6055, -122.3245], [47.611, -122.327], [47.616, -122.333], [47.6195, -122.34], [47.62, -122.35]]),
  pioneer: shape([[47.6028, -122.3392], [47.5975, -122.3378], [47.5965, -122.329], [47.6012, -122.3302]]),
  slu: shape([[47.6195, -122.34], [47.616, -122.333], [47.6185, -122.329], [47.6275, -122.33], [47.628, -122.342]]),
  sodo: shape([[47.5965, -122.3375], [47.5965, -122.3255], [47.556, -122.32], [47.556, -122.344], [47.586, -122.346]]),
}
const inZone = (name, x, z) => sdShape(ZONES[name], x, z) < 0
const built = (x, z) => inZone('downtown', x, z) || inZone('slu', x, z) || inZone('sodo', x, z)

// The twin's front, the ending, the page's field and the colours they end in. The ending happens
// everywhere at once: the buildings sink into the ground's elevation (uSite.x), so the height lines
// on their walls come down around them as contour rings, and then that one field of lines bends
// into the page's (uSite.y).
const COMMON = `
uniform vec2 uTwin; uniform vec4 uSite; uniform float uTwinSky;
uniform sampler2D uPerm; uniform vec4 uView; uniform vec3 uPtr;
uniform sampler2D uMass; uniform vec4 uMassMap;
float twinK(vec3 w) { return uTwin.x <= 0.0 ? 0.0 : 1.0 - smoothstep(uTwin.x - uTwin.y, uTwin.x, length(w.xz)); }
float sinkK() { return uSite.x; }
float pageK() { return uSite.y; }
float paperK() { return uSite.z; }
`
const COMMON_F = `
uniform vec3 uSunDir; uniform vec3 uSun; uniform vec3 uAmb; uniform vec3 uFog; uniform float uFogD; uniform float uSea;
uniform vec3 uGridBg; uniform vec3 uGridLine; uniform vec3 uPaperS; uniform vec3 uContourS; uniform vec3 uStrongS;
${COMMON}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float lineAA(float v, float width) {
  float d = abs(fract(v - 0.5) - 0.5);
  float fw = max(fwidth(v), 1e-5);
  return 1.0 - smoothstep(width * fw, (width + 1.0) * fw, d);
}
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

// The page's simplex noise, table for table
int pm(int i) { return int(texelFetch(uPerm, ivec2(i & 511, 0), 0).r * 255.0 + 0.5); }
const vec3 G3[12] = vec3[12](vec3(1, 1, 0), vec3(-1, 1, 0), vec3(1, -1, 0), vec3(-1, -1, 0), vec3(1, 0, 1), vec3(-1, 0, 1), vec3(1, 0, -1), vec3(-1, 0, -1), vec3(0, 1, 1), vec3(0, -1, 1), vec3(0, 1, -1), vec3(0, -1, -1));
float corner(int gi, vec3 x) {
  float t = 0.6 - dot(x, x);
  if (t < 0.0) return 0.0;
  t *= t;
  return t * t * dot(G3[gi], x);
}
float simplex(vec3 v) {
  float s = (v.x + v.y + v.z) / 3.0;
  vec3 c = floor(v + s);
  float t = (c.x + c.y + c.z) / 6.0;
  vec3 x0 = v - (c - t);
  ivec3 o1; ivec3 o2;
  if (x0.x >= x0.y) {
    if (x0.y >= x0.z) { o1 = ivec3(1, 0, 0); o2 = ivec3(1, 1, 0); }
    else if (x0.x >= x0.z) { o1 = ivec3(1, 0, 0); o2 = ivec3(1, 0, 1); }
    else { o1 = ivec3(0, 0, 1); o2 = ivec3(1, 0, 1); }
  } else {
    if (x0.y < x0.z) { o1 = ivec3(0, 0, 1); o2 = ivec3(0, 1, 1); }
    else if (x0.x < x0.z) { o1 = ivec3(0, 1, 0); o2 = ivec3(0, 1, 1); }
    else { o1 = ivec3(0, 1, 0); o2 = ivec3(1, 1, 0); }
  }
  ivec3 q = ivec3(c) & 255;
  float n0 = corner(pm(q.x + pm(q.y + pm(q.z))) % 12, x0);
  float n1 = corner(pm(q.x + o1.x + pm(q.y + o1.y + pm(q.z + o1.z))) % 12, x0 - vec3(o1) + 1.0 / 6.0);
  float n2 = corner(pm(q.x + o2.x + pm(q.y + o2.y + pm(q.z + o2.z))) % 12, x0 - vec3(o2) + 2.0 / 6.0);
  float n3 = corner(pm(q.x + 1 + pm(q.y + 1 + pm(q.z + 1))) % 12, x0 - 1.0 + 0.5);
  return 32.0 * (n0 + n1 + n2 + n3);
}
// The page's contour level at this pixel, in the units of its levels
float pageLevel() {
  vec2 css = vec2(gl_FragCoord.x, uView.y * uView.z - gl_FragCoord.y) / uView.z;
  vec2 sp = css * 0.0024;
  float val = simplex(vec3(sp, uView.w)) * 0.72 + simplex(vec3(sp * 2.3, uView.w * 1.6)) * 0.28;
  vec2 dp = css - uPtr.xy;
  val += 0.6 * uPtr.z * exp(-dot(dp, dp) / ${(2 * 150 * 150).toFixed(1)});
  return (val - ${PAGE.min.toFixed(4)}) / ${PAGE.step.toFixed(6)};
}
// How much of a line of the field c covers this pixel, and whether it is an index line; the page
// has only its own levels, which the field's others give way to as it becomes the page's
vec2 pageLine(float c) {
  float k = floor(c + 0.5);
  float kept = k < 0.0 || k > ${(PAGE.levels - 1).toFixed(1)} ? 1.0 - pageK() : 1.0;
  float index = mod(k, 4.0) < 0.5 ? 1.0 : 0.0;
  float d = abs(c - k) / max(length(vec2(dFdx(c), dFdy(c))), 1e-6);
  float w = mix(0.7, 1.15, index) * uView.z;
  return vec2(clamp(min(d + 0.5, w * 0.5) - max(d - 0.5, -w * 0.5), 0.0, 1.0) * kept, index);
}
// The city's elevation in contour levels: the ground's every 25 m, and over it the buildings, which
// sink into it as they go down; their heights count less the higher they are, so a tower is a
// handful of rings and a house one or two
float massAt(vec2 xz) {
  vec2 uv = (xz - uMassMap.xy) / uMassMap.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uMass, uv).r;
}
float cityLevel(float ground, float above, vec2 xz) {
  return ground / 25.0 + sqrt(max(above + massAt(xz) * sinkK(), 0.0) / 4.0);
}
// Haze thins with height, so high snow stands clear above a hazy foot
vec3 fogged(vec3 c, vec3 w) {
  float d = length(cameraPosition - w);
  float f = 1.0 - exp(-pow(d * uFogD, 1.15) * mix(1.0, 0.32, smoothstep(300.0, 3600.0, w.y - uSea)));
  return mix(c, uFog, f * (1.0 - twinK(w) * 0.85));
}
// The real thing, then the model, then the page, all from one field of lines L. h is height above
// the water, dry whether this is land; bg and extra are the model's ground and its own lines here,
// and survey whether its grid is drawn
vec4 finish(vec3 lit, vec3 w, float L, float h, float dry, vec3 bg, float extra, float survey) {
  float tk = twinK(w);
  float sk = sinkK();
  float pk = pageK();
  vec2 line = pageLine(mix(L, pageLevel(), pk));
  float ink = line.x * mix(dry, 1.0, pk);
  float grid = max(lineAA(w.x / 250.0, 0.6), lineAA(w.z / 250.0, 0.6));
  float fine = max(lineAA(w.x / 50.0, 0.3), lineAA(w.z / 50.0, 0.3)) * 0.35;
  float glow = mix(0.35 + 0.65 * smoothstep(0.0, 400.0, h), 1.0, sk);
  vec3 g = bg + uGridLine * ((grid * 0.55 + fine * 0.25) * survey * (1.0 - sk) + extra + ink * mix(0.55, 1.0, line.y) * glow * (1.0 + sk));
  // the twin's leading edge
  float edge = exp(-abs(length(w.xz) - uTwin.x) / max(uTwin.y * 0.25, 1.0)) * step(0.001, uTwin.x) * (1.0 - step(60000.0, uTwin.x)) * survey;
  vec3 col = mix(lit, g, tk) + uGridLine * edge * 0.6 * (1.0 - sk);
  // the paper comes in under the lines a little ahead of them becoming the page's
  vec3 page = mix(uPaperS, mix(uContourS, uStrongS, line.y), ink);
  float pc = paperK();
  return vec4(mix(col, toLinear(page), pc), 1.0 - pc);
}
`

const TERRAIN_V = `
varying vec3 vW;
varying vec3 vN;
varying float vH;
uniform float uSea;
${COMMON}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vH = w.y - uSea;
  w.y = mix(w.y, uSea + 0.5, pageK());
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const TERRAIN_F = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying float vH;
uniform vec3 uCore;
${COMMON_F}
void main() {
  vec3 n = normalize(vN);
  float h = vH;
  float slope = 1.0 - n.y;
  float town = noise(vW.xz / 180.0) * 0.6 + noise(vW.xz / 45.0) * 0.4;
  vec3 green = mix(vec3(0.20, 0.27, 0.14), vec3(0.32, 0.36, 0.20), noise(vW.xz / 300.0));
  vec3 urban = mix(vec3(0.42, 0.40, 0.37), vec3(0.30, 0.31, 0.30), town);
  float built = smoothstep(0.42, 0.62, town) * (1.0 - smoothstep(600.0, 1400.0, h)) * smoothstep(4.0, 10.0, h) * 0.6;
  // paved from the waterfront up through downtown
  built = max(built, exp(-pow(length(vW.xz - uCore.xy) / uCore.z, 2.0)) * smoothstep(1.0, 4.0, h));
  vec3 col = mix(green, urban, built * 0.7);
  // forest up the mountains, bare rock on the steep, then snow and glacier
  col = mix(col, vec3(0.13, 0.19, 0.13), smoothstep(250.0, 700.0, h) * (1.0 - smoothstep(1500.0, 1900.0, h)));
  col = mix(col, vec3(0.36, 0.34, 0.33), smoothstep(0.4, 0.65, slope) * smoothstep(400.0, 1100.0, h));
  float snow = smoothstep(1650.0, 2200.0, h + (noise(vW.xz / 700.0) - 0.5) * 700.0) * smoothstep(0.78, 0.45, slope + (noise(vW.xz / 160.0) - 0.5) * 0.3);
  col = mix(col, vec3(0.96, 0.97, 1.0), snow);
  col = mix(col, vec3(0.55, 0.5, 0.42), (1.0 - smoothstep(1.0, 5.0, h)));
  // the house's lawn, mown in stripes
  vec2 lp = vW.xz - vec2(-2.0, 1.0);
  float lawn = 1.0 - smoothstep(24.0, 28.0, length(lp) + (noise(vW.xz * 0.3) - 0.5) * 3.0);
  float px = length(fwidth(vW.xz));
  float blades = mix(0.5, noise(vW.xz * 9.0), 1.0 - smoothstep(0.02, 0.1, px));
  vec3 grass = vec3(0.17, 0.27, 0.10) * (0.85 + 0.3 * blades) * (0.94 + 0.12 * step(0.5, fract(lp.x / 3.0)));
  col = mix(col, grass, lawn);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 lit = col * (uAmb * (0.6 + 0.4 * n.y) + uSun * ndl);
  lit = fogged(lit, vW);
  gl_FragColor = finish(lit, vW, cityLevel(max(h, 0.0), 0.0, vW.xz), max(h, 0.0), step(0.5, h), uGridBg, 0.0, 1.0);
}
`
const WATER_F = `
precision highp float;
varying vec3 vW;
uniform float uTime; uniform vec3 uDeep; uniform vec3 uSky;
${COMMON_F}
void main() {
  vec2 p = vW.xz;
  float e = 2.0;
  float t = uTime * 0.4;
  float h0 = noise(p / 22.0 + t) + noise(p / 7.0 - t * 1.3) * 0.5;
  float hx = noise((p + vec2(e, 0.0)) / 22.0 + t) + noise((p + vec2(e, 0.0)) / 7.0 - t * 1.3) * 0.5;
  float hz = noise((p + vec2(0.0, e)) / 22.0 + t) + noise((p + vec2(0.0, e)) / 7.0 - t * 1.3) * 0.5;
  // ripples flatten out where they would be finer than a pixel
  float calm = 1.0 - smoothstep(1.0, 6.0, length(fwidth(p)));
  vec3 n = normalize(vec3(-(hx - h0) * 0.6 * calm, 1.0, -(hz - h0) * 0.6 * calm));
  vec3 v = normalize(cameraPosition - vW);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  float glint = pow(max(dot(r, uSunDir), 0.0), 180.0) * 3.0;
  vec3 col = mix(uDeep, uSky, fres) + uSun * glint;
  col = fogged(col, vW);
  gl_FragColor = finish(col, vW, -0.5, 0.0, 0.0, uGridBg, 0.0, 1.0);
}
`
// Buildings: facades with floors of windows, lit at dusk; in the twin, only their edges. They flatten
// into the page's map as it reaches them.
const BUILD_V = `
attribute vec3 aTone;
attribute float aGlass;
varying float vGlass;
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vSize;
varying vec3 vTone;
varying vec2 vRise;
uniform float uSea;
${COMMON}
void main() {
  vec4 base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 p = position;
  p.y *= max(1.0 - sinkK(), 0.002);
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  // the ground's height here, and this point's over it, for the field of lines
  vRise = vec2(base.y + 1.5 - uSea, w.y - base.y - 1.5);
  w.y = mix(w.y, uSea + 0.5, pageK());
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vL = (position + vec3(0.5, 0.0, 0.5)) * vSize;
  vTone = aTone;
  vGlass = aGlass;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const BUILD_F = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec3 vL;
varying vec3 vSize;
varying vec3 vTone;
varying float vGlass;
varying vec2 vRise;
uniform float uLit; uniform vec3 uWarm; uniform vec3 uSky;
${COMMON_F}
void main() {
  vec3 n = normalize(vN);
  float side = abs(n.y) < 0.5 ? 1.0 : 0.0;
  float u = abs(n.x) > 0.5 ? vL.z : vL.x;
  vec2 cell = vec2(u / 3.2, vL.y / 3.6);
  vec2 f = fract(cell);
  // windows on towers only, averaged out once a floor is smaller than a pixel
  float tower = step(18.0, vSize.y);
  float sharp = 1.0 - smoothstep(0.25, 0.7, max(fwidth(cell.x), fwidth(cell.y)));
  float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8) * side * step(4.0, vL.y) * tower;
  float on = step(0.62, hash(floor(cell) + vTone.xy * 31.0));
  vec3 facade = vTone * (0.85 + 0.15 * noise(cell * 0.3));
  vec3 glazed = facade * 0.45 + vec3(0.05, 0.07, 0.09);
  vec3 col = mix(facade, glazed, mix(0.32 * side * tower, win * 0.8, sharp));
  // houses have pitched roofs, in slate, tar and old cedar
  vec3 roof = mix(vec3(0.16, 0.17, 0.18), vec3(0.3, 0.2, 0.15), fract(vTone.x * 17.0)) * (0.8 + 0.4 * fract(vTone.z * 23.0));
  col = mix(col, roof, (1.0 - tower) * step(0.3, n.y));
  // towers have flat roofs of gravel and plant
  col = mix(col, vec3(0.24, 0.25, 0.26), tower * step(0.5, n.y));
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 lit = col * (uAmb * (0.7 + 0.3 * n.y) + uSun * ndl);
  // the street darkens the foot of every building
  lit *= mix(0.62, 1.0, smoothstep(0.0, 18.0 + 12.0 * tower, vL.y));
  // curtain walls give back the sky, and the low sun where they turn to it
  vec3 V = normalize(cameraPosition - vW);
  vec3 R = reflect(-V, n);
  float fres = 0.06 + 0.94 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 skyR = mix(uSky * 0.45, mix(uFog, uSky * 1.1, smoothstep(0.1, 0.6, R.y)), smoothstep(-0.1, 0.12, R.y));
  float gl = vGlass * side * tower;
  lit = mix(lit, skyR, gl * (0.18 + 0.55 * fres) * (1.0 - 0.7 * uLit));
  lit += uSun * pow(max(dot(R, uSunDir), 0.0), 80.0) * 2.2 * gl * (1.0 - uLit);
  // after dark each tower is lit its own amount, offices cool and homes warm
  float bright = hash(vTone.xz * 57.0);
  vec3 lamp = mix(uWarm, vec3(0.78, 0.88, 1.0), step(0.55, hash(vTone.zy * 31.0)));
  lit += lamp * uLit * 1.4 * mix(0.012 + 0.05 * bright * bright, win * on * (0.4 + 0.6 * bright), sharp) * side * tower;
  lit = fogged(lit, vW);
  // edges for the twin
  vec3 q = vL / vSize;
  vec2 e2 = abs(n.y) > 0.5 ? vec2(q.x, q.z) : vec2(abs(n.x) > 0.5 ? q.z : q.x, q.y);
  vec2 fw = fwidth(e2) * 1.2;
  float edge = max(max(1.0 - smoothstep(0.0, fw.x, e2.x), smoothstep(1.0 - fw.x, 1.0, e2.x)), max(1.0 - smoothstep(0.0, fw.y, e2.y), smoothstep(1.0 - fw.y, 1.0, e2.y)));
  // the edges let go as the building goes down, and its height lines go on into the ground's
  float sk = sinkK();
  gl_FragColor = finish(lit, vW, cityLevel(vRise.x, vRise.y, vW.xz), vRise.x + vRise.y, 1.0, uGridBg * mix(1.3, 1.0, sk), edge * 0.9 * (1.0 - sk), 0.0);
}
`
// Trees and the Needle: plain lit solids that go down into the model, or flatten into the page
const SOLID_V = `
attribute vec3 aTone;
varying vec3 vW;
varying vec3 vN;
varying vec3 vTone;
varying float vH;
uniform float uSink;
uniform float uSea;
${COMMON}
void main() {
#ifdef USE_INSTANCING
  mat4 m = modelMatrix * instanceMatrix;
  vTone = aTone;
#else
  mat4 m = modelMatrix;
  vTone = vec3(1.0);
#endif
  vec4 base = m * vec4(0.0, 0.0, 0.0, 1.0);
  float k = max(uSink * twinK(base.xyz), sinkK());
  vec4 w = m * vec4(position * max(1.0 - k, 0.002), 1.0);
  vH = w.y - uSea;
  w.y = mix(w.y, uSea + 0.5, pageK());
  vW = w.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const SOLID_F = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec3 vTone;
varying float vH;
uniform vec3 uColor; uniform float uGloss; uniform float uGlow; uniform float uLit;
${COMMON_F}
void main() {
  vec3 n = normalize(vN);
  vec3 col = uColor * vTone;
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 lit = col * (uAmb * (0.65 + 0.35 * n.y) + uSun * ndl);
  vec3 v = normalize(cameraPosition - vW);
  lit += uSun * pow(max(dot(reflect(-uSunDir, n), v), 0.0), 30.0) * uGloss;
  // floodlit after dark
  lit += col * vec3(1.0, 0.94, 0.82) * uLit * uGlow * (0.5 + 0.5 * max(n.y, 0.0));
  lit = fogged(lit, vW);
  float rim = pow(1.0 - abs(dot(n, v)), 2.0);
  gl_FragColor = finish(lit, vW, cityLevel(vH, 0.0, vW.xz), vH, 1.0, uGridBg * 1.3, rim * 0.9 * (1.0 - sinkK()), 0.0);
}
`
// Streets and their lights: ended by the page's front, and leaving the image's alpha as it was
const LINE_V = `
varying vec3 vW;
uniform float uSize;
${COMMON}
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  gl_PointSize = uSize;
}
`
const LINE_F = `
precision highp float;
varying vec3 vW;
uniform vec3 uColor; uniform vec3 uTwinColor; uniform float uAlpha; uniform float uTwinAlpha; uniform float uRound;
${COMMON}
void main() {
  // streets are not contours: they go as the buildings do
  float keep = 1.0 - sinkK();
  if (keep <= 0.0) discard;
  if (uRound > 0.5 && length(gl_PointCoord - 0.5) > 0.5) discard;
  float tk = twinK(vW);
  gl_FragColor = vec4(mix(uColor, uTwinColor, tk), mix(uAlpha, uTwinAlpha, tk) * keep);
}
`
const keepAlpha = (m, additive) => {
  m.blending = THREE.CustomBlending
  m.blendEquation = THREE.AddEquation
  m.blendSrc = additive ? THREE.SrcAlphaFactor : THREE.SrcAlphaFactor
  m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor
  m.blendSrcAlpha = THREE.ZeroFactor
  m.blendDstAlpha = THREE.OneFactor
  m.transparent = true
  m.depthWrite = false
  return m
}

// A home: walls, and a gable roof along its length
const homeGeometry = () => {
  const walls = new THREE.BoxGeometry(1, 0.62, 1).translate(0, 0.31, 0)
  const roof = new THREE.BufferGeometry()
  const y0 = 0.62
  const y1 = 1
  const pts = [
    // two slopes
    [-0.5, y0, -0.5], [0.5, y0, -0.5], [0.5, y1, 0], [-0.5, y0, -0.5], [0.5, y1, 0], [-0.5, y1, 0],
    [-0.5, y1, 0], [0.5, y1, 0], [0.5, y0, 0.5], [-0.5, y1, 0], [0.5, y0, 0.5], [-0.5, y0, 0.5],
    // gable ends
    [-0.5, y0, 0.5], [-0.5, y1, 0], [-0.5, y0, -0.5],
    [0.5, y0, -0.5], [0.5, y1, 0], [0.5, y0, 0.5],
  ]
  // wind every face outward
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < pts.length; i += 3) {
    a.fromArray(pts[i])
    b.fromArray(pts[i + 1])
    c.fromArray(pts[i + 2])
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    const mid = a.clone().add(b).add(c).divideScalar(3).sub(new THREE.Vector3(0, 0.5, 0))
    if (n.dot(mid) < 0) [pts[i + 1], pts[i + 2]] = [pts[i + 2], pts[i + 1]]
  }
  roof.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3))
  roof.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pts.length * 2).fill(0), 2))
  roof.computeVertexNormals()
  return mergeGeometries([walls.toNonIndexed(), roof])
}

export function createLand(ctx) {
  const rand = random(13)
  const root = new THREE.Group()
  const mobile = ctx.quality.mobile
  const pageNoise = createNoise3D(11)
  const permTex = new THREE.DataTexture(pageNoise.perm, 512, 1, THREE.RedFormat, THREE.UnsignedByteType)
  permTex.minFilter = permTex.magFilter = THREE.NearestFilter
  permTex.needsUpdate = true
  const shared = {
    uSunDir: { value: new THREE.Vector3(-0.2, 0.32, 0.92).normalize() },
    uSun: { value: new THREE.Color(1.4, 1.15, 0.85) },
    uAmb: { value: new THREE.Color(0.45, 0.5, 0.6) },
    uFog: { value: new THREE.Color() },
    uFogD: { value: 1 / 46000 },
    uSea: { value: SEA },
    uTwin: { value: new THREE.Vector2() },
    uSite: { value: new THREE.Vector4() },
    uMass: { value: null },
    uMassMap: { value: new THREE.Vector4() },
    uTwinSky: { value: 0 },
    uPerm: { value: permTex },
    uView: { value: new THREE.Vector4(1, 1, 1, 0) },
    uPtr: { value: new THREE.Vector3() },
    uGridBg: { value: new THREE.Color('#08131c') },
    uGridLine: { value: new THREE.Color('#5fd0e6') },
    uPaperS: { value: new THREE.Vector3() },
    uContourS: { value: new THREE.Vector3() },
    uStrongS: { value: new THREE.Vector3() },
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#123040') },
    uSky: { value: new THREE.Color() },
    uLit: { value: 0 },
    uCore: { value: new THREE.Vector3(DOWNTOWN[0], DOWNTOWN[1], 1300) },
    uWarm: { value: new THREE.Color('#ffc477') },
  }

  // Terrain in rings: fine around the hill, finer still over the city and its shores, coarser to
  // the lakes, coarse to the mountains. Each outer ring dips under the one inside it so they never
  // fight.
  const terrainMat = new THREE.ShaderMaterial({ vertexShader: TERRAIN_V, fragmentShader: TERRAIN_F, uniforms: shared })
  // holes: [x, z, half size, dip] where a finer patch lies over this one
  const ring = (size, seg, cx, cz, holes = []) => {
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx
      const z = pos.getZ(i) + cz
      let y = heightAt(x, z)
      for (const [hx, hz, half, dip] of holes) if (Math.abs(x - hx) < half && Math.abs(z - hz) < half) y -= dip
      pos.setXYZ(i, x, y, z)
    }
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, terrainMat)
    m.frustumCulled = false
    root.add(m)
    return m
  }
  const CITY = [3000, 700]
  ring(1800, mobile ? 120 : 220, 0, 0)
  ring(9000, mobile ? 180 : 330, CITY[0], CITY[1], [[0, 0, 880, 6]])
  ring(30000, mobile ? 160 : 280, 5000, 0, [[CITY[0], CITY[1], 4480, 12]])
  // the mountain gets a patch of its own, fine enough for its ridges
  ring(36000, mobile ? 150 : 260, RAINIER[0], RAINIER[1])
  ring(360000, mobile ? 120 : 180, 20000, 0, [[5000, 0, 14900, 40], [RAINIER[0], RAINIER[1], 17800, 250]])

  const waterMat = new THREE.ShaderMaterial({ vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: WATER_F, uniforms: shared })
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400000, 400000).rotateX(-Math.PI / 2), waterMat)
  sea.position.y = SEA
  sea.frustumCulled = false
  root.add(sea)

  // Buildings, each [x, z, width, depth, height, tone, turn, glass]
  const buildMat = new THREE.ShaderMaterial({ vertexShader: BUILD_V, fragmentShader: BUILD_F, uniforms: shared })
  const place = (shapeGeo, list) => {
    const mesh = new THREE.InstancedMesh(shapeGeo, buildMat, list.length)
    const tone = new Float32Array(list.length * 3)
    const glass = new Float32Array(list.length)
    const o = new THREE.Object3D()
    list.forEach(([x, z, w, d, h, t, ry = 0, gl = 0], i) => {
      o.position.set(x, heightAt(x, z) - 1.5, z)
      o.scale.set(w, h + 1.5, d)
      o.rotation.set(0, ry, 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      if (Array.isArray(t)) tone.set(t, i * 3)
      else {
        const warm = rand() * 0.08
        tone.set([t + warm, t + 0.01, t - warm * 0.5], i * 3)
      }
      glass[i] = gl
    })
    mesh.geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 3))
    mesh.geometry.setAttribute('aGlass', new THREE.InstancedBufferAttribute(glass, 1))
    mesh.frustumCulled = false
    root.add(mesh)
  }
  // Downtown's avenues run parallel to the waterfront, about 32° west of north
  const DT_RY = facing(148)
  const NS_RY = facing(0)
  // Downtown's own towers, at their own heights and places: [lat, lon, width, depth, height, tone,
  // form, glass]. Columbia Center steps back three times; 1201 Third and the Smith Tower wear
  // pointed crowns; Rainier Square Tower stands on its flared skirt.
  const LANDMARKS = [
    [47.6044, -122.3306, 52, 44, 284, [0.12, 0.14, 0.17], 'steps', 0.9], // Columbia Center
    [47.6092, -122.3339, 48, 48, 259, [0.5, 0.56, 0.62], 'skirt', 0.85], // Rainier Square Tower
    [47.6074, -122.3369, 42, 42, 235, [0.72, 0.66, 0.6], 'crown', 0.35], // 1201 Third Avenue
    [47.6106, -122.3329, 46, 40, 226, [0.3, 0.4, 0.44], 'box', 0.85], // Two Union Square
    [47.6052, -122.3297, 44, 40, 220, [0.2, 0.27, 0.3], 'box', 0.85], // Seattle Municipal Tower
    [47.6067, -122.3317, 40, 44, 201, [0.4, 0.5, 0.58], 'box', 0.9], // F5 Tower
    [47.6061, -122.3335, 46, 46, 192, [0.48, 0.5, 0.52], 'box', 0.4], // Safeco Plaza
    [47.6075, -122.3373, 44, 40, 182, [0.34, 0.44, 0.52], 'box', 0.85], // Russell Investments Center
    [47.6053, -122.3349, 42, 42, 175, [0.62, 0.58, 0.52], 'box', 0.35], // Wells Fargo Center
    [47.6098, -122.3363, 40, 36, 160, [0.55, 0.55, 0.54], 'box', 0.5], // US Bank Centre
    [47.6157, -122.3394, 46, 38, 150, [0.42, 0.48, 0.53], 'box', 0.85], // Amazon Doppler
    [47.6164, -122.3385, 44, 34, 125, [0.5, 0.53, 0.56], 'box', 0.85], // Amazon Day 1
    [47.6019, -122.3318, 24, 24, 148, [0.93, 0.92, 0.88], 'smith', 0], // Smith Tower
  ]
  const towers = []
  const crowns = []
  const marks = []
  for (const [la, lo, w, d, h, t, form, gl] of LANDMARKS) {
    const [x, z] = geo(la, lo)
    marks.push([x, z])
    // crowns take the tower's colour, as one grey
    const tk = (t[0] + t[1] + t[2]) / 3
    const at = (k, ww, dd, hh, ox = 0, oz = 0) => towers.push([x + ox, z + oz, ww, dd, hh, t, DT_RY, gl * k])
    if (form === 'steps') {
      at(1, w, d, h * 0.62)
      at(1, w * 0.82, d * 0.8, h * 0.86, 3, -2)
      at(1, w * 0.6, d * 0.58, h, 5, -4)
    } else if (form === 'skirt') {
      at(0.6, w * 1.35, d * 1.35, h * 0.12)
      at(0.8, w * 1.15, d * 1.15, h * 0.22)
      at(1, w, d, h)
    } else if (form === 'crown') {
      at(1, w, d, h * 0.86)
      at(1, w * 0.72, d * 0.72, h * 0.9)
      crowns.push([x, z, w * 0.72, d * 0.72, h * 0.9, h * 0.1, tk])
    } else if (form === 'smith') {
      at(1, w * 1.6, d * 1.6, h * 0.22)
      at(1, w, d, h * 0.72)
      crowns.push([x, z, w, d, h * 0.72, h * 0.28, tk])
    } else {
      at(1, w, d, h)
      at(0, w * 0.5, d * 0.5, h + 7)
    }
  }
  // The rest of downtown, block by block on its own grid: towers tallest in the core, slender
  // residential towers through Belltown, old brick low-rise in Pioneer Square, mid-rise offices in
  // South Lake Union, warehouses in SoDo
  const CORE = geo(47.6062, -122.333)
  const ax = [Math.cos(DT_RY), -Math.sin(DT_RY)]
  const az = [Math.sin(DT_RY), Math.cos(DT_RY)]
  const GLASS = [[0.3, 0.38, 0.45], [0.18, 0.22, 0.26], [0.26, 0.33, 0.36], [0.38, 0.44, 0.5], [0.14, 0.17, 0.2], [0.34, 0.4, 0.38]]
  const STONE = [[0.58, 0.54, 0.48], [0.66, 0.64, 0.6], [0.46, 0.44, 0.42], [0.72, 0.7, 0.66], [0.52, 0.45, 0.38]]
  const BRICK = [[0.5, 0.31, 0.24], [0.56, 0.4, 0.3], [0.44, 0.3, 0.26], [0.6, 0.5, 0.4]]
  // craftsman siding: greys, slate blue, sage, white, cedar brown
  const SIDING = [[0.62, 0.63, 0.62], [0.42, 0.48, 0.55], [0.5, 0.56, 0.48], [0.82, 0.81, 0.77], [0.48, 0.38, 0.3], [0.72, 0.66, 0.55], [0.32, 0.35, 0.38]]
  const pick = (list) => list[Math.floor(rand() * list.length)].map((v) => v * (0.9 + rand() * 0.2))
  for (let i = -34; i <= 34; i++) {
    for (let j = -16; j <= 16; j++) {
      for (const k of [-0.25, 0.25]) {
        const u = (i + k) * 110 + (rand() - 0.5) * 6
        const v = j * 80 + (rand() - 0.5) * 6
        const x = CORE[0] + ax[0] * u + az[0] * v
        const z = CORE[1] + ax[1] * u + az[1] * v
        if (water(x, z) > 0.02 || marks.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 48)) continue
        const r = Math.hypot(x - CORE[0], z - CORE[1])
        if (inZone('pioneer', x, z)) {
          if (rand() < 0.9) towers.push([x, z, 46 + rand() * 8, 30 + rand() * 30, 16 + rand() * 26, pick(BRICK), DT_RY, 0])
        } else if (inZone('downtown', x, z)) {
          const core = Math.exp(-((r / 680) ** 2))
          if (rand() < 0.18) continue
          if (r > 950 && rand() < 0.22) {
            // Belltown and the Denny Triangle: residential towers
            const h = 55 + rand() * 80
            towers.push([x, z, 30 + rand() * 12, 30 + rand() * 14, h, pick(rand() < 0.6 ? GLASS : STONE), DT_RY, 0.6])
          } else {
            const h = 18 + core * (45 + rand() ** 2.2 * 170) + rand() * 22
            const tall = h > 70
            towers.push([x, z, tall ? 38 + rand() * 16 : 48 + rand() * 6, tall ? 36 + rand() * 22 : 40 + rand() * 30, h, pick(tall && rand() < 0.75 ? GLASS : STONE), DT_RY, tall ? 0.55 + rand() * 0.4 : 0.15])
            if (tall) towers.push([x, z, 14 + rand() * 8, 14 + rand() * 8, h + 5 + rand() * 6, [0.3, 0.31, 0.32], DT_RY, 0])
          }
        }
      }
    }
  }
  // South Lake Union, SoDo and First Hill on the north-south grid
  for (let i = 0; i < (mobile ? 900 : 2200); i++) {
    const [ex, nz] = [(rand() - 0.5) * 3200, (rand() - 0.5) * 7000]
    const [cx, cz] = geo(47.592, -122.333)
    const x = cx + Math.cos(NS_RY) * nz + Math.sin(NS_RY) * ex
    const z = cz - Math.sin(NS_RY) * nz + Math.cos(NS_RY) * ex
    if (water(x, z) > 0.02 || inZone('downtown', x, z)) continue
    if (inZone('slu', x, z)) {
      if (rand() < 0.55) towers.push([x, z, 40 + rand() * 30, 30 + rand() * 30, 26 + rand() * 70, pick(rand() < 0.6 ? GLASS : STONE), NS_RY, 0.6])
    } else if (inZone('sodo', x, z)) {
      if (rand() < 0.35) towers.push([x, z, 50 + rand() * 60, 40 + rand() * 50, 8 + rand() * 12, [0.56 + rand() * 0.1, 0.55 + rand() * 0.1, 0.52 + rand() * 0.08], NS_RY, 0])
    } else if (Math.hypot(...[x, z].map((q, k) => q - geo(47.6085, -122.3215)[k])) < 450 && rand() < 0.4) {
      towers.push([x, z, 34 + rand() * 20, 30 + rand() * 20, 25 + rand() * 60, pick(STONE), NS_RY, 0.3])
    }
  }
  // Houses on the north-south grid of streets, thinning out with distance, and none in the parks
  const PARKS = [[47.657, -122.415, 900], [47.55, -122.255, 500], [47.6305, -122.315, 250], [47.636, -122.355, 120], [47.5585, -122.38, 700]].map(([la, lo, r]) => [...geo(la, lo), r])
  const parkAt = (x, z) => PARKS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r)
  const homes = []
  const nearHouse = (x, z) => Math.hypot(x, z) < 75
  for (let i = 0; homes.length < (mobile ? 3500 : 9500) && i < 90000; i++) {
    const e = Math.round(((rand() - 0.35) * 14000) / 24) * 24
    const n = Math.round(((rand() - 0.55) * 14000) / 40) * 40
    // streets every fifth lot one way and every third the other
    if (Math.round(e / 24) % 5 === 0 || Math.round(n / 40) % 3 === 0) continue
    const x = e * FX + n * FN
    const z = e * FN - n * FX
    const r = Math.hypot(x - 1500, z)
    if (rand() > 1.3 - r / 5200 || nearHouse(x, z) || built(x, z) || parkAt(x, z) || coast(x, z) < 35) continue
    if (Math.hypot(x - NEEDLE[0], z - NEEDLE[1]) < 260 || (x > 0 && x < 170 && Math.abs(z) < 80 + x * 0.9)) continue
    homes.push([x + (rand() - 0.5) * 4, z + (rand() - 0.5) * 4, 10 + rand() * 4, 13 + rand() * 6, 7 + rand() * 4, pick(SIDING), NS_RY + (rand() < 0.5 ? 0 : Math.PI / 2)])
  }
  place(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), towers)
  place(homeGeometry(), homes)

  // Every building's height, as a map over the city, softened a little: what the ground's field of
  // lines takes into itself as the buildings sink at the end
  const MASS = { x: -2000, z: -4500, size: 9000, n: mobile ? 1024 : 1536 }
  {
    const { x: x0, z: z0, size, n } = MASS
    const px = size / n
    let a = new Float32Array(n * n)
    for (const [x, z, w, d, h, , ry = 0] of [...towers, ...homes]) {
      const c = Math.cos(ry)
      const sn = Math.sin(ry)
      const r = Math.hypot(w, d) / 2
      const i0 = Math.max(0, Math.floor((x - r - x0) / px))
      const i1 = Math.min(n - 1, Math.ceil((x + r - x0) / px))
      const j0 = Math.max(0, Math.floor((z - r - z0) / px))
      const j1 = Math.min(n - 1, Math.ceil((z + r - z0) / px))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = x0 + (i + 0.5) * px - x
          const dz = z0 + (j + 0.5) * px - z
          if (Math.abs(dx * c - dz * sn) <= w / 2 + px / 2 && Math.abs(dx * sn + dz * c) <= d / 2 + px / 2) a[j * n + i] = Math.max(a[j * n + i], h)
        }
      }
    }
    // twice through a box blur each way, a running sum along each row and column, about 10 m
    const R = mobile ? 1 : 2
    const pass = (src, across) => {
      const out = new Float32Array(n * n)
      const clampK = (k) => Math.min(n - 1, Math.max(0, k))
      for (let line = 0; line < n; line++) {
        const at = across ? (k) => line * n + clampK(k) : (k) => clampK(k) * n + line
        let sum = 0
        for (let k = -R; k <= R; k++) sum += src[at(k)]
        for (let k = 0; k < n; k++) {
          out[at(k)] = sum / (2 * R + 1)
          sum += src[at(k + R + 1)] - src[at(k - R)]
        }
      }
      return out
    }
    for (let t = 0; t < 2; t++) a = pass(pass(a, true), false)
    const half = new Uint16Array(n * n)
    for (let i = 0; i < n * n; i++) half[i] = THREE.DataUtils.toHalfFloat(a[i])
    const tex = new THREE.DataTexture(half, n, n, THREE.RedFormat, THREE.HalfFloatType)
    tex.minFilter = tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    shared.uMass.value = tex
    shared.uMassMap.value.set(x0, z0, size, 0)
  }

  const solid = (color, gloss = 0, sink = 1, glow = 0) =>
    new THREE.ShaderMaterial({ vertexShader: SOLID_V, fragmentShader: SOLID_F, uniforms: { ...shared, uColor: { value: new THREE.Color(color) }, uGloss: { value: gloss }, uSink: { value: sink }, uGlow: { value: glow } } })
  // Pointed crowns, as instances standing on their towers
  const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), solid('#ffffff', 0.25, 0), crowns.length)
  const crownTone = new Float32Array(crowns.length * 3)
  const o2 = new THREE.Object3D()
  crowns.forEach(([x, z, w, d, at, h, t], i) => {
    o2.position.set(x, heightAt(x, z) - 1 + at, z)
    o2.scale.set(w, h, d)
    o2.rotation.set(0, DT_RY, 0)
    o2.updateMatrix()
    crownMesh.setMatrixAt(i, o2.matrix)
    crownTone.set([t, t, t * 0.98], i * 3)
  })
  crownMesh.geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(crownTone, 3))
  crownMesh.frustumCulled = false
  root.add(crownMesh)

  // Solids made of pieces: a tube from one point to another, a box, a lathe
  const tube = (a, b, r0, r1, seg = 10) => {
    const A = new THREE.Vector3(...a)
    const B = new THREE.Vector3(...b)
    const g = new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), seg).translate(0, A.distanceTo(B) / 2, 0)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()))
    return g.translate(A.x, A.y, A.z)
  }
  const block = (x, y, z, w, h, d, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z)
  // parts merged into one solid at a place, turned to face its way, standing on the ground or afloat
  const solidAt = (parts, at, color, { gloss = 0, glow = 0, ry = 0, y = null } = {}) => {
    const m = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), solid(color, gloss, 0, glow))
    m.position.set(at[0], y ?? heightAt(at[0], at[1]), at[1])
    m.rotation.y = ry
    m.frustumCulled = false
    root.add(m)
    return m
  }

  // The Space Needle: three pairs of legs pinched at the waist, the core, the halo and its roof
  // and the spire, 184 m
  const needleParts = [tube([0, 0, 0], [0, 160, 0], 2.6, 2.4, 12)]
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const a = (k * Math.PI * 2) / 3 + s * 0.2
      const foot = [Math.cos(a) * 15, 0, Math.sin(a) * 15]
      const waist = [Math.cos(a) * 3.6, 112, Math.sin(a) * 3.6]
      const top = [Math.cos(a) * 7.5, 150, Math.sin(a) * 7.5]
      needleParts.push(tube(foot, waist, 0.9, 0.6, 6), tube(waist, top, 0.6, 0.7, 6))
    }
  }
  needleParts.push(new THREE.TorusGeometry(3.9, 0.5, 6, 18).rotateX(Math.PI / 2).translate(0, 112, 0))
  const halo = [[0, 147], [7, 148], [15, 153], [21, 157.5], [21.2, 158.6], [19, 160], [13, 162.5], [7, 165], [3, 167.5], [1.2, 169.5], [0, 169.6]]
  needleParts.push(new THREE.LatheGeometry(halo.map(([r, y]) => new THREE.Vector2(r, y)), 40))
  needleParts.push(tube([0, 169.5, 0], [0, 184, 0], 0.9, 0.25, 8))
  solidAt(needleParts, NEEDLE, '#eceae4', { gloss: 0.35, glow: 1.6 })
  // and beside it on Seattle Center, the arena's low square roof
  solidAt([block(0, 0, 0, 120, 16, 120), block(0, 16, 0, 96, 6, 96)], geo(47.6221, -122.354), '#bdbab2', { gloss: 0.1, ry: NS_RY })

  // The Great Wheel on Pier 57, facing the bay
  const wheel = [new THREE.TorusGeometry(28, 1.1, 6, 48), new THREE.TorusGeometry(26, 0.5, 4, 48)]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    wheel.push(tube([0, 0, 0], [Math.cos(a) * 27, Math.sin(a) * 27, 0], 0.35, 0.35, 4))
  }
  const wheelGeo = wheel.map((g) => g.translate(0, 32, 0))
  wheelGeo.push(tube([-6, 0, 0], [0, 32, 0], 1.2, 0.8, 6), tube([6, 0, 0], [0, 32, 0], 1.2, 0.8, 6))
  solidAt(wheelGeo, geo(47.6061, -122.3428), '#f1f0ea', { gloss: 0.2, glow: 1.2, ry: DT_RY, y: SEA + 4 })

  // The stadiums south of downtown, both long north to south: the football stadium's two roof
  // arcs over its stands, and the ballpark with its roof rolled back
  const stands = (w, d, h) => [block(-w / 2, 0, 0, 28, h, d), block(w / 2, 0, 0, 28, h, d), block(0, 0, -d / 2, w, h * 0.7, 26), block(0, 0, d / 2, w, h * 0.7, 26)]
  solidAt([...stands(220, 250, 34), block(-90, 34, 0, 64, 6, 240), block(90, 34, 0, 64, 6, 240)], geo(47.5952, -122.3316), '#c9c6bf', { gloss: 0.1, ry: facing(90) })
  solidAt([...stands(200, 200, 40), block(0, 44, 70, 190, 10, 110)], geo(47.5914, -122.3325), '#b8b5ae', { gloss: 0.15, ry: facing(90) })

  // The port's cranes, booms out over the water: Terminal 46 by the stadiums, Terminal 18 on
  // Harbor Island
  const craneRow = (n) => {
    const parts = []
    for (let i = 0; i < n; i++) {
      const x = i * 70
      for (const [dx, dz] of [[-9, -12], [9, -12], [-9, 12], [9, 12]]) parts.push(block(x + dx, 0, dz, 2.4, 46, 2.4))
      parts.push(block(x, 44, 0, 22, 6, 28), block(x, 48, 30, 5, 4, 120), block(x, 48, -18, 5, 4, 40), tube([x, 50, -18], [x, 78, 0], 0.8, 0.6, 4), tube([x, 78, 0], [x, 50, 80], 0.6, 0.6, 4))
    }
    return parts
  }
  solidAt(craneRow(5), geo(47.5935, -122.3418), '#cf5a2c', { gloss: 0.2, ry: facing(180) })
  solidAt(craneRow(6), geo(47.5835, -122.3475), '#cf5a2c', { gloss: 0.2, ry: facing(0) })

  // The ferries: one leaving Colman Dock for Bainbridge, one out on the Sound
  const ferry = [block(0, 0, 0, 130, 7, 26), block(0, 7, 0, 100, 6, 22), block(0, 13, 0, 70, 4, 18), block(0, 17, 0, 16, 5, 12)]
  solidAt(ferry, geo(47.6005, -122.3555), '#f3f2ee', { gloss: 0.3, glow: 0.6, ry: facing(278), y: SEA })
  solidAt(ferry, geo(47.605, -122.44), '#f3f2ee', { gloss: 0.3, glow: 0.6, ry: facing(96), y: SEA })

  // Trees through the neighbourhoods and thick in the parks and greenbelts: tall firs, and
  // broadleaves around them
  const TREES = mobile ? 6000 : 16000
  const firs = []
  const broad = []
  for (let i = 0; firs.length + broad.length < TREES && i < 140000; i++) {
    const x = 1800 + (rand() - 0.5) * 13000
    const z = (rand() - 0.5) * 13000
    const r = Math.hypot(x - 1500, z)
    const park = parkAt(x, z)
    if (!park && rand() > 1.35 - r / 5500) continue
    if (Math.hypot(x, z) < 40 || built(x, z) || coast(x, z) < 12 || Math.hypot(x - NEEDLE[0], z - NEEDLE[1]) < 80) continue
    // the view from the house stays open down the slope
    if (x > 0 && x < 140 && Math.abs(z) < 60 + x * 0.9) continue
    ;(rand() < (park ? 0.75 : 0.5) ? firs : broad).push([x, z, 3 + rand() * 3.4])
  }
  const grove = (g, list, tall, base, color) => {
    const mesh = new THREE.InstancedMesh(g, solid(color), list.length)
    const tone = new Float32Array(list.length * 3)
    const o = new THREE.Object3D()
    list.forEach(([x, z, s], i) => {
      o.position.set(x, heightAt(x, z) + base * s, z)
      o.scale.set(s, s * tall, s)
      o.rotation.set(0, rand() * Math.PI * 2, 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      const k = 0.82 + rand() * 0.36
      tone.set([k * (0.95 + rand() * 0.1), k, k * (0.9 + rand() * 0.15)], i * 3)
    })
    mesh.geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 3))
    mesh.frustumCulled = false
    root.add(mesh)
  }
  // a fir in three tiers on its trunk; a broadleaf crown of a few lumps
  const fir = mergeGeometries([
    new THREE.CylinderGeometry(0.06, 0.09, 0.25, 6).translate(0, 0.125, 0),
    new THREE.ConeGeometry(1, 0.5, 9).translate(0, 0.4, 0),
    new THREE.ConeGeometry(0.78, 0.45, 9).translate(0, 0.62, 0),
    new THREE.ConeGeometry(0.52, 0.4, 9).translate(0, 0.82, 0),
  ].map((g) => g.toNonIndexed()))
  const lumps = [[0, 0, 0, 1], [0.45, -0.15, 0.2, 0.7], [-0.4, -0.1, -0.25, 0.72], [0.1, 0.35, -0.1, 0.68], [-0.15, -0.2, 0.45, 0.62]]
  const crown = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.11, 0.9, 6).translate(0, -0.7, 0).toNonIndexed(), ...lumps.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 2).translate(x, y, z))])
  grove(fir, firs, 4.6, -0.05, '#2f4c36')
  grove(crown, broad, 0.95, 1.1, '#5f8648')

  // Streets, following the ground, and the lights along them; the bridges cross on the water
  const linePos = []
  const lightPos = []
  const along = (pts, { bridge = false, lights = 0.45 } = {}) => {
    for (let s = 1; s < pts.length; s++) {
      const [x0, z0] = pts[s - 1]
      const [x1, z1] = pts[s]
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 40)
      let prev = null
      for (let k = s === 1 ? 0 : 1; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n
        const z = z0 + ((z1 - z0) * k) / n
        const wet = water(x, z) > 0.05
        const q = wet && !bridge ? null : Math.hypot(x, z) < 60 ? null : [x, wet ? SEA + 6 : heightAt(x, z) + 1.2, z]
        if (prev && q) linePos.push(...prev, ...q)
        if (q && rand() < lights) lightPos.push(x + (rand() - 0.5) * 8, q[1] + 2 + rand() * 4, z + (rand() - 0.5) * 8)
        prev = q
      }
    }
  }
  const en = (e, n) => [e * FX + n * FN, e * FN - n * FX]
  // the north-south grid, avenues every 120 m and streets every 200
  for (let e = -5000; e <= 9000; e += 120) {
    const pts = []
    for (let n = -9000; n <= 6000; n += 400) pts.push(en(e, n))
    along(pts.filter(([x, z]) => !inZone('downtown', x, z)))
  }
  for (let n = -9000; n <= 6000; n += 200) along([en(-5000, n), en(9000, n)])
  // downtown's own grid
  const dt = (u, v) => [CORE[0] + ax[0] * u + az[0] * v, CORE[1] + ax[1] * u + az[1] * v]
  for (let j = -16; j <= 16; j++) along([dt(-2200, j * 80), dt(2200, j * 80)], { lights: 0.6 })
  for (let i = -20; i <= 20; i++) along([dt(i * 110, -1300), dt(i * 110, 1300)], { lights: 0.6 })
  // I-5 and Aurora, the floating bridges across Lake Washington
  const road = (pts, o) => along(pts.map(([la, lo]) => geo(la, lo)), o)
  road([[47.73, -122.323], [47.68, -122.322], [47.655, -122.322], [47.635, -122.325], [47.62, -122.327], [47.605, -122.3275], [47.595, -122.322], [47.57, -122.318], [47.53, -122.29]], { lights: 0.9 })
  road([[47.73, -122.345], [47.665, -122.347], [47.645, -122.347], [47.628, -122.344], [47.62, -122.343], [47.605, -122.341], [47.59, -122.336], [47.56, -122.343]], { lights: 0.8, bridge: true })
  road([[47.644, -122.304], [47.643, -122.28], [47.638, -122.24], [47.636, -122.2]], { lights: 0.9, bridge: true })
  road([[47.592, -122.315], [47.59, -122.285], [47.588, -122.25], [47.585, -122.2]], { lights: 0.9, bridge: true })
  const lineMat = (additive, round) =>
    keepAlpha(new THREE.ShaderMaterial({
      vertexShader: LINE_V,
      fragmentShader: LINE_F,
      uniforms: { ...shared, uColor: { value: new THREE.Color() }, uTwinColor: { value: new THREE.Color() }, uAlpha: { value: 0.2 }, uTwinAlpha: { value: 0.85 }, uSize: { value: 2 }, uRound: { value: round ? 1 : 0 } },
    }), additive)
  const roadGeo = new THREE.BufferGeometry()
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3))
  const roadMat = lineMat(false, false)
  const roads = new THREE.LineSegments(roadGeo, roadMat)
  roads.frustumCulled = false
  root.add(roads)
  const lightGeo = new THREE.BufferGeometry()
  lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lightPos, 3))
  const lightMat = lineMat(true, true)
  const lights = new THREE.Points(lightGeo, lightMat)
  lights.frustumCulled = false
  root.add(lights)

  // The sky: a dome that rides with the camera, warm at the horizon, dark once the model is all
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunDir: shared.uSunDir, uSunCol: { value: new THREE.Color() }, uTwinSky: shared.uTwinSky, uGridBg: shared.uGridBg },
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTwinSky; uniform vec3 uGridBg; varying vec3 vD;
      void main() {
        float y = max(vD.y, 0.0);
        vec3 c = mix(uHorizon, uTop, pow(y, 0.55));
        float s = max(dot(vD, uSunDir), 0.0);
        c += uSunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35);
        gl_FragColor = vec4(mix(c, uGridBg, uTwinSky), 1.0);
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMat)
  sky.frustumCulled = false
  sky.renderOrder = -1

  const srgbVec = (v, c) => {
    const s = c.clone().convertLinearToSRGB()
    v.set(s.r, s.g, s.b)
  }
  const theme = () => {
    const pal = ctx.palette
    const night = ctx.dark
    skyMat.uniforms.uTop.value.set(night ? '#0a1424' : '#4f84c2')
    skyMat.uniforms.uHorizon.value.set(night ? '#2a3445' : '#e6e2d8')
    skyMat.uniforms.uSunCol.value.set(night ? '#000000' : '#ffd9a0')
    shared.uFog.value.set(night ? '#1d2735' : '#d3d9dc')
    shared.uSky.value.set(night ? '#1a2333' : '#9fb3c4')
    shared.uDeep.value.set(night ? '#060c14' : '#1d4458')
    shared.uSun.value.set(night ? '#20283a' : '#ffd9a8').multiplyScalar(night ? 1 : 1.5)
    shared.uAmb.value.set(night ? '#2a3550' : '#8796ad')
    shared.uLit.value = night ? 1 : 0.08
    shared.uGridLine.value.copy(pal.signal).lerp(new THREE.Color('#5fd0e6'), 0.55)
    srgbVec(shared.uPaperS.value, pal.paper)
    srgbVec(shared.uContourS.value, pal.contour)
    srgbVec(shared.uStrongS.value, pal.strong)
    roadMat.uniforms.uColor.value.set(night ? '#6a5a44' : '#5d5a52')
    roadMat.uniforms.uAlpha.value = night ? 0.35 : 0.18
    roadMat.uniforms.uTwinColor.value.copy(shared.uGridLine.value)
    lightMat.uniforms.uColor.value.set('#ffc477')
    lightMat.uniforms.uAlpha.value = night ? 0.95 : 0.35
    lightMat.uniforms.uTwinColor.value.set('#bff4ff')
    lightMat.uniforms.uTwinAlpha.value = 0.9
  }

  // twin and site: each front's progress and radius
  const update = ({ twin, site, time, camera }) => {
    shared.uTwin.value.set(twin.radius, Math.max(30, twin.radius * 0.12))
    shared.uSite.value.set(site.sink, site.k, site.paper, 0)
    shared.uTwinSky.value = Math.min(1, Math.max(0, (twin.k - 0.45) / 0.4))
    shared.uTime.value = time / 1000
    // The page's field: its screen, in CSS pixels, and its slow drift
    shared.uView.value.set(ctx.W, ctx.H, ctx.pr, time * 0.000035)
    shared.uPtr.value.set(ctx.pointer.x, ctx.pointer.y, ctx.pointer.s)
    const pr = ctx.pr
    lightMat.uniforms.uSize.value = (2.2 + twin.k * 1.4) * pr
    sky.position.copy(camera.position)
    sky.scale.setScalar(camera.far * 0.9)
  }
  return { root, sky, update, theme }
}
