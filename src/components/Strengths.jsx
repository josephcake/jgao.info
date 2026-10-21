const scrollTo = (id, block = 'start') => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block })
}

// Each strength goes to the thing on the page that shows it
const GO = {
  dispatch: () => {
    scrollTo('dispatch', 'center')
    setTimeout(() => window.dispatchEvent(new Event('dispatch:simulate')), 700)
  },
  radar: () => {
    window.dispatchEvent(new CustomEvent('lab:open', { detail: 'radar' }))
    setTimeout(() => scrollTo('radar', 'center'), 120)
  },
  lab: () => scrollTo('lab'),
  court: () => scrollTo('chapter-court'),
}

export default function Strengths({ strengths }) {
  return (
    <section className="section strengths" id="strengths" aria-labelledby="strengths-title">
      <div className="section__head">
        <div>
          <h2 id="strengths-title" className="section__title">What I bring</h2>
        </div>
      </div>

      <dl className="strengths__list">
        {strengths.map((s) => (
          <div key={s.title} className="strengths__row">
            <dt>{s.title}</dt>
            <dd>
              <p>{s.body}</p>
              <button type="button" className="strengths__go" onClick={GO[s.go.to]}>
                {s.go.label}
              </button>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
