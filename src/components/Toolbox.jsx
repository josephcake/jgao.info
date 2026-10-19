export default function Toolbox({ toolbox }) {
  return (
    <section className="section toolbox" id="tools" aria-labelledby="tools-title">
      <div className="section__head">
        <div>
          <h2 id="tools-title" className="section__title">What I reach for</h2>
        </div>
        <p className="section__lede">
          A computer science degree to start. Everything since, learned by shipping.
        </p>
      </div>

      <dl className="toolbox__list">
        {toolbox.map((g) => (
          <div key={g.group} className="toolbox__row">
            <dt>{g.group}</dt>
            <dd>{g.items.join(', ')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
