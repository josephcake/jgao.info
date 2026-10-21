import * as THREE from 'three'
import { rig, applyPose, smooth, lerp } from './util'
import { deviceTimeline, YB, SOCKET, SENSOR } from './board'
import { FELT_ORIGIN, feltKeys } from './felt'
import { createHouse, FLOOR } from './house'
import { createLand, SEA, DOWNTOWN } from './land'

// One world in metres, from a socket contact half a millimetre tall to the mountains: the device
// sits at the origin on the table, the house around it, Seattle around the house. It begins on the
// ball's felt, now the top of the device's board, with the camera exactly where it was over it on
// the court.
const FLOAT = 0.25
const HALF = Math.PI / 2

// A key from where the camera is and what it looks at; d is how far ahead the orbit target sits
const aim = (p, C, L, d, fov, ap) => {
  const v = new THREE.Vector3(L[0] - C[0], L[1] - C[1], L[2] - C[2]).normalize()
  const t = [C[0] + v.x * d, C[1] + v.y * d, C[2] + v.z * d]
  return [p, [...t, d, Math.atan2(-v.x, -v.z), Math.asin(-v.y), fov, ap]]
}
const unwrap = (keys) => {
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1][1][4]
    let y = keys[i][1][4]
    while (y - prev > Math.PI) y -= Math.PI * 2
    while (y - prev < -Math.PI) y += Math.PI * 2
    keys[i][1][4] = y
  }
  return keys
}

// The digital twin spreads out from the house. Then, everywhere at once, the buildings sink into
// the ground's elevation lines, and those lines bend into the page's own map.
export const twinAt = (p) => {
  const k = smooth(3.27, 3.42, p)
  return { k, radius: k > 0 ? 25 * Math.pow(3200, k) - 25 : 0 }
}
export const siteAt = (p) => ({ sink: smooth(3.44, 3.56, p), paper: smooth(3.54, 3.6, p), k: smooth(3.56, 3.68, p) })

