import { useEffect, useRef, useState } from 'react'
import { useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import YearCounter from './YearCounter'
import Profile from './Profile'
import Route from './Route'
import DispatchMap from './DispatchMap'
import Court from './artifacts/Court'
import Commits from './artifacts/Commits'
import Windows from './artifacts/Windows'
import Loop from './artifacts/Loop'
const FOCUS_LINE = 0.55
const ARTIFACTS = { court: Court, commits: Commits, windows: Windows, loop: Loop }

export default function Timeline({ chapters }) {
  const trackRef = useRef(null)
  const chapterRefs = useRef([])
  const [active, setActive] = useState(0)
  const [positions, setPositions] = useState([])

  const { scrollY, scrollYProgress } = useScroll({
    target: trackRef,
    offset: [`start ${FOCUS_LINE * 100}%`, `end ${FOCUS_LINE * 100}%`],
  })
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.4 })

  useMotionValueEvent(scrollY, 'change', () => {
    const line = window.innerHeight * FOCUS_LINE
    let next = 0
    chapterRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) next = i
    })
    setActive((prev) => (prev === next ? prev : next))
  })

  useEffect(() => {
    const track = trackRef.current
    const measure = () => {
      const height = track.offsetHeight || 1
      setPositions(chapterRefs.current.map((el) => (el ? el.offsetTop / height : 0)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [])

  const current = chapters[active]

  return (
    <section className="timeline" id="timeline" aria-label="Timeline">
      <aside className="timeline__rail" aria-hidden="true">
        <div className="timeline__sticky">
          <YearCounter value={current.year} />
          <p className="timeline__place" key={current.id}>{current.place}</p>
          <ol className="timeline__index">
            {chapters.map((c, i) => (
              <li key={c.id} className={i === active ? 'is-active' : i < active ? 'is-past' : ''}>
                {c.title}
              </li>
            ))}
          </ol>
          <Profile chapters={chapters} positions={positions} progress={progress} active={active} />
        </div>
      </aside>

      <div className="timeline__track" ref={trackRef}>
        <Route trackRef={trackRef} chapterRefs={chapterRefs} progress={progress} />

        {chapters.map((c, i) => {
          const Artifact = c.artifact && ARTIFACTS[c.artifact]
          return (
            <article
              key={c.id}
              id={`chapter-${c.id}`}
              ref={(el) => (chapterRefs.current[i] = el)}
              className={`chapter ${i <= active ? 'is-reached' : ''} ${i === active ? 'is-active' : ''}`}
            >
              <span className="chapter__node" aria-hidden="true" />
              <p className="chapter__year">{c.year}</p>
              <h2 className="chapter__title">{c.title}</h2>
              <p className="chapter__role">{c.role}</p>
              <p className="chapter__dates">
                {c.dates}
                {typeof c.year === 'number' && `, ${c.place}`}
              </p>
              <div className="chapter__body">
                {c.body.map((para) => (
                  <p key={para.slice(0, 24)}>{para}</p>
                ))}
              </div>
              {c.points && (
                <ul className="chapter__points">
                  {c.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              )}
              {Artifact && <Artifact drawn={i <= active} />}
              {c.demo === 'dispatch' && <DispatchMap />}
              {c.play && (
                <p className="chapter__repos">
                  {c.play.what}{' '}
                  <a href={c.play.href} target="_blank" rel="noreferrer">
                    {c.play.label}
                  </a>
                  . Go hunt it.
                </p>
              )}
              {c.repos && (
                <p className="chapter__repos">
                  From the repo list:{' '}
                  {c.repos.map((r, idx) => (
                    <span key={r}>
                      <a href={`https://github.com/josephcake/${r}`} target="_blank" rel="noreferrer">
                        {r}
                      </a>
                      {idx < c.repos.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
