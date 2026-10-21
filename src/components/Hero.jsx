import { useReducedMotion } from 'motion/react'
import NameScan from './NameScan'

const NAME = ['Joseph', 'Gao']

export default function Hero() {
  const reduce = useReducedMotion()

  return (
    <header className="hero" id="top">
      <div className="hero__stage">
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