export function createWorld(ctx, board, felt) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.001, 1000)
  const house = createHouse(ctx)
  const land = createLand(ctx)
  scene.add(board.root, house.root, land.root, land.sky)
  scene.environment = ctx.env
  const holder = new THREE.Group()
  holder.position.set(...FELT_ORIGIN)
  board.main.add(holder)

  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.castShadow = true
  sun.shadow.mapSize.set(ctx.quality.mobile ? 1024 : 2048, ctx.quality.mobile ? 1024 : 2048)
  scene.add(sun, sun.target)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6)
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0)
  rim.position.set(0.4, 0.3, -1)
  scene.add(hemi, rim)
  const sunDir = new THREE.Vector3(-0.2, 0.32, 0.92).normalize()
  const keyDir = new THREE.Vector3(-0.5, 0.8, 0.35).normalize()
  const dir = new THREE.Vector3()
  const cool = new THREE.Color('#e4edff')
  const gold = new THREE.Color()

  const win = [5, FLOOR + 1.4, -1.8]
  const city = [DOWNTOWN[0], SEA + 60, DOWNTOWN[1]]
  // In the device's own frame until it has landed, then in the world's
  const path = rig(unwrap([
    ...feltKeys(FELT_ORIGIN),
    // still rising as the processor comes down onto the contacts
    [1.42, [SOCKET.x + 0.002, YB + 0.001, SOCKET.z, 0.026, -HALF + 0.28, 0.78, 38, 0.28]],
    [1.5, [SOCKET.x + 0.002, YB + 0.0015, SOCKET.z, 0.036, -HALF + 0.34, 0.74, 37, 0.24]],
    [1.56, [SOCKET.x + 0.003, YB + 0.0015, SOCKET.z * 0.5, 0.048, -HALF + 0.39, 0.72, 37, 0.21]],
    [1.62, [SOCKET.x + 0.004, YB, 0, 0.07, -HALF + 0.45, 0.72, 36, 0.18]],
    [1.74, [0.004, YB, 0.018, 0.055, -HALF + 0.75, 0.62, 36, 0.22]],
    [1.84, [SENSOR.x, YB + 0.006, SENSOR.z, 0.04, -HALF + 0.95, 0.5, 36, 0.3]],
    [1.95, [0, 0.04, 0, 0.3, -HALF + 1.15, 0.38, 34, 0.12]],
    [2.06, [0, 0.03, 0, 0.28, -HALF + 1.35, 0.42, 34, 0.12]],
    [2.14, [0, 0.016, 0, 0.22, -HALF + 1.5, 0.45, 34, 0.14]],
    [2.28, [0, 0.019, 0, 0.3, 0.42, 0.34, 34, 0.22]],
    [2.4, [-0.4, -0.3, -1.2, 4.6, 0.95, 0.3, 40, 0.05]],
    [2.52, [-1.5, FLOOR, 0, 14, 1.6, 0.85, 40, 0.01]],
    [2.64, [-2, FLOOR, 1, 34, 2.4, 1.0, 40, 0]],
    [2.84, [-2, FLOOR, 1, 46, 3.6, 1.05, 40, 0]],
    aim(2.92, [-1.6, FLOOR + 1.45, -1.6], win, 6.6, 40, 0.06),
    aim(2.97, [4.55, FLOOR + 1.42, -1.8], [10, FLOOR + 1.4, -1.8], 0.5, 42, 0.1),
    aim(3.0, [6, FLOOR + 3.2, -1.8], city, 3, 42, 0.04),
    aim(3.04, [16, FLOOR + 14, -4], city, 25, 42, 0.02),
    aim(3.1, [40, 60, -20], city, 250, 40, 0),
    aim(3.18, [60, 140, -60], city, 1200, 40, 0),
    aim(3.26, [-300, 520, -700], [5000, SEA, 1500], 3000, 40, 0),
    aim(3.36, [-2500, 2600, -3000], [6000, SEA, 1500], 6000, 38, 0),
    aim(3.46, [-1500, 5200, -4500], [4000, SEA, 0], 8000, 38, 0),
    aim(3.54, [1500, 4200, -600], [1500, SEA, 0], 4300, 38, 0),
    aim(3.62, [1500, 2600, -1], [1500, SEA, 0], 2740, 38, 0),
    aim(3.8, [1500, 2500, -1], [1500, SEA, 0], 2640, 38, 0),
  ]))

  const update = (p) => {
    const pal = ctx.palette
    const night = ctx.dark
    const pose = path(p)
    // The device rides with the camera above the table until it comes down onto it
    const dy = FLOAT * (1 - smooth(2.13, 2.28, p))
    board.root.position.y = dy
    const follow = 1 - smooth(2.26, 2.34, p)
    pose.target.y += dy * follow
    pose.position.y += dy * follow
    applyPose(camera, pose)
    const d = pose.distance
    camera.near = Math.max(1e-5, d * 0.02)
    camera.far = Math.max(d * 6000, p > 2.9 ? 4e5 : 0)
    camera.updateProjectionMatrix()

    const warm = smooth(2.0, 2.3, p)
    board.update({ ...deviceTimeline(p), time: ctx.time, signal: pal.signal })
    holder.add(felt.root)
    felt.place({ onBoard: true })
    felt.update(p, { warm })

    const twin = twinAt(p)
    const site = siteAt(p)
    // Each part of the network reaches out, holds, and draws back in
    const out = (a, b, c, e) => smooth(a, b, p) * (1 - smooth(c, e, p))
    house.update({
      fields: out(2.6, 2.7, 2.86, 2.93),
      linked: out(2.67, 2.77, 2.85, 2.92),
      wide: out(2.73, 2.84, 2.87, 2.95),
      warm: warm * (night ? 1 : 0.55) + (1 - warm) * 0.05,
      sink: smooth(0, 0.18, twin.k),
      time: ctx.time,
      signal: pal.signal,
    })
    land.update({ twin, site, time: ctx.time, camera })

    // One light for the sun: cool and hard over the board, low and warm over the house and city,
    // its shadow camera fitted to whatever the view is looking at (taste-skill-ignore)
    const e = Math.min(Math.max(d * 1.4, 0.003), 45)
    dir.copy(keyDir).lerp(sunDir, warm).normalize()
    sun.position.copy(pose.target).addScaledVector(dir, e * 4)
    sun.target.position.copy(pose.target)
    const sc = sun.shadow.camera
    sc.left = sc.bottom = -e
    sc.right = sc.top = e
    sc.near = e * 0.1
    sc.far = e * 10
    sc.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = e * 0.004
    gold.set(night ? '#7d8fb8' : '#ffd6a0')
    sun.color.copy(cool).lerp(gold, warm)
    sun.intensity = lerp(2.6, night ? 0.5 : 2.4, warm)
    hemi.color.set(night ? '#3b4766' : '#cfd9e6')
    hemi.groundColor.set(night ? '#171a22' : '#6b5a48')
    hemi.intensity = lerp(0.35, night ? 0.3 : 0.55, warm)
    rim.intensity = 1.4 * (1 - warm)
    scene.environmentIntensity = lerp(0.35, night ? 0.12 : 0.5, warm)

    // The land's own colours are final once the page's map has reached them
    return { focus: d, aperture: pose.aperture, rawAlpha: p > 3.5 ? 1 : 0, site: site.paper }
  }

  const theme = () => land.theme()

  return { scene, camera, update, theme }
}
