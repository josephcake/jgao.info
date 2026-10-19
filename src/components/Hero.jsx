import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { links } from '../data'
import { STORY_END } from '../lib/heroScene'
import Duck from './Duck'
import NameScan from './NameScan'

const NAME = ['Joseph', 'Gao']
const ease = [0.22, 1, 0.36, 1]
const ACTS = [
  { at: [0.1, 0.13, 0.22, 0.25], title: 'It started in New York.' },
  { at: [0.25, 0.28, 0.37, 0.4], title: 'I map cities in 3D for 9-1-1.' },
  { at: [0.41, 0.44, 0.48, 0.5], title: 'A call comes in.' },
  { at: [0.5, 0.52, 0.57, 0.59], title: 'The scan reads every floor.' },
  { at: [0.6, 0.62, 0.76, 0.78], title: 'From the lobby up to 23.' },
  { at: [0.79, 0.81, 0.86, 0.88], title: 'Sensors find who’s inside.' },
  { at: [0.88, 0.9, 0.975, 1.005], title: 'Then I guide responders in.' },
  { at: [1.015, 1.045, 1.135, 1.165], title: 'Every building, mapped.' },
  { at: [1.175, 1.205, 1.265, 1.3], title: 'Now I build my own.' },
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
  const p = useTransform(scrollYProgress, (v) => v * STORY_END)
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
