import { useEffect, useRef } from 'react'

const DOG_W = 132
const SCALE = DOG_W / 122
const WALK = 46
const TROT = 110
const GALLOP = 250
const ZOOM = 330
const CRITTER_SPEED = 240
const CRITTER_BOLT = 380
const HAND_W = 100
const HAND_Y = 50
const TREAT_FLIGHT_MS = 700
const MOUTH = { stand: [114, 35], sit: [102, 17] }
const CRITTER_W = 52
const EVENTS = [
  ['chase', 0.16],
  ['ball', 0.15],
  ['treat', 0.13],
  ['sleep', 0.11],
  ['zoomies', 0.1],
  ['butterfly', 0.09],
  ['fly', 0.09],
  ['leaf', 0.08],
  ['dig', 0.07],
  ['shake', 0.06],
  ['howl', 0.03],
]
const BITS = 24
const TAIL_X = 24
const PAW_X = 88
const HOWL_COOLDOWN_MS = 15000
const PET_MS = 2600
const HEAD_X = 106
const HEAD_Y = 60

const rand = (a, b) => a + Math.random() * (b - a)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3)

const BODY = [[40, 42, 13], [52, 36, 14], [66, 36, 14], [80, 40, 12], [46, 50, 9], [60, 51, 9], [76, 50, 9], [88, 46, 10]]
const TAIL = [[34, 28, 9], [30, 20, 8], [38, 13, 7], [47, 14, 5]]
const HEAD = [[90, 34, 11], [98, 26, 12], [104, 32, 7]]
const LEGS = [
  { x: 36, far: true, step: 'b', end: 'back' },
  { x: 74, far: true, step: 'a', end: 'front' },
  { x: 46, far: false, step: 'a', end: 'back' },
  { x: 84, far: false, step: 'b', end: 'front' },
]

function Fluff({ circles }) {
  return (
    <>
      {circles.map(([x, y, r], i) => <circle key={`o${i}`} className="happy__line" cx={x} cy={y} r={r + 1.6} />)}
      {circles.map(([x, y, r], i) => <circle key={i} className="happy__fur" cx={x} cy={y} r={r} />)}
    </>
  )
}

function Samoyed() {
  return (
    <svg className="happy__svg" viewBox="0 0 122 80" aria-hidden="true">
      <ellipse className="happy__shadow" cx="62" cy="78" rx="36" ry="2.5" />
      <g className="happy__pose happy__pose--sit">
        <Paw x={71} y={40} w={8} h={37} far />
        <Paw x={80} y={40} w={8} h={37} />
      </g>
      <g className="happy__pose happy__pose--lie">
        <Paw x={80} y={67.5} w={27} h={7} far />
        <Paw x={86} y={70} w={28} h={7} />
      </g>
      <g className="happy__body">
        {LEGS.map((leg) => (
          <g key={leg.x} className={`happy__leg happy__leg--${leg.step} happy__leg--${leg.end}${leg.far ? ' happy__leg--far' : ''}`}>
            <rect className="happy__line" x={leg.x - 1.6} y="46" width="11.2" height="31.6" rx="5.6" />
            <rect className={leg.far ? 'happy__shade' : 'happy__fur'} x={leg.x} y="46" width="8" height="30" rx="4" />
          </g>
        ))}
        <g className="happy__tail">
          <Fluff circles={TAIL} />
        </g>
        <Fluff circles={BODY} />
        <g className="happy__head">
          <path className="happy__fur" stroke="#23302f" strokeWidth="1.6" strokeLinejoin="round" d="M88 22 L90 6 L99 16 Z M99 15 L106 4 L109 20 Z" />
          <Fluff circles={HEAD} />
          <ellipse className="happy__line" cx="109" cy="30" rx="8.6" ry="6.1" />
          <ellipse className="happy__fur" cx="109" cy="30" rx="7" ry="4.5" />
          <circle className="happy__dark" cx="115.6" cy="28.4" r="2.3" />
          <circle className="happy__dark happy__eye-open" cx="100.5" cy="23" r="1.7" />
          <path className="happy__eye-closed" d="M98.6 23.4 Q100.5 25 102.4 23.4" />
          <ellipse className="happy__tongue" cx="111" cy="35.6" rx="1.8" ry="2.4" />
          <path d="M107 33 Q111 36.5 115 32" fill="none" stroke="#1d2324" strokeWidth="1" strokeLinecap="round" />
          <g className="happy__held">
            <circle cx="114" cy="35" r="5.2" fill="#d4e157" stroke="#23302f" strokeWidth="1" />
            <path d="M110 32.5 Q114 35 110.4 38.4" fill="none" stroke="#fbfaf5" strokeWidth="1" />
          </g>
        </g>
      </g>
      <g className="happy__pose happy__pose--sit">
        <Fluff circles={[[46, 62, 13]]} />
        <Paw x={50} y={72} w={20} h={6} />
      </g>
      <g className="happy__pose happy__pose--lie">
        <Fluff circles={[[46, 65, 11]]} />
        <Paw x={48} y={71} w={22} h={6} />
      </g>
      <g className="happy__roll">
        {[[46, -14], [57, 8], [74, -10], [85, 12]].map(([x, r], i) => (
          <g key={x} className="happy__roll-leg" style={{ animationDelay: `${-i * 0.08}s` }}>
            <rect className="happy__line" x={x - 1.6} y="26.4" width="11.2" height="33.2" rx="5.6" transform={`rotate(${r} ${x + 4} 58)`} />
            <rect className={i % 2 ? 'happy__fur' : 'happy__shade'} x={x} y="28" width="8" height="30" rx="4" transform={`rotate(${r} ${x + 4} 58)`} />
          </g>
        ))}
        <Fluff circles={[[26, 66, 7], [19, 61, 6]]} />
        <Fluff circles={[[38, 64, 12], [52, 60, 14], [67, 60, 14], [81, 63, 12], [46, 70, 8], [62, 71, 8], [76, 70, 8]]} />
        <ellipse cx="60" cy="54" rx="15" ry="5" fill="#f4e6df" />
        <path className="happy__fur" stroke="#23302f" strokeWidth="1.6" strokeLinejoin="round" d="M89 73 L84 80 L95 77 Z" />
        <Fluff circles={[[92, 65, 11], [101, 69, 9], [108, 65, 7]]} />
        <path d="M97 66 Q99.5 63.6 102 66" fill="none" stroke="#1d2324" strokeWidth="1.2" strokeLinecap="round" />
        <circle className="happy__dark" cx="114.4" cy="66" r="2.2" />
        <ellipse className="happy__tongue" cx="110" cy="59.5" rx="1.8" ry="3" />
      </g>
    </svg>
  )
}

