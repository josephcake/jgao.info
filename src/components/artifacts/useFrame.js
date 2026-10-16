import { useEffect, useRef } from 'react'

// Runs `fn(elapsedMs)` every animation frame while `active` and motion is allowed.
export default function useFrame(active, fn) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!active || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0
    const start = performance.now()
    const loop = (now) => {
      fnRef.current(now - start)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active])
}
