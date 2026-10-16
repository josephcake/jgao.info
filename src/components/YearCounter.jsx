const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export default function YearCounter({ value }) {
  const isYear = typeof value === 'number'
  const digits = String(isYear ? value : 2026).split('').map(Number)

  return (
    <div className="year" aria-live="polite">
      <span className="sr-only">{value}</span>
      <span className={`year__digits ${isYear ? '' : 'is-hidden'}`} aria-hidden="true">
        {digits.map((d, i) => (
          <span className="year__slot" key={i}>
            <span className="year__strip" style={{ transform: `translateY(${-d * 10}%)` }}>
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
      <span className={`year__word ${isYear ? '' : 'is-shown'}`} aria-hidden="true">
        {isYear ? '' : value}
      </span>
    </div>
  )
}
