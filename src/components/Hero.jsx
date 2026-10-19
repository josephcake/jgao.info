import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
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
  let letterIndex = 0

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
              {word.split('').map((char) => {
                const delay = 0.15 + letterIndex++ * 0.045
                return (
                  <span className="hero__clip" key={char + delay}>
                    <motion.span
                      className="hero__char"
                      initial={reduce ? false : { y: '110%' }}
                      animate={{ y: '0%' }}
                      transition={{ duration: 0.9, ease, delay }}
                    >
                      {char}
                    </motion.span>
                  </span>
                )
              })}
            </span>
          ))}
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
