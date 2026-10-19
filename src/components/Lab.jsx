import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import RadarScope from './RadarScope'
import GisCatalog from './GisCatalog'

const ease = [0.22, 1, 0.36, 1]
const DEMOS = { radar: RadarScope, gis: GisCatalog }

export default function Lab({ projects }) {
  const [open, setOpen] = useState(() => projects.findIndex((p) => p.demo))

  useEffect(() => {
    const onOpen = (e) => setOpen(projects.findIndex((p) => p.demo === e.detail))
    window.addEventListener('lab:open', onOpen)
    return () => window.removeEventListener('lab:open', onOpen)
  }, [projects])

  return (
    <section className="section lab" id="lab" aria-labelledby="lab-title">
      <div className="section__head">
        <div>
          <h2 id="lab-title" className="section__title">On the workbench</h2>
        </div>
        <p className="section__lede">
          Side projects. Open one to try it.
        </p>
      </div>

      <ul className="lab__list">
        {projects.map((p, i) => {
          const isOpen = open === i
          const panelId = `project-${i}`
          const Demo = p.demo && DEMOS[p.demo]
          return (
            <li key={p.name} className={`lab__item ${isOpen ? 'is-open' : ''}`}>
              <button
                type="button"
                className="lab__row"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="lab__name">{p.name}</span>
                <span className="lab__summary">{p.summary}</span>
                <span className="lab__kind">
                  {p.kind}
                  {Demo && <span className="lab__live">Live demo</span>}
                </span>
                <span className="lab__toggle" aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panelId}
                    className="lab__panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease }}
                  >
                    <div className="lab__detail">
                      <p>{p.detail}</p>
                      {p.href && (
                        <a href={p.href} target="_blank" rel="noreferrer">
                          Visit {p.name}
                        </a>
                      )}
                    </div>
                    {Demo && (
                      <div className="lab__demo">
                        <Demo />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
