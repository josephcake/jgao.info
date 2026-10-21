import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { links } from '../data'
import { SCROLL_END, storyAt } from '../lib/heroScene'
import Duck from './Duck'
import NameScan from './NameScan'

const NAME = ['Joseph', 'Gao']
const ease = [0.22, 1, 0.36, 1]
const ACTS = [
  { at: [0.1, 0.13, 0.22, 0.25], title: 'It started in New York.' },
  { at: [0.25, 0.28, 0.42, 0.46], title: 'I taught tennis in Central Park.' },
  { at: [0.5, 0.53, 0.65, 0.69], title: 'Then I looked closer.' },
  { at: [0.73, 0.76, 0.85, 0.89], title: 'Down to the fibers.' },
  { at: [0.92, 0.95, 1.14, 1.18], title: 'And taught myself to code.' },
  { at: [1.24, 1.27, 1.5, 1.54], title: 'Software runs on something real.' },
  { at: [1.9, 1.93, 2.08, 2.12], title: 'Built into the things we live with.' },
  { at: [2.32, 2.35, 2.5, 2.54], title: 'Into the home.' },
  { at: [2.62, 2.65, 2.84, 2.88], title: 'Homes that know when to call for help.' },
  { at: [3.02, 3.05, 3.22, 3.26], title: 'Now I’m in Washington.' },
  { at: [3.32, 3.35, 3.48, 3.52], title: 'Mapping the world in 3D.' },
  { at: [3.58, 3.61, 3.72, 3.77], title: 'Now I build my own.' },
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

export default function Hero() {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })
  const p = useTransform(scrollYProgress, (v) => storyAt(v * SCROLL_END).p)
  const introOpacity = useTransform(p, [0, 0.045], [1, 0])
  const introY = useTransform(p, [0, 0.06], ['0vh', '-6vh'])
  const nameOpacity = useTransform(p, [0.01, 0.075], [1, 0])
  const nameY = useTransform(p, [0, 0.09], ['0vh', '-18vh'])
  const nameScale = useTransform(p, [0, 0.09], [1, 0.9])
  const reach = useTransform(p, (v) => (v > 0.04 ? 'none' : 'auto'))
  const duckShown = useTransform(p, (v) => (v > 0.04 ? 'hidden' : 'visible'))

  return (
    <header className="hero" id="top" ref={ref}>
      <div className="hero__stage">
        <motion.h1
          className="hero__name"
          aria-label="Joseph Gao"
          style={reduce ? undefined : { opacity: nameOpacity, y: nameY, scale: nameScale }}
        >
          {NAME.map((word) => (
            <span className="hero__word" key={word} aria-hidden="true">
              {word.split('').map((char, i) => (
                <span className="hero__char" key={char + i}>
                  {char}
                </span>
              ))}
            </span>
          ))}
          {!reduce && <NameScan />}
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
              I build the maps 9-1-1 uses to find people. Before that, I taught tennis in Central Park.
            </p>
            <p className="hero__links">
              <a href={links.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={links.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              <a href={links.terrin} target="_blank" rel="noreferrer">
                Terrin.io
              </a>
              {!reduce && (
                <a className="hero__skip" href="#timeline">
                  Skip the intro
                </a>
              )}
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero__duck"
          style={reduce ? undefined : { opacity: introOpacity, visibility: duckShown }}
        >
          <Duck spot="hero" />
        </motion.div>

        {!reduce && (
          <motion.div className="hero__cue" aria-hidden="true" style={{ opacity: introOpacity }}>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease, delay: 1.4 }}
            >
              Scroll
              <span className="hero__cue-line" />
            </motion.span>
          </motion.div>
        )}

        {!reduce && ACTS.map((act) => <Act key={act.title} progress={p} {...act} />)}
      </div>
    </header>
  )
}
