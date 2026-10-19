export default function Toolbox({ toolbox }) {
  return (
    <section className="section toolbox" id="tools" aria-labelledby="tools-title">
      <div className="section__head">
        <div>
          <h2 id="tools-title" className="section__title">An <span className="nowrap">AI-forward</span> builder</h2>
        </div>
        <p className="section__lede">
          Computer science degree. Everything since, learned on the job.
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
