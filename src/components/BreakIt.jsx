import { useEffect, useRef, useState } from 'react'

const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']
const load = () => import('../lib/breaker')

// The corner button that turns the page into a range: every click serves a ball at whatever is
// under it, and that thing breaks into pieces that fall to the bottom of the page. "Fix it" puts
// the page back together.
export default function BreakIt() {
  const [on, setOn] = useState(false)
  const breaker = useRef(null)

  useEffect(() => {
    if (!on) return
    let gone = false
    const root = document.documentElement
    root.classList.add('is-breaking')

    // clicks made before the physics has loaded wait for it instead of being lost
    const pending = []
    const ours = (e) => e.target instanceof Element && e.target.closest('.break')
    const swallow = (e) => {
      if (ours(e)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.type !== 'click') return
      const { clientX: x, clientY: y } = e
      if (breaker.current) breaker.current.fire(x, y)
      else pending.push([x, y])
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOn(false)
    }
    BLOCKED.forEach((t) => window.addEventListener(t, swallow, { capture: true }))
    window.addEventListener('keydown', onKey)

    load().then(({ createBreaker }) => {
      if (gone) return
      breaker.current = createBreaker()
      pending.splice(0).forEach(([x, y]) => breaker.current.fire(x, y))
    })

    return () => {
      gone = true
      root.classList.remove('is-breaking')
      BLOCKED.forEach((t) => window.removeEventListener(t, swallow, { capture: true }))
      window.removeEventListener('keydown', onKey)
      breaker.current?.destroy()
      breaker.current = null
    }
  }, [on])

  return (
    <div className="break" onPointerEnter={load} onFocus={load}>
      <button type="button" className={`break__button ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => setOn((o) => !o)}>
        {on ? 'Fix it' : 'Break it'}
      </button>
      {on && <span className="break__hint">Click anything. Esc to fix.</span>}
    </div>
  )
}
