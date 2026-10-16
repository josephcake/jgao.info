export default function Principles({ principles, toolbox }) {
  return (
    <section className="section principles" id="principles" aria-labelledby="principles-title">
      <div className="section__head">
        <div>
          <p className="section__sheet">Sheet 05 of 06</p>
          <h2 id="principles-title" className="section__title">How I work</h2>
        </div>
        <p className="section__lede">
          Build thoughtfully. Experiment boldly. Create things that matter.
        </p>
      </div>

      <dl className="principles__grid">
        {principles.map((p) => (
          <div key={p.title} className="principle">
            <dt>{p.title}</dt>
            <dd>{p.text}</dd>
          </div>
        ))}
      </dl>

      <div className="toolbox">
        <h3 className="toolbox__title">What I reach for</h3>
        <dl className="toolbox__grid">
          {toolbox.map((g) => (
            <div key={g.group} className="toolbox__group">
              <dt>{g.group}</dt>
              <dd>{g.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
        <p className="toolbox__edu">
          Bachelor’s degree in computer science. Everything since, learned by shipping.
        </p>
      </div>
    </section>
  )
}
