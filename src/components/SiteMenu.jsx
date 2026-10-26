import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import ThemeSwitch from './ThemeSwitch'
import BreakIt from './BreakIt'

const LINKS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'lab', label: 'Workbench' },
  { id: 'github', label: 'GitHub' },
  { id: 'strengths', label: 'Strengths' },
  { id: 'contact', label: 'Contact' },
]
const ease = [0.22, 1, 0.36, 1]

// One round button in the corner; it opens the sections as a full-screen sheet, with the themes and
// the search underneath. The other corner holds the Break it button.
export default function SiteMenu({ themes, theme, back, onTheme, onRepeat, onSearch }) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const toggle = useRef(null)
  const first = useRef(null)
  // Focus goes back to the button when the menu is closed, not when a link has moved the page on
  const restore = useRef(true)

  useEffect(() => {
    if (!open) return
    restore.current = true
    const root = document.documentElement
    root.classList.add('is-menu-open')
    first.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const button = toggle.current
    return () => {
      root.classList.remove('is-menu-open')
      window.removeEventListener('keydown', onKey)
      if (restore.current) button?.focus()
    }
  }, [open])

  const go = (id) => {
    restore.current = false
    setOpen(false)
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    })
  }

  return (
    <>
      <BreakIt />

      <button
        ref={toggle}
        type="button"
        className={`menu__toggle ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="menu__bars" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            className="menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <nav aria-label="Sections">
              <ul className="menu__links">
                {LINKS.map((l, i) => (
                  <li key={l.id}>
                    <motion.a
                      ref={i === 0 ? first : undefined}
                      href={`#${l.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        go(l.id)
                      }}
                      initial={reduce ? false : { y: 28, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.55, ease, delay: 0.05 + i * 0.045 }}
                    >
                      {l.label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="menu__foot">
              <ThemeSwitch always themes={themes} theme={theme} back={back} onChange={onTheme} onRepeat={onRepeat} />
              <button
                type="button"
                className="menu__search"
                onClick={() => {
                  restore.current = false
                  setOpen(false)
                  onSearch()
                }}
              >
                Search everything <kbd>⌘K</kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
