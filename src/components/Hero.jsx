import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { moments } from '../data'
import NameScan from './NameScan'

const NAME = ['Joseph', 'Gao']
const STEP_MS = 2800
const ease = [0.22, 1, 0.36, 1]

// One part of the line, rolling up out of the way as the next comes up under it
function Roll({ k, delay, children, className }) {
  return (
    <span className={`hero__roll ${className || ''}`}>
      <AnimatePresence initial={false}>
        <motion.span
          key={k}
          initial={{ y: '105%' }}
          animate={{ y: '0%' }}
          exit={{ y: '-105%' }}
          transition={{ duration: 0.6, ease, delay }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// The timeline a moment at a time over the name; hovering holds it, a click moves it on
function Line() {
  const reduce = useReducedMotion()
  const [at, setAt] = useState(reduce ? moments.length - 1 : 0)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (reduce || held) return
    const id = setInterval(() => setAt((i) => (i + 1) % moments.length), STEP_MS)
    return () => clearInterval(id)
  }, [reduce, held])

  const m = moments[at]
  return (
    <>
      <p className="hero__line" aria-hidden="true" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onClick={() => setAt((i) => (i + 1) % moments.length)}>
        <span className="hero__moment">
          <Roll k={`w${at}`} delay={0} className="hero__when">{m.when}</Roll>
          <Roll k={`t${at}`} delay={0.06}>
            <span className="hero__long">{m.what}</span>
            <span className="hero__short">{m.short || m.what}</span>
          </Roll>
        </span>
        <Roll k={`p${at}`} delay={0.12} className="hero__where">{m.where}</Roll>
      </p>
      <p className="sr-only">Software engineer at RapidSOS, building my own projects on the side.</p>
    </>
  )
}

export default function Hero() {
  const reduce = useReducedMotion()

  return (
    <header className="hero" id="top">
      <div className="hero__stage">
        <Line />
        <h1 className="hero__name" aria-label="Joseph Gao">
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
        </h1>
      </div>
    </header>
  )
}