function Paw({ x, y, w, h, far = false }) {
  const r = Math.min(w, h) / 2
  return (
    <>
      <rect className="happy__line" x={x - 1.6} y={y - 1.6} width={w + 3.2} height={h + 3.2} rx={r + 1.6} />
      <rect className={far ? 'happy__shade' : 'happy__fur'} x={x} y={y} width={w} height={h} rx={r} />
    </>
  )
}

function Critters() {
  return (
    <svg className="happy__critter-svg" viewBox="0 0 48 36" aria-hidden="true">
      <g className="happy__bunny" stroke="#23302f" strokeWidth="1.1" strokeLinejoin="round">
        <g className="happy__bunny-ears">
          <path d="M33 13 C29 8 27 1 29.5 0.5 C32 0 34 7 35 12 Z" fill="#9c8873" />
          <path d="M35 12.5 C33 7 33 0 35.8 0 C38.5 0 38.5 7 37.5 13 Z" fill="#b3a08a" />
          <path d="M36.2 11 C35.4 7 35.4 2.5 36 2" fill="none" stroke="#e7a9a6" strokeWidth="1.2" />
        </g>
        <path d="M6 27 C4 18 11 11.5 21 11.5 C27 11.5 31 14 33 18 L34.5 24 C35 28 33 30.5 30 30.5 L10 30.5 C7.5 30.5 6.3 29.5 6 27 Z" fill="#b3a08a" />
        <ellipse cx="15" cy="31" rx="8.5" ry="2.4" fill="#9c8873" />
        <ellipse cx="32" cy="31.2" rx="2.8" ry="1.6" fill="#9c8873" />
        <circle cx="37.5" cy="17" r="6.2" fill="#b3a08a" />
        <circle cx="5.5" cy="21" r="3.8" fill="#fbfaf5" />
        <circle cx="39.5" cy="15.5" r="1.2" fill="#1d2324" stroke="none" />
        <circle cx="43.4" cy="18.4" r="0.9" fill="#e7a9a6" stroke="none" />
        <path d="M43 20 L46.5 19.5 M43 20.6 L46.3 21.4" stroke="#6d6156" strokeWidth="0.5" />
      </g>
      <g className="happy__squirrel" stroke="#23302f" strokeWidth="1.1" strokeLinejoin="round">
        <path
          className="happy__squirrel-tail"
          d="M19 29 C8 30 1 22 3 12 C4.5 4 12 0 18 2.5 C23 4.5 23.5 11 19 13 C15.5 14.5 13 12 13 15.5 C13 20 17 23 21 25 Z"
          fill="#c98547"
        />
        <path d="M6 10 C7 6 11 3.5 15 4" fill="none" stroke="#e2b07a" strokeWidth="1.2" />
        <path d="M19 31 C17 24 21 18 28 18 C33 18 36 21 36 25 C36 29 33 31 29 31 Z" fill="#b0622c" />
        <path d="M30 30.5 C33 30 35 27.5 34.5 24.5 C33 26.5 31 28 30 30.5 Z" fill="#ecc89e" stroke="none" />
        <circle cx="37" cy="17.5" r="5.4" fill="#b0622c" />
        <path d="M34.5 13 L35.6 8.6 L38 12.8 Z" fill="#b0622c" />
        <ellipse cx="21.5" cy="31.6" rx="5" ry="1.7" fill="#8e4c22" />
        <ellipse cx="33.5" cy="31.8" rx="2" ry="1.3" fill="#8e4c22" />
        <circle cx="39" cy="16.3" r="1.1" fill="#1d2324" stroke="none" />
        <circle cx="42.3" cy="18.6" r="0.8" fill="#1d2324" stroke="none" />
      </g>
    </svg>
  )
}

function Butterfly() {
  return (
    <svg className="happy__butterfly-svg" viewBox="0 0 24 18" aria-hidden="true">
      <g className="happy__wings" stroke="#23302f" strokeWidth="0.9" strokeLinejoin="round">
        <path d="M12 9 C7 0 1 1 2 6 C3 10 8 10 12 9 Z" fill="#f2b84b" />
        <path d="M12 9 C17 0 23 1 22 6 C21 10 16 10 12 9 Z" fill="#f2b84b" />
        <path d="M12 9.5 C8 11 4 14 6 16.5 C8 18 11 14 12 9.5 Z" fill="#e98a3b" />
        <path d="M12 9.5 C16 11 20 14 18 16.5 C16 18 13 14 12 9.5 Z" fill="#e98a3b" />
      </g>
      <path d="M12 5 L12 14" stroke="#23302f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 5 Q10 2 9 1.5 M12 5 Q14 2 15 1.5" fill="none" stroke="#23302f" strokeWidth="0.7" />
    </svg>
  )
}

function HouseFly() {
  return (
    <svg className="happy__housefly-svg" viewBox="0 0 14 10" aria-hidden="true">
      <g className="happy__fly-wings" fill="rgb(220 236 245 / 0.75)" stroke="#23302f" strokeWidth="0.5">
        <ellipse cx="5.5" cy="2.6" rx="3.4" ry="2" transform="rotate(-25 5.5 2.6)" />
        <ellipse cx="7.6" cy="2.4" rx="3.2" ry="1.8" transform="rotate(20 7.6 2.4)" />
      </g>
      <ellipse cx="6.5" cy="6" rx="4" ry="2.4" fill="#2b2f33" />
      <circle cx="10.6" cy="5.4" r="1.9" fill="#2b2f33" />
      <circle cx="11.3" cy="4.8" r="1" fill="#b3362b" />
      <path d="M5 8 L4 9.6 M7 8.2 L7 9.8 M9 8 L10 9.6" stroke="#2b2f33" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  )
}

function Heart() {
  return (
    <svg viewBox="0 0 16 14">
      <path d="M8 13.5 1.6 7.3A3.9 3.9 0 0 1 8 2.4a3.9 3.9 0 0 1 6.4 4.9Z" />
    </svg>
  )
}

