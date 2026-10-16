import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const ease = [0.22, 1, 0.36, 1]

function matches(cmd, query) {
  if (!query) return true
  const haystack = `${cmd.label} ${cmd.group} ${cmd.keywords || ''}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).every((token) => haystack.includes(token))
}

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const returnFocus = useRef(null)

  const results = useMemo(() => commands.filter((c) => matches(c, query)), [commands, query])

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement
      setQuery('')
      setIndex(0)
      if (window.matchMedia('(hover: hover)').matches) requestAnimationFrame(() => inputRef.current?.focus())
    } else if (returnFocus.current) {
      returnFocus.current.focus?.()
      returnFocus.current = null
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (cmd) => {
    returnFocus.current = null
    onClose()
    requestAnimationFrame(() => cmd.run())
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[index]) run(results[index])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="palette__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease }}
          >
            <input
              ref={inputRef}
              className="palette__input"
              type="text"
              placeholder="Jump to a year, try a demo, or switch theme"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIndex(0)
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
              aria-autocomplete="list"
            />
            <ul className="palette__list" id="palette-list" role="listbox" ref={listRef}>
              {results.length === 0 && (
                <li className="palette__empty">No matches. Try a year like 2019, or “theme”.</li>
              )}
              {results.map((cmd, i) => (
                <li key={cmd.id} role="presentation">
                  {(i === 0 || results[i - 1].group !== cmd.group) && (
                    <p className="palette__group">{cmd.group}</p>
                  )}
                  <div
                    id={`cmd-${cmd.id}`}
                    role="option"
                    aria-selected={i === index}
                    className="palette__item"
                    onMouseMove={() => setIndex(i)}
                    onClick={() => run(cmd)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.hint && <span className="palette__hint">{cmd.hint}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="palette__footer">
              <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
              <span><kbd>Enter</kbd> to run</span>
              <span><kbd>Esc</kbd> to close</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
