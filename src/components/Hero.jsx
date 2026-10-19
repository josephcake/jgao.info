import { useEffect, useRef } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { links } from '../data'
import { STORY_END } from '../lib/heroScene'
import Duck from './Duck'

const NAME = ['Joseph', 'Gao']
const ease = [0.22, 1, 0.36, 1]
const ACTS = [
  { at: [0.12, 0.16, 0.28, 0.31], title: 'It started on a tennis court.' },
  { at: [0.36, 0.4, 0.52, 0.55], title: 'Then I built maps for 9-1-1.' },
  { at: [0.62, 0.66, 0.74, 0.77], title: 'Down to the caller’s floor.' },
  { at: [0.8, 0.83, 0.93, 0.96], title: 'After hours, I wire sensors.' },
]

function Act({ progress, at: [a, b, c, d], title }) {
  const visibility = useTransform(progress, (v) => (v > a && v < d + 0.02 ? 'visible' : 'hidden'))
  const y = useTransform(progress, [a, b, c, d], ['105%', '0%', '0%', '-105%'])
  return (
    <motion.div className="hero__act" style={{ visibility }}>
      <p className="hero__act-title">
        <motion.span style={{ y }}>{title}</motion.span>
      </p>
    </motion.div>
  )
}

const STRATA = [1, 2, 3, 4]

// A letter extrudes out of the map on a stack of contour strata, then floods with ink from the
// bottom. Under the pointer it rises higher and its strata pull apart, like a peak.
function Letter({ char, delay, reduce, register }) {
  const ref = useRef(null)
  const rise = useMotionValue(reduce ? 1 : 0)
  const fill = useMotionValue(reduce ? 1 : 0)
  const target = useMotionValue(0)
  const lift = useSpring(target, { stiffness: 260, damping: 22, mass: 0.6 })

  useEffect(() => {
    if (reduce) return undefined
    const a = animate(rise, 1, { duration: 1.3, ease, delay: delay + 0.2 })
    const b = animate(fill, 1, { duration: 0.8, ease: [0.65, 0, 0.35, 1], delay: delay + 0.9 })
    return () => {
      a.stop()
      b.stop()
    }
  }, [reduce, delay, rise, fill])

  useEffect(() => (reduce ? undefined : register({ ref, target })), [reduce, register])

  return (
    <motion.span
      className="hero__letter"
      ref={ref}
      style={{ '--rise': rise, '--fill': fill, '--lift': lift }}
    >
      {STRATA.map((i) => (
        <span className="hero__slice" key={i} style={{ '--i': i }}>
          {char}
        </span>
      ))}
      <span className="hero__char" data-char={char}>
        {char}
      </span>
    </motion.span>
  )
}

export default function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useTransform(scrollYProgress, (v) => v * STORY_END)
  const introOpacity = useTransform(p, [0, 0.045], [1, 0])
  const introY = useTransform(p, [0, 0.06], ['0vh', '-6vh'])
  const nameOpacity = useTransform(p, [0.01, 0.075], [1, 0])
  const nameY = useTransform(p, [0, 0.09], ['0vh', '-18vh'])
  const nameScale = useTransform(p, [0, 0.09], [1, 0.9])
  const reach = useTransform(p, (v) => (v > 0.04 ? 'none' : 'auto'))
  const duckShown = useTransform(p, (v) => (v > 0.04 ? 'hidden' : 'visible'))
  // The name is a relief model on the map: it stands up out of the ground on load, tilts with
  // the pointer, and lies back down into the contours as the fly-through starts.
  const stand = useMotionValue(reduce ? 0 : 64)
  const tiltX = useSpring(0, { stiffness: 120, damping: 20 })
  const tiltY = useSpring(0, { stiffness: 120, damping: 20 })
  const lieDown = useTransform(p, [0, 0.08], [0, 58])
  const rotateX = useTransform([stand, tiltX, lieDown], ([a, b, c]) => a + b + c)

  useEffect(() => {
    if (reduce) return undefined
    const a = animate(stand, 14, { duration: 2, ease, delay: 0.1 })
    return () => a.stop()
  }, [reduce, stand])

  const letters = useRef(new Set())
  const register = useRef((letter) => {
    letters.current.add(letter)
    return () => letters.current.delete(letter)
  }).current

  useEffect(() => {
    if (reduce) return undefined
    const move = (e) => {
      if (e.pointerType !== 'mouse') return
      tiltX.set((e.clientY / window.innerHeight - 0.5) * -10)
      tiltY.set((e.clientX / window.innerWidth - 0.5) * 14)
      letters.current.forEach(({ ref, target }) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.height * 0.55)
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.9)
        target.set(Math.exp(-(dx * dx + dy * dy)))
      })
    }
    const leave = () => {
      tiltX.set(0)
      tiltY.set(0)
      letters.current.forEach(({ target }) => target.set(0))
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [reduce, tiltX, tiltY])

  let letterIndex = 0

  return (
    <header className="hero" id="top" ref={ref}>
      <div className="hero__stage">
        <motion.h1
          className="hero__name"
          aria-label="Joseph Gao"
          style={reduce ? undefined : { opacity: nameOpacity, y: nameY, scale: nameScale }}
        >
          <motion.span className="hero__plane" style={reduce ? undefined : { rotateX, rotateY: tiltY }}>
            {NAME.map((word) => (
              <span className="hero__word" key={word} aria-hidden="true">
                {word.split('').map((char) => {
                  const delay = 0.15 + letterIndex++ * 0.06
                  return <Letter key={char + delay} char={char} delay={delay} reduce={reduce} register={register} />
                })}
              </span>
            ))}
          </motion.span>
        </motion.h1>

        <motion.div
          className="hero__fade"
          style={reduce ? undefined : { opacity: introOpacity, y: introY, pointerEvents: reach }}
        >
          <motion.div
            className="hero__intro"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.75 }}
          >
            <p className="hero__lede">
              I build the maps 9-1-1 uses to find people. Before that, I taught tennis in Central
              Park.
            </p>
            <p className="hero__links">
              <a href={links.github} target="_blank" rel="noreferrer">GitHub</a>
              <a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              <a href={links.terrin} target="_blank" rel="noreferrer">Terrin.io</a>
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero__duck"
          style={reduce ? undefined : { opacity: introOpacity, visibility: duckShown }}
        >
          <Duck spot="hero" />
        </motion.div>

        {!reduce && ACTS.map((act) => <Act key={act.title} progress={p} {...act} />)}
      </div>
    </header>
  )
}