function PetHand() {
  return (
    <svg className="happy__pet-svg" viewBox="0 0 32 60" aria-hidden="true">
      <rect x="8" y="-40" width="16" height="66" rx="3" fill="#2f4858" />
      <rect x="7" y="21" width="18" height="6" rx="2" fill="#24394a" />
      {[7.5, 12, 16.5, 21].map((x) => (
        <rect key={x} x={x} y="38" width="4.6" height="16" rx="2.3" fill="#ebbd99" stroke="#23302f" strokeWidth="1.1" />
      ))}
      <path d="M26 33 Q31 36 29.5 43" fill="none" stroke="#23302f" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M26 33 Q31 36 29.5 43" fill="none" stroke="#ebbd99" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="16" cy="35" rx="11" ry="8.5" fill="#ebbd99" stroke="#23302f" strokeWidth="1.1" />
    </svg>
  )
}

function Leaf() {
  return (
    <svg className="happy__leaf-svg" viewBox="0 0 18 12" aria-hidden="true">
      <path d="M1 6 C4 0 12 -0.5 17 6 C12 12.5 4 12 1 6 Z" fill="#d9822b" stroke="#23302f" strokeWidth="0.9" />
      <path d="M1 6 L15 6 M6 6 L9 3 M9 6 L12 3.6 M6 6 L9 9 M9 6 L12 8.4" fill="none" stroke="#9c4f17" strokeWidth="0.6" />
    </svg>
  )
}

function Hand() {
  return (
    <svg className="happy__hand-svg" viewBox="0 0 100 40" aria-hidden="true">
      <rect x="-12" y="11" width="72" height="20" rx="4" fill="#2f4858" />
      <rect x="54" y="10" width="8" height="22" rx="3" fill="#24394a" />
      <ellipse cx="72" cy="21" rx="12" ry="9" fill="#ebbd99" stroke="#23302f" strokeWidth="1.2" />
      <rect x="74" y="12" width="17" height="6" rx="3" fill="#ebbd99" stroke="#23302f" strokeWidth="1.2" />
      <rect x="74" y="18.5" width="15" height="6" rx="3" fill="#ebbd99" stroke="#23302f" strokeWidth="1.2" />
      <path d="M66 14 Q72 6 80 9" fill="#ebbd99" stroke="#23302f" strokeWidth="1.2" />
      <g className="happy__hand-treat">
        <Bone x={84} y={6} />
      </g>
    </svg>
  )
}

function Bone({ x = 0, y = 0 }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="#d39a5d" stroke="#23302f" strokeWidth="1">
      <path d="M3 2.5 a2.3 2.3 0 1 1 2.6 -1.4 h6.8 a2.3 2.3 0 1 1 2.6 1.4 a2.3 2.3 0 1 1 -2.6 1.4 h-6.8 a2.3 2.3 0 1 1 -2.6 -1.4 Z" />
    </g>
  )
}

