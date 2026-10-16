import { useEffect, useRef, useState } from 'react'
import { findDuck, useDucks } from '../lib/ducks'

export function DuckIcon({ className = '' }) {
  return (
    <svg className={`duck-icon ${className}`} viewBox="0 0 24 20" aria-hidden="true">
      <path
        className="duck-icon__body"
        d="M2.5 9.5 Q2.5 18 11 18 H16 Q22 18 21 11.5 Q17.5 13 14.2 11.2 Q15.6 9.8 15.6 7.6 A4.6 4.6 0 0 0 6.4 7.6 Q6.4 9.9 7.8 11.2 Q5 11.6 2.5 9.5 Z"
      />
      <path className="duck-icon__beak" d="M15.2 7.4 L19.6 8.3 L15.1 9.6 Z" />
      <circle className="duck-icon__eye" cx="12.4" cy="6.6" r="0.95" />
      <path className="duck-icon__wing" d="M9.5 13.4 Q12.5 15.6 16 13.6" />
    </svg>
  )
}

export default function Duck({ spot, className = '' }) {
  const found = useDucks().includes(spot)
  const [quack, setQuack] = useState(0)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const onClick = () => {
    findDuck(spot)
    setQuack(Date.now())
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setQuack(0), 1200)
  }

  return (
    <button
      type="button"
      className={`duck duck--${spot} ${found ? 'is-found' : ''} ${className}`}
      aria-label={found ? 'A rubber duck you already found' : 'A rubber duck'}
      onClick={onClick}
    >
      <DuckIcon />
      {quack > 0 && (
        <span key={quack} className="duck__quack" aria-hidden="true">
          Quack!
        </span>
      )}
    </button>
  )
}
