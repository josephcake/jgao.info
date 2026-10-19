import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const COMPACT = '(max-width: 600px)'
const spring = { type: 'spring', stiffness: 460, damping: 34 }

function CompactSwitch({ themes, theme, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = themes.find((t) => t.id === theme) || themes[0]

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const key = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <div className="theme-switch theme-switch--compact" ref={ref}>
      <button
        type="button"
        className={`theme-switch__option theme-switch__option--${active.id}`}
        aria-expanded={open}
        aria-label={`Color theme: ${active.name}`}
        onClick={() => setOpen((o) => !o)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-switch__menu"
            role="group"
            aria-label="Color theme"
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.14 } }}
            transition={spring}
          >
            {themes.map((t, i) => (
              <motion.button
                key={t.id}
                type="button"
                className="theme-switch__item"
                aria-pressed={t.id === theme}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: 0.025 * i }}
                onClick={() => {
                  if (t.id !== theme) onChange(t.id)
                  setOpen(false)
                }}
              >
                <span className={`theme-switch__option theme-switch__option--${t.id}`} aria-hidden="true" />
                {t.name}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ThemeSwitch({ themes, theme, back, onChange, onRepeat }) {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT).matches)

  useEffect(() => {
    const mq = window.matchMedia(COMPACT)
    const update = () => setCompact(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (compact) return <CompactSwitch themes={themes} theme={theme} onChange={onChange} />

  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      {themes.map((t) => {
        const current = theme === t.id
        return (
          <button
            key={t.id}
            type="button"
            className={`theme-switch__option theme-switch__option--${t.id}`}
            aria-pressed={current}
            aria-label={current ? `${t.name} theme. Press again for ${back.name}` : `${t.name} theme`}
            title={current ? `${t.name}. Click again for ${back.name}` : t.name}
            onClick={() => (current ? onRepeat() : onChange(t.id))}
          />
        )
      })}
    </div>
  )
}