export default function Happy() {
  const refs = {
    track: useRef(null),
    dog: useRef(null),
    flip: useRef(null),
    bubble: useRef(null),
    critter: useRef(null),
    critterFlip: useRef(null),
    ball: useRef(null),
    butterfly: useRef(null),
    housefly: useRef(null),
    houseflyFlip: useRef(null),
    leaf: useRef(null),
    mound: useRef(null),
    bits: useRef(null),
    hand: useRef(null),
    handFlip: useRef(null),
    treat: useRef(null),
  }
  const clickRef = useRef(() => {})

  useEffect(() => {
    const el = Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, r.current]))
    const box = { w: 0, g0: 0, g1: 0 }
    const measure = () => {
      const parent = el.track.parentElement
      const cs = getComputedStyle(parent)
      const inner = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      box.w = el.track.clientWidth
      box.g0 = (box.w - inner) / 2
      box.g1 = box.g0 + inner
    }
    measure()

    const s = {
      mode: 'walk',
      phase: '',
      t: 0,
      x: box.g0 + (box.g1 - box.g0 - DOG_W) * 0.2,
      dir: 1,
      rest: 0,
      sniff: 0,
      untilSniff: rand(3000, 6000),
      wag: 0,
      untilWag: rand(1500, 4000),
      next: rand(3500, 5500),
      last: '',
      talk: 0,
      bark: 0,
      critter: null,
      ball: null,
      treat: null,
      fly: null,
      bug: null,
      leaf: null,
      mound: null,
      bits: [],
      spray: 0,
      gas: 0,
      howledAt: -Infinity,
      clock: 0,
      y: 0,
    }
    let visible = false
    const pool = [...el.bits.children]
    const spawn = (kind, x, y, vx, vy, life) => {
      if (s.bits.length >= BITS) s.bits.shift()
      s.bits.push({ kind, x, y, vx, vy, life, max: life })
    }
    const pawX = () => (s.dir === 1 ? s.x + PAW_X * SCALE : s.x + DOG_W - PAW_X * SCALE)
    const minX = () => box.g0
    const maxX = () => Math.max(box.g0, box.g1 - DOG_W)
    const onLine = (x) => Math.min(maxX(), Math.max(minX(), x))
    const treatSpot = (side) => onLine(side === 'left' ? HAND_W + 120 : box.w - HAND_W - 120 - DOG_W)
    const center = () => s.x + DOG_W / 2
    const headX = () => (s.dir === 1 ? s.x + HEAD_X * SCALE : s.x + DOG_W - HEAD_X * SCALE)
    const buzz = (f, tx, ty, max, dt) => {
      const k = dt / 1000
      f.jt -= dt
      if (f.jt <= 0) {
        f.jx = rand(-1, 1)
        f.jy = rand(-1, 1)
        f.jt = rand(70, 180)
      }
      f.vx += ((tx - f.x) * 22 - f.vx * 5 + f.jx * 1500) * k
      f.vy += ((ty - f.y) * 22 - f.vy * 5 + f.jy * 1500) * k
      const speed = Math.hypot(f.vx, f.vy)
      if (speed > max) {
        f.vx *= max / speed
        f.vy *= max / speed
      }
      f.x += f.vx * k
      f.y = Math.max(6, f.y + f.vy * k)
    }
    const face = (x) => {
      if ((x - center()) * s.dir < -20) s.dir = -s.dir
    }
    const dartGoal = (f) => {
      let gx = f.x + pick([-1, 1]) * rand(160, 320)
      if (gx < box.g0 + 30 || gx > box.g1 - 30) gx = 2 * f.x - gx
      f.gx = Math.min(box.g1 - 30, Math.max(box.g0 + 30, gx))
      f.gy = rand(18, 44)
    }
    const mouth = (pose) => {
      const [mx, my] = MOUTH[pose]
      const px = mx * SCALE
      return { x: s.dir === 1 ? s.x + px : s.x + DOG_W - px, y: (80 - my) * SCALE }
    }
    const say = (text, ms) => {
      el.bubble.textContent = text
      s.talk = ms
    }
    const enter = (mode, phase = '') => {
      s.mode = mode
      s.phase = phase
      s.t = 0
    }
    const setPhase = (phase) => {
      s.phase = phase
      s.t = 0
    }
    const moveToward = (target, speed, dt) => {
      const dx = target - s.x
      if (Math.abs(dx) < 1) return true
      s.dir = dx > 0 ? 1 : -1
      s.x += Math.sign(dx) * Math.min(Math.abs(dx), (speed * dt) / 1000)
      return false
    }
    const wander = (dt, speed) => {
      if (s.rest > 0) {
        s.rest -= dt
        if (s.rest <= 0) s.sniff = 0
        return false
      }
      s.x += (s.dir * speed * dt) / 1000
      s.untilSniff -= dt
      if (s.x >= maxX() || s.x <= minX()) {
        s.x = Math.min(maxX(), Math.max(minX(), s.x))
        s.dir = s.x >= maxX() ? -1 : 1
        s.rest = 900
      } else if (s.untilSniff <= 0) {
        s.rest = s.sniff = 1500
        s.untilSniff = rand(5000, 9000)
      }
      return s.rest <= 0
    }

    const startEvent = () => {
      const options = EVENTS.filter(([name]) => name !== s.last)
      const total = options.reduce((sum, [, w]) => sum + w, 0)
      let roll = Math.random() * total
      const [name] = options.find(([, w]) => (roll -= w) <= 0) || options[0]
      s.last = name
      s.rest = s.sniff = 0
      const fromLeft = center() > box.w / 2
      if (name === 'chase') {
        const room = s.dir === 1 ? maxX() - s.x : s.x - minX()
        if (room < 200) s.dir = -s.dir
        s.critter = { kind: pick(['bunny', 'squirrel']), x: s.dir === 1 ? -CRITTER_W - 6 : box.w + 6, dir: s.dir, t: 0 }
        enter('chase', 'sniff')
      } else if (name === 'ball') {
        const landing = box.g0 + (box.g1 - box.g0) * rand(0.2, 0.5)
        const speed = Math.max(rand(260, 340), landing / 2)
        s.ball = { x: fromLeft ? -16 : box.w + 2, y: 96, vx: (fromLeft ? 1 : -1) * speed, vy: 80, held: false, inside: false, fade: 1 }
        enter('ball', 'watch')
      } else if (name === 'shake') {
        s.spray = 0
        enter('shake', 'shake')
      } else if (name === 'dig') {
        s.spray = 0
        s.mound = { x: pawX(), size: 0, life: 10000 }
        enter('dig', 'dig')
      } else if (name === 'leaf') {
        const x = Math.min(box.g1 - 40, Math.max(box.g0 + 40, center() + s.dir * rand(180, 320)))
        s.leaf = { x0: x, x, y: 175, t: 0, caught: false }
        enter('leaf', 'watch')
      } else if (name === 'howl') {
        s.howledAt = s.clock
        enter('howl', 'sit')
      } else if (name === 'zoomies') {
        enter('zoomies', 'bow')
        say('Arf!', 800)
      } else if (name === 'butterfly') {
        const x = fromLeft ? -24 : box.w + 24
        s.fly = { x, y: 92, speed: Math.max(90, Math.abs(x - center()) / 5), t: 0, fade: 1 }
        enter('butterfly', 'in')
      } else if (name === 'fly') {
        s.bug = { x: fromLeft ? -14 : box.w + 14, y: 110, vx: 0, vy: 0, jx: 0, jy: 0, jt: 0, fade: 1, hidden: false }
        enter('fly', 'in')
      } else if (name === 'treat') {
        const side = Math.random() < 0.5 ? 'left' : 'right'
        s.treat = { side, target: treatSpot(side) }
        enter('treat', 'in')
      } else {
        enter('sleep', 'lie')
      }
    }

    const endEvent = () => {
      s.critter = null
      s.treat = null
      s.fly = null
      s.bug = null
      s.leaf = null
      s.y = 0
      s.next = rand(5000, 9000)
      enter('walk')
    }

    const step = (dt) => {
      s.t += dt
      s.clock += dt
      s.bits = s.bits.filter((b) => {
        b.life -= dt
        const air = b.kind === 'puff' || b.kind === 'gust'
        if (air) {
          b.vx *= Math.exp((-2.5 * dt) / 1000)
          b.vy += (12 * dt) / 1000
        } else {
          b.vy -= (900 * dt) / 1000
        }
        b.x += (b.vx * dt) / 1000
        b.y += (b.vy * dt) / 1000
        if (b.y <= 0) {
          b.y = 0
          b.vy = 0
          b.vx *= 0.6
        }
        return b.life > 0
      })
      if (s.mound) {
        s.mound.life -= dt
        if (s.mound.life <= 0) s.mound = null
      }
      s.talk = Math.max(0, s.talk - dt)
      s.bark = Math.max(0, s.bark - dt)
      s.untilWag -= dt
      if (s.untilWag <= 0) {
        s.wag = rand(1200, 2200)
        s.untilWag = rand(3500, 7500)
      }
      s.wag = Math.max(0, s.wag - dt)

      const pose = { wag: s.wag > 0 }

      if (s.mode === 'walk') {
        if (s.bark > 0) {
          pose.catch = pose.wag = true
        } else {
          pose.walk = wander(dt, WALK)
          pose.sniff = s.sniff > 0
          s.next -= dt
          if (s.rest <= 0) {
            if (s.next <= 0) startEvent()
          }
        }
      } else if (s.mode === 'chase') {
        const c = s.critter
        c.t += dt
        c.x += (c.dir * (s.phase === 'sniff' ? CRITTER_SPEED : CRITTER_BOLT) * dt) / 1000
        const passed = c.dir === 1 ? c.x > s.x + DOG_W + 16 : c.x + CRITTER_W < s.x - 16
        if (s.phase === 'sniff') {
          pose.sniff = true
          if (passed) setPhase('startle')
        } else if (s.phase === 'startle') {
          pose.catch = pose.alert = true
          if (s.t > 520) {
            setPhase('run')
            say('Woof!', 900)
          }
        } else if (s.phase === 'run') {
          s.dir = c.dir
          s.x += (s.dir * GALLOP * dt) / 1000
          pose.gallop = true
          if (s.x >= maxX() || s.x <= minX()) {
            s.x = Math.min(maxX(), Math.max(minX(), s.x))
            setPhase('pant')
          }
        } else {
          pose.wag = true
          pose.pant = s.t < 1600
          if (s.t > 1800 && (c.x < -60 || c.x > box.w + 60)) {
            s.dir = -s.dir
            endEvent()
          }
        }
      } else if (s.mode === 'ball') {
        const b = s.ball
        if (!b.held) {
          b.vy -= (1100 * dt) / 1000
          b.y += (b.vy * dt) / 1000
          if (b.y <= 0) {
            b.y = 0
            b.vy = Math.abs(b.vy) > 70 ? -b.vy * 0.55 : 0
          }
          b.x += (b.vx * dt) / 1000
          if (b.y === 0) b.vx *= Math.exp((-1.6 * dt) / 1000)
          if (!b.inside && b.y === 0 && Math.abs(b.vx) < 30) b.vx = (b.x < box.g0 ? 1 : -1) * 160
          if (b.x > box.g0 && b.x < box.g1 - 14) b.inside = true
          if (b.inside && (b.x < box.g0 || b.x > box.g1 - 14)) {
            b.x = Math.min(box.g1 - 14, Math.max(box.g0, b.x))
            b.vx = -b.vx * 0.5
          }
        }
        if (s.phase === 'watch') {
          s.dir = b.x + 7 > center() ? 1 : -1
          pose.wag = true
          if (s.t > 450) setPhase('go')
        } else if (s.phase === 'go') {
          s.dir = b.x + 7 > center() ? 1 : -1
          const reach = MOUTH.stand[0] * SCALE
          const target = s.dir === 1 ? b.x + 7 - reach : b.x + 7 - (DOG_W - reach)
          const arrived = moveToward(onLine(target), GALLOP, dt)
          pose.gallop = !arrived
          pose.wag = arrived
          if (Math.abs(mouth('stand').x - (b.x + 7)) < 12 && b.y < 26) {
            b.held = true
            setPhase('carry')
          }
        } else if (s.phase === 'carry') {
          pose.walk = wander(dt, TROT * 0.7)
          pose.wag = true
          if (s.t > 4500 && s.rest <= 0) {
            const m = mouth('stand')
            Object.assign(b, { held: false, x: m.x - 7, y: m.y - 10, vx: s.dir * 40, vy: 0 })
            setPhase('after')
          }
        } else {
          pose.walk = wander(dt, WALK)
          b.fade = Math.min(1, Math.max(0, (3000 - s.t) / 1000))
          if (s.t > 3000) {
            s.ball = null
            endEvent()
          }
        }
      } else if (s.mode === 'treat') {
        const tr = s.treat
        const faceSide = tr.side === 'left' ? -1 : 1
        if (s.phase === 'in') {
          const arrived = moveToward(tr.target, TROT, dt)
          pose.walk = !arrived
          pose.wag = true
          if (arrived && s.t > 700) {
            s.dir = faceSide
            setPhase('sit')
          }
        } else if (s.phase === 'sit') {
          s.dir = faceSide
          pose.sit = pose.wag = true
          if (s.t > 1100) {
            const from = tr.side === 'left' ? 92 : box.w - 92
            const dist = Math.abs(mouth('sit').x - from)
            tr.flight = Math.min(1500, Math.max(TREAT_FLIGHT_MS, 400 + dist * 1.1))
            tr.arc = Math.min(220, 60 + dist * 0.22)
            setPhase('throw')
          }
        } else if (s.phase === 'throw') {
          pose.sit = pose.wag = true
          if (s.t > tr.flight) {
            setPhase('catch')
            say('Nom!', 1100)
          }
        } else if (s.phase === 'catch') {
          pose.sit = pose.wag = true
          pose.catch = s.t < 450
          if (s.t > 1200) setPhase('out')
        } else {
          pose.wag = true
          if (s.t > 700) endEvent()
        }
      } else if (s.mode === 'pet') {
        pose.pet = pose.wag = true
        if (s.phase === 'belly') {
          pose.belly = true
          if (s.t > 3000) setPhase('up')
        } else if (s.phase === 'up') {
          pose.pet = false
          if (s.t > 450) enter('walk')
        } else if (s.t > (s.rollOver ? 1300 : PET_MS)) {
          if (s.rollOver) setPhase('belly')
          else enter('walk')
        }
      } else if (s.mode === 'shake') {
        if (s.phase === 'shake') {
          pose.shake = true
          s.spray -= dt
          if (s.spray <= 0) {
            s.spray = 45
            spawn('fluff', center() + rand(-34, 34), rand(28, 56), rand(-180, 180), rand(60, 220), rand(500, 850))
            spawn('fluff', center() + rand(-34, 34), rand(28, 56), rand(-180, 180), rand(60, 220), rand(500, 850))
          }
          if (s.t > 950) setPhase('after')
        } else {
          pose.wag = true
          if (s.t > 700) endEvent()
        }
      } else if (s.mode === 'dig') {
        if (s.phase === 'dig') {
          pose.dig = pose.wag = true
          s.mound.size = Math.min(1, s.t / 2400)
          s.spray -= dt
          if (s.spray <= 0) {
            s.spray = 60
            spawn('dirt', pawX() - s.dir * 6, 3, -s.dir * rand(90, 240), rand(120, 280), rand(600, 950))
          }
          if (s.t > 2400) setPhase('sniff')
        } else {
          pose.sniff = true
          if (s.t > 900) {
            s.spray = 0
            enter('shake', 'shake')
          }
        }
      } else if (s.mode === 'leaf') {
        const lf = s.leaf
        lf.t += dt
        if (!lf.caught) {
          lf.y = Math.max(0, lf.y - (30 * dt) / 1000)
          lf.x = lf.x0 + Math.sin(lf.t / 520) * 22
        }
        if (s.phase === 'watch') {
          s.dir = lf.x > center() ? 1 : -1
          pose.look = pose.wag = true
          if (lf.y < 72) setPhase('crouch')
        } else if (s.phase === 'crouch') {
          pose.bow = true
          if (s.t > 550) {
            s.from = s.x
            s.to = onLine(lf.x - (s.dir === 1 ? PAW_X * SCALE : DOG_W - PAW_X * SCALE))
            setPhase('pounce')
          }
        } else if (s.phase === 'pounce') {
          const u = Math.min(1, s.t / 520)
          s.y = 34 * 4 * u * (1 - u)
          s.x = s.from + (s.to - s.from) * ease(u)
          pose.jump = true
          if (u >= 1) {
            s.y = 0
            lf.caught = true
            for (let n = 0; n < 7; n++) spawn('leaf', pawX(), 4, rand(-130, 130), rand(80, 200), rand(400, 700))
            say('Gotcha!', 1100)
            setPhase('proud')
          }
        } else {
          pose.wag = true
          if (s.t > 1400) endEvent()
        }
      } else if (s.mode === 'howl') {
        if (s.phase === 'sit') {
          pose.sit = true
          if (s.t > 500) {
            setPhase('howl')
            say('Awoooo!', 2300)
          }
        } else if (s.phase === 'howl') {
          pose.sit = pose.howl = true
          if (s.t > 2400) setPhase('out')
        } else {
          pose.wag = true
          if (s.t > 500) endEvent()
        }
      } else if (s.mode === 'zoomies') {
        if (s.phase === 'bow') {
          pose.bow = pose.wag = true
          if (s.t > 1000) {
            s.laps = 3 + Math.floor(Math.random() * 2)
            s.goal = onLine(s.x + s.dir * rand(220, 480))
            setPhase('zoom')
          }
        } else if (s.phase === 'zoom') {
          pose.gallop = true
          if (moveToward(s.goal, ZOOM, dt)) {
            s.laps -= 1
            if (s.laps <= 0) setPhase('pant')
            else s.goal = onLine(s.x - s.dir * rand(220, 480))
          }
        } else {
          pose.pant = pose.wag = true
          if (s.t > 2200) endEvent()
        }
      } else if (s.mode === 'butterfly') {
        const f = s.fly
        f.t += dt
        if (s.phase === 'in') {
          const dx = headX() - f.x
          f.x += Math.sign(dx) * Math.min(Math.abs(dx), (f.speed * dt) / 1000)
          f.y = 92 + Math.sin(f.t / 260) * 9
          s.dir = f.x > center() ? 1 : -1
          pose.wag = true
          pose.look = Math.abs(dx) < 260
          if (Math.abs(dx) < 4) {
            f.ax = headX()
            setPhase('hover')
          }
        } else if (s.phase === 'hover') {
          f.x = f.ax + Math.sin(s.t / 330) * 30
          f.y = 90 + Math.cos(s.t / 210) * 10
          s.dir = f.x > center() ? 1 : -1
          pose.look = pose.wag = true
          if (s.t > 2000) {
            f.vx = s.dir * rand(90, 130)
            f.vy = 70
            setPhase('pounce')
          }
        } else {
          f.x += (f.vx * dt) / 1000
          f.y += (f.vy * dt) / 1000 + Math.sin(f.t / 120) * 0.6
          if (s.phase === 'pounce') {
            const u = Math.min(1, s.t / 620)
            s.y = 46 * 4 * u * (1 - u)
            s.x = onLine(s.x + (s.dir * 90 * dt) / 1000)
            pose.jump = true
            if (u >= 1) {
              s.y = 0
              setPhase('miss')
              say('Hmph.', 1100)
            }
          } else {
            pose.look = true
            f.fade = Math.max(0, 1 - s.t / 1600)
            if (s.t > 1800) endEvent()
          }
        }
      } else if (s.mode === 'fly') {
        const f = s.bug
        const headY = HEAD_Y + s.y
        if (s.phase === 'in') {
          buzz(f, headX(), headY + 14, 260, dt)
          face(f.x)
          pose.wag = true
          pose.look = Math.abs(f.x - headX()) < 200
          if (Math.hypot(f.x - headX(), f.y - headY) < 40 || s.t > 8000) {
            s.darts = 2 + Math.floor(Math.random() * 2)
            setPhase('buzz')
          }
        } else if (s.phase === 'buzz') {
          buzz(f, center() + s.dir * 20 + Math.cos(s.t / 260) * 55, headY + 6 + Math.sin(s.t / 120) * 16, 320, dt)
          face(f.x)
          pose.look = f.y > headY
          pose.catch = s.t % 650 < 170
          pose.wag = true
          if (s.t > 3200) {
            dartGoal(f)
            say('Woof!', 800)
            setPhase('dart')
          }
        } else if (s.phase === 'dart') {
          buzz(f, f.gx, f.gy, 430, dt)
          const head = HEAD_X * SCALE
          const arrived = moveToward(onLine(f.x > center() ? f.x - head : f.x - DOG_W + head), GALLOP, dt)
          if (arrived) face(f.x)
          pose.gallop = !arrived
          pose.wag = arrived
          if ((arrived && Math.abs(f.x - f.gx) < 30) || s.t > 3000) setPhase('snap')
        } else if (s.phase === 'snap') {
          const u = Math.min(1, s.t / 420)
          s.y = 26 * 4 * u * (1 - u)
          pose.jump = pose.catch = true
          buzz(f, f.gx + s.dir * 40, f.gy + 50, 430, dt)
          if (u >= 1) {
            s.y = 0
            s.darts -= 1
            if (s.darts > 0) {
              dartGoal(f)
              setPhase('dart')
            } else if (Math.random() < 0.35) {
              f.hidden = true
              say('Chomp!', 900)
              setPhase('chomp')
            } else {
              f.ex = f.x > box.w / 2 ? box.w + 60 : -60
              say('Hmph.', 1100)
              setPhase('leave')
            }
          }
        } else if (s.phase === 'chomp') {
          pose.sit = true
          pose.catch = s.t < 300
          if (s.t > 1000) {
            const m = mouth('sit')
            Object.assign(f, { x: m.x, y: m.y, vx: s.dir * 160, vy: 120, hidden: false, ex: s.dir === 1 ? box.w + 60 : -60 })
            say('Ptooey!', 1100)
            setPhase('spit')
          }
        } else {
          buzz(f, f.ex, 150, 280, dt)
          f.fade = Math.max(0, 1 - s.t / 2000)
          if (s.phase === 'spit') {
            pose.sit = true
            pose.catch = s.t < 250
          } else {
            face(f.x)
            pose.look = true
          }
          if (s.t > 2000) endEvent()
        }
      } else if (s.mode === 'sleep') {
        if (s.phase === 'lie') {
          pose.lie = true
          if (s.t > 800) {
            setPhase('sleep')
            s.sleepFor = rand(6000, 9000)
          }
        } else if (s.phase === 'sleep') {
          pose.lie = pose.sleep = true
          pose.wag = false
          if (s.t > s.sleepFor) setPhase('wake')
        } else if (s.phase === 'wake') {
          pose.lie = true
          if (s.t > 500) setPhase('yawn')
        } else if (s.phase === 'yawn') {
          pose.lie = pose.yawn = true
          if (s.t > 1200) setPhase('stretch')
        } else {
          pose.bow = pose.stretch = pose.wag = true
          if (s.t > 1400) endEvent()
        }
      }

      if (s.bark > 0) pose.catch = true
      if (pose.gallop) {
        s.gas -= dt
        if (s.gas <= 0) {
          s.gas = rand(70, 120)
          const tail = s.dir === 1 ? s.x + TAIL_X * SCALE : s.x + DOG_W - TAIL_X * SCALE
          spawn('puff', tail, s.y + rand(24, 40), -s.dir * rand(40, 90), rand(-10, 20), rand(500, 800))
          if (Math.random() < 0.45) spawn('gust', tail - s.dir * rand(6, 24), s.y + rand(18, 54), -s.dir * rand(160, 240), 0, rand(220, 340))
        }
      }
      return pose
    }

    const render = (pose) => {
      el.dog.style.transform = `translate3d(${s.x}px, ${-s.y}px, 0)`
      el.dog.style.setProperty('--lift', s.y.toFixed(1))
      el.dog.dataset.dir = s.dir
      el.flip.dataset.dir = s.dir
      const cls = ['happy__dog']
      if (pose.walk) cls.push('is-walking')
      if (pose.gallop) cls.push('is-galloping')
      if (pose.bow) cls.push('is-bowing')
      if (pose.jump) cls.push('is-jumping')
      if (pose.look) cls.push('is-looking')
      if (pose.pant) cls.push('is-panting')
      if (pose.pet) cls.push('is-petted')
      if (pose.alert) cls.push('is-alert')
      if (pose.reach) cls.push('is-reaching')
      if (pose.pawUp) cls.push('is-pawing-up')
      if (pose.belly) cls.push('is-belly')
      if (pose.shake) cls.push('is-shaking')
      if (pose.dig) cls.push('is-digging')
      if (pose.howl) cls.push('is-howling')
      if (pose.yawn) cls.push('is-yawning')
      if (pose.stretch) cls.push('is-stretching')
      if (pose.sit) cls.push('is-sitting')
      if (pose.lie) cls.push('is-lying')
      if (pose.sleep) cls.push('is-sleeping')
      if (pose.catch) cls.push('is-catching')
      if (pose.wag) cls.push('is-wagging')
      if (pose.sniff) cls.push('is-sniffing')
      if (s.ball?.held) cls.push('has-ball')
      if (s.talk > 0) cls.push('is-talking')
      else el.bubble.textContent = 'Happy'
      el.dog.className = cls.join(' ')

      const c = s.critter
      if (c) {
        const bunny = c.kind === 'bunny'
        const phase = c.t * (bunny ? 0.012 : 0.028)
        const hop = Math.abs(Math.sin(phase)) * (bunny ? 18 : 5)
        const lean = -Math.sign(Math.sin(phase)) * Math.cos(phase) * (bunny ? 16 : 6)
        el.critter.dataset.kind = c.kind
        el.critter.style.opacity = 1
        el.critter.style.transform = `translate3d(${c.x}px, ${-hop}px, 0)`
        el.critterFlip.style.transform = `scaleX(${c.dir}) rotate(${lean}deg)`
      } else {
        el.critter.style.opacity = 0
      }

      const b = s.ball
      if (b && !b.held) {
        el.ball.style.opacity = b.fade
        el.ball.style.transform = `translate3d(${b.x}px, ${-b.y}px, 0) rotate(${b.x * 4}deg)`
      } else {
        el.ball.style.opacity = 0
      }

      pool.forEach((node, i) => {
        const b = s.bits[i]
        if (!b) {
          node.style.opacity = 0
          return
        }
        node.dataset.kind = b.kind
        const left = b.life / b.max
        if (b.kind === 'puff') {
          node.style.opacity = (left * 0.85).toFixed(2)
          node.style.transform = `translate3d(${b.x}px, ${-b.y}px, 0) scale(${1 + (1 - left) * 1.8})`
        } else if (b.kind === 'gust') {
          node.style.opacity = (left * 0.7).toFixed(2)
          node.style.transform = `translate3d(${b.x}px, ${-b.y}px, 0) scaleX(${0.6 + left})`
        } else {
          node.style.opacity = Math.min(1, b.life / 250)
          node.style.transform = `translate3d(${b.x}px, ${-b.y}px, 0)`
        }
      })

      if (s.mound) {
        el.mound.style.opacity = Math.min(1, s.mound.life / 1500)
        el.mound.style.transform = `translate3d(${s.mound.x - 15}px, 0, 0) scale(${s.mound.size})`
      } else {
        el.mound.style.opacity = 0
      }

      const lf = s.leaf
      if (lf && !lf.caught) {
        el.leaf.style.opacity = 1
        el.leaf.style.transform = `translate3d(${lf.x - 9}px, ${-lf.y}px, 0) rotate(${Math.sin(lf.t / 520) * 40}deg)`
      } else {
        el.leaf.style.opacity = 0
      }

      const f = s.fly
      if (f) {
        el.butterfly.style.opacity = f.fade
        el.butterfly.style.transform = `translate3d(${f.x - 12}px, ${-f.y}px, 0)`
      } else {
        el.butterfly.style.opacity = 0
      }

      const bug = s.bug
      if (bug && !bug.hidden) {
        el.housefly.style.opacity = bug.fade
        el.housefly.style.transform = `translate3d(${bug.x - 7}px, ${-bug.y}px, 0)`
        el.houseflyFlip.style.transform = `scaleX(${bug.vx < 0 ? -1 : 1})`
      } else {
        el.housefly.style.opacity = 0
      }

      const tr = s.treat
      if (tr) {
        const p = s.phase === 'in' ? ease(s.t / 700) : s.phase === 'out' ? 1 - ease(s.t / 700) : 1
        const hx = tr.side === 'left' ? -HAND_W + HAND_W * p : box.w - HAND_W * p
        el.hand.style.opacity = 1
        el.hand.style.transform = `translate3d(${hx}px, ${-HAND_Y}px, 0)`
        el.handFlip.dataset.side = tr.side
        el.hand.classList.toggle('has-treat', s.phase === 'in' || s.phase === 'sit')
        el.hand.classList.toggle('is-throwing', s.phase === 'throw' && s.t < 260)

        if (s.phase === 'throw') {
          const u = Math.min(1, s.t / tr.flight)
          const fx = tr.side === 'left' ? hx + 92 : hx + HAND_W - 92
          const fy = HAND_Y + 30
          const m = mouth('sit')
          const x = fx + (m.x - fx) * u - 8
          const y = fy + (m.y - fy) * u + tr.arc * 4 * u * (1 - u) - 4
          el.treat.style.opacity = 1
          el.treat.style.transform = `translate3d(${x}px, ${-y}px, 0) rotate(${u * 540}deg)`
        } else {
          el.treat.style.opacity = 0
        }
      } else {
        el.hand.style.opacity = 0
        el.treat.style.opacity = 0
      }
    }

    clickRef.current = () => {
      if (s.mode === 'sleep' && s.phase !== 'wake') {
        setPhase('wake')
        say('Huh?', 900)
        return
      }
      if (s.mode === 'pet') {
        s.t = Math.min(s.t, 800)
        return
      }
      if (s.mode === 'walk' && s.bark <= 0 && Math.random() < 0.5) {
        s.rest = s.sniff = 0
        s.rollOver = Math.random() < 0.4
        enter('pet', 'pat')
        return
      }
      if (s.mode === 'walk') s.bark = 900
      s.wag = Math.max(s.wag, 1500)
      say('Woof!', 900)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      s.x = (box.g0 + box.g1 - DOG_W) / 2
      render({ sit: true })
      return
    }

    const refit = () => {
      const before = { ...box }
      measure()
      const shift = box.g0 - before.g0
      const b = s.ball
      if (b && !b.held) {
        if (b.inside) b.x = Math.min(box.g1 - 14, Math.max(box.g0, b.x + shift))
        else if (b.vx < 0) b.x += box.w - before.w
      }
      if (s.treat) {
        s.treat.target = treatSpot(s.treat.side)
        s.x = s.phase === 'in' ? onLine(s.x + shift) : s.treat.target
      } else {
        s.x = onLine(s.x + shift)
      }
      if (s.bug) {
        s.bug.x += shift
        if (s.bug.gx !== undefined) s.bug.gx = Math.min(box.g1 - 30, Math.max(box.g0 + 30, s.bug.gx + shift))
      }
    }

    let last = null
    let id = 0
    const tick = (now) => {
      const dt = last === null ? 0 : Math.min(50, now - last)
      last = now
      if (el.track.clientWidth !== box.w) refit()
      render(step(dt))
      id = requestAnimationFrame(tick)
    }
    const onSiren = () => {
      if (!visible || s.mode !== 'walk' || s.clock - s.howledAt < HOWL_COOLDOWN_MS) return
      s.howledAt = s.clock
      s.last = 'howl'
      s.rest = s.sniff = 0
      enter('howl', 'sit')
    }
    window.addEventListener('dispatch:siren', onSiren)

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(id)
      visible = entry.isIntersecting
      if (entry.isIntersecting) {
        last = null
        id = requestAnimationFrame(tick)
      }
    })
    observer.observe(el.track)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(id)
      window.removeEventListener('dispatch:siren', onSiren)
    }
    // Refs are stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={refs.track} className="happy">
      <div ref={refs.critter} className="happy__critter" aria-hidden="true">
        <span ref={refs.critterFlip} className="happy__critter-flip">
          <Critters />
        </span>
      </div>
      <span ref={refs.ball} className="happy__ball" aria-hidden="true" />
      <span ref={refs.mound} className="happy__mound" aria-hidden="true" />
      <span ref={refs.bits} className="happy__bits" aria-hidden="true">
        {Array.from({ length: BITS }, (_, i) => <span key={i} className="happy__bit" />)}
      </span>
      <span ref={refs.leaf} className="happy__leaf" aria-hidden="true">
        <Leaf />
      </span>
      <span ref={refs.butterfly} className="happy__butterfly" aria-hidden="true">
        <Butterfly />
      </span>
      <span ref={refs.housefly} className="happy__housefly" aria-hidden="true">
        <span ref={refs.houseflyFlip} className="happy__housefly-flip">
          <HouseFly />
        </span>
      </span>
      <div ref={refs.hand} className="happy__hand" aria-hidden="true">
        <span ref={refs.handFlip} className="happy__hand-flip">
          <Hand />
        </span>
      </div>
      <span ref={refs.treat} className="happy__treat" aria-hidden="true">
        <svg viewBox="-1 -3 18 11" width="18" height="11">
          <Bone />
        </svg>
      </span>
      <button
        ref={refs.dog}
        type="button"
        className="happy__dog"
        aria-label="Happy, our Samoyed. Click to say hi or give her a pet."
        onClick={() => clickRef.current()}
      >
        <span ref={refs.bubble} className="happy__bubble" aria-live="polite">Happy</span>
        <span className="happy__pet-hand" aria-hidden="true">
          <PetHand />
        </span>
        <span className="happy__alert" aria-hidden="true">!</span>
        <span className="happy__hearts" aria-hidden="true">
          <Heart />
          <Heart />
          <Heart />
        </span>
        <span className="happy__zzz" aria-hidden="true">
          <span>z</span>
          <span>z</span>
          <span>z</span>
        </span>
        <span ref={refs.flip} className="happy__flip" data-dir="1">
          <Samoyed />
        </span>
      </button>
    </div>
  )
}
