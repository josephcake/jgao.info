import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DUCK_SPOTS, resetDucks, useDucks } from '../lib/ducks'
import { DuckIcon } from './Duck'

const FOUND = [
  'Quack! You found a rubber duck. Four more are hiding on this page.',
  'Two down. Rubber duck debugging is paying off.',
  'Three. You would make a decent breadth-first search.',
  'Four. One more duck is out there somewhere.',
]

const HINTS = {
  hero: 'One is keeping an eye on the map legend up top.',
  court: 'One likes to watch tennis.',
  scoreboard: 'One is keeping score.',
  calendar: 'One is hiding among the commits.',
  footer: 'One hangs out near Happy.',
}

export default function DuckToast({ onTryPond }) {
  const found = useDucks()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let timer
    const show = (next, ms) => {
      clearTimeout(timer)
      setToast({ ...next, key: Date.now() })
      timer = setTimeout(() => setToast(null), ms)
    }
    const onFound = (e) => {
      const { count } = e.detail
      if (count === DUCK_SPOTS.length) {
        show({ text: 'All five ducks found. You unlocked the Duck pond theme.', action: 'pond' }, 9000)
      } else {
        show({ text: FOUND[count - 1] }, 4500)
      }
    }
    const onHint = (e) => {
      const missing = DUCK_SPOTS.filter((id) => !e.detail.includes(id))
      const text = missing.length
        ? `${e.detail.length} of ${DUCK_SPOTS.length} ducks found. ${HINTS[missing[Math.floor(Math.random() * missing.length)]]}`
        : 'All five ducks found. The Duck pond theme is yours.'
      show({ text, action: missing.length ? null : 'pond' }, 6000)
    }
    const onOfferReset = (e) => {
      show({ text: `Back to ${e.detail}. Want to hide the ducks again?`, action: 'reset' }, 7000)
    }
    const onReset = () => {
      show({ text: 'The ducks are hidden again. Five are waiting to be found.' }, 4500)
    }
    window.addEventListener('duck:found', onFound)
    window.addEventListener('duck:hint', onHint)
    window.addEventListener('duck:offer-reset', onOfferReset)
    window.addEventListener('duck:reset', onReset)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('duck:found', onFound)
      window.removeEventListener('duck:hint', onHint)
      window.removeEventListener('duck:offer-reset', onOfferReset)
      window.removeEventListener('duck:reset', onReset)
    }
  }, [])

  return (
    <div className="duck-toast__region" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="duck-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="duck-toast__row" aria-hidden="true">
              {DUCK_SPOTS.map((id) => (
                <DuckIcon key={id} className={found.includes(id) ? 'is-found' : ''} />
              ))}
            </span>
            <p>{toast.text}</p>
            {toast.action === 'pond' && (
              <button type="button" className="duck-toast__try" onClick={onTryPond}>
                Try it
              </button>
            )}
            {toast.action === 'reset' && (
              <button type="button" className="duck-toast__try" onClick={resetDucks}>
                Hide them
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
