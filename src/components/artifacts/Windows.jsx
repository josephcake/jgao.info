import DuckHunt from './DuckHunt'

const W = 190
const H = 136

function Frame({ title, children }) {
  return (
    <>
      <rect className="win__frame" width={W} height={H} rx="7" />
      <line className="win__bar" x1="0" y1="22" x2={W} y2="22" />
      {[14, 26, 38].map((cx) => (
        <circle key={cx} className="win__dot" cx={cx} cy="11" r="3" />
      ))}
      <text className="art-label" x={W / 2} y="15" textAnchor="middle">{title}</text>
      {children}
    </>
  )
}

function Gitfolio() {
  return (
    <Frame title="Gitfolio">
      <circle className="win__fill" cx="30" cy="50" r="13" />
      <rect className="win__fill" x="52" y="40" width="70" height="7" rx="3" />
      <rect className="win__soft" x="52" y="53" width="104" height="6" rx="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} className="win__card" x={14 + (i % 2) * 84} y={76 + Math.floor(i / 2) * 28} width="78" height="22" rx="3" />
      ))}
    </Frame>
  )
}

function DestroyTheDuck({ drawn }) {
  return (
    <Frame title="destroy-the-duck">
      <DuckHunt drawn={drawn} />
    </Frame>
  )
}

function Stocky() {
  return (
    <Frame title="stocky">
      <text className="art-figure" x="14" y="46">$184.20</text>
      <text className="art-label art-label--up" x="14" y="60">+2.4% today</text>
      <line className="win__bar" x1="14" y1="122" x2={W - 14} y2="122" />
      <path
        className="draw win__chart"
        pathLength="1"
        style={{ '--d': '0.9s' }}
        d="M14 112 L32 106 L46 110 L60 96 L74 100 L90 84 L104 90 L118 76 L132 80 L146 66 L160 70 L176 54"
      />
    </Frame>
  )
}

const LAYOUT = [
  { Comp: Gitfolio, x: 8, y: 34, r: -4 },
  { Comp: DestroyTheDuck, x: 205, y: 14, r: 1.5 },
  { Comp: Stocky, x: 402, y: 40, r: 4 },
]

export default function Windows({ drawn }) {
  return (
    <figure className={`artifact ${drawn ? 'is-drawn' : ''}`}>
      <svg className="artifact__svg" viewBox="0 0 600 210" role="img" aria-label="Sketches of three early projects: Gitfolio, Destroy the Duck searching a maze, and stocky">
        {LAYOUT.map(({ Comp, x, y, r }, i) => (
          <g
            key={i}
            className="win"
            style={{
              '--x': `${x}px`,
              '--y': `${y}px`,
              '--r': `${r}deg`,
              '--d': `${0.1 + i * 0.12}s`,
            }}
          >
            <g className="win__lift">
              <Comp drawn={drawn} />
            </g>
          </g>
        ))}
      </svg>
      <figcaption>Early projects, each a little less tutorial and a little more mine. The middle one is still hunting its duck.</figcaption>
    </figure>
  )
}
