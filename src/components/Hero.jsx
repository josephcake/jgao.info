import { motion, useReducedMotion } from 'motion/react'
import { links } from '../data'
import Duck from './Duck'

const NAME = ['Joseph', 'Gao']
const ease = [0.22, 1, 0.36, 1]

export default function Hero() {
  const reduce = useReducedMotion()
  let letterIndex = 0

  return (
    <header className="hero" id="top">
      <h1 className="hero__name" aria-label="Joseph Gao">
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
      </h1>

      <motion.div
        className="hero__intro"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease, delay: 0.75 }}
      >
        <p className="hero__lede">
          I build the maps 9-1-1 uses to find people. Before that, I taught tennis in Central
          Park. Scroll to see how one became the other.
        </p>
        <p className="hero__links">
          <a href={links.github} target="_blank" rel="noreferrer">GitHub</a>
          <a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a href={links.terrin} target="_blank" rel="noreferrer">Terrin.io</a>
        </p>
        <p className="hero__hint">
          <span className="only-fine">Press <kbd>⌘K</kbd> anytime to jump around or try a demo.</span>
          <span className="only-touch">Tap Menu anytime to jump around or try a demo.</span>
        </p>
      </motion.div>

      <motion.aside
        className="collar"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease, delay: 1.3 }}
      >
        <svg className="collar__north" viewBox="0 0 24 40">
          <path d="M12 2 L19 30 L12 24 L5 30 Z" />
          <text x="12" y="39" textAnchor="middle">N</text>
        </svg>
        <div className="collar__text">
          <p className="collar__title">A survey of one career</p>
          <p>Central Park, New York, to Washington</p>
          <svg className="collar__scale" viewBox="0 0 204 30">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <rect key={i} x={2 + i * 20} y="2" width="20" height="6" className={i % 2 ? 'is-light' : ''} />
            ))}
            {[0, 5, 10].map((n) => (
              <text key={n} x={2 + n * 20} y="22" textAnchor={n === 0 ? 'start' : n === 10 ? 'end' : 'middle'}>
                {n === 10 ? '10 years' : n}
              </text>
            ))}
          </svg>
          <p>Contour interval 26 m. Elevation shown under your cursor.</p>
        </div>
      </motion.aside>
      <Duck spot="hero" />

      <a className="hero__cue" href="#timeline" aria-label="Scroll to timeline">
        <motion.span
          className="hero__cue-line"
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.1, ease, delay: 1.1 }}
        />
        <motion.span
          className="hero__cue-dot"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 2 }}
        />
      </a>
    </header>
  )
}
