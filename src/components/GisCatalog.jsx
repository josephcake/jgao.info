import { useEffect, useMemo, useRef, useState } from 'react'
import { useInView } from 'motion/react'

const STEP_MS = 140
const GEOMETRIES = ['Point', 'Line', 'Polygon', 'Raster']
const RAW_GEOMETRY = {
  Point: 'esriGeometryPoint',
  Line: 'esriGeometryPolyline',
  Polygon: 'esriGeometryPolygon',
  Raster: 'esriImageServiceDataTypeGeneric',
}

const SOURCES = [
  {
    id: 'city',
    name: 'City open data',
    host: 'gis.city.example',
    srid: 2263,
    extent: [-74.26, 40.49, -73.7, 40.92],
    services: [
      { name: 'Hydrants', type: 'FeatureServer', layers: [['Fire hydrants', 'Point', 14], ['Hydrant pressure zones', 'Polygon', 6]] },
      { name: 'Addresses', type: 'FeatureServer', layers: [['Address points', 'Point', 22], ['Street centerlines', 'Line', 18]] },
      { name: 'Basemap', type: 'MapServer', layers: [['Building footprints', 'Polygon', 9], ['Parks', 'Polygon', 7]] },
    ],
  },
  {
    id: 'state',
    name: 'State GIS portal',
    host: 'geo.state.example',
    srid: 3857,
    extent: [-124.85, 45.54, -116.92, 49.0],
    services: [
      { name: 'Boundaries', type: 'FeatureServer', layers: [['County boundaries', 'Polygon', 11], ['9-1-1 PSAP boundaries', 'Polygon', 15]] },
      { name: 'Transportation', type: 'MapServer', layers: [['State highways', 'Line', 20], ['Mile markers', 'Point', 8]] },
      { name: 'Imagery', type: 'ImageServer', layers: [['Orthoimagery 2025', 'Raster', 4]] },
    ],
  },
  {
    id: 'federal',
    name: 'Federal hydrography',
    host: 'hydro.gov.example',
    srid: 4269,
    extent: [-125.0, 24.4, -66.9, 49.4],
    services: [
      { name: 'Rivers', type: 'MapServer', layers: [['River flowlines', 'Line', 31], ['Waterbodies', 'Polygon', 17]] },
      { name: 'Elevation', type: 'ImageServer', layers: [['Elevation 10 m', 'Raster', 3]] },
    ],
  },
  {
    id: 'internal',
    name: 'Internal services',
    host: 'maps.internal',
    srid: 4326,
    extent: [-74.26, 40.49, -73.7, 40.92],
    services: [
      { name: 'Facilities', type: 'FeatureServer', layers: [['Hospitals', 'Point', 26], ['Fire stations', 'Point', 12], ['Police precincts', 'Polygon', 10]] },
    ],
  },
]

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function buildCrawl() {
  const events = []
  for (const source of SOURCES) {
    events.push({ kind: 'source', source, log: `GET https://${source.host}/arcgis/rest/services?f=json` })
    for (const service of source.services) {
      events.push({ kind: 'service', log: `found ${service.type} ${service.name} (${service.layers.length} ${service.layers.length === 1 ? 'layer' : 'layers'})` })
      service.layers.forEach(([name, geometry, fields], index) => {
        const key = `gis:layer:${source.id}:${slug(service.name)}:${index}`
        const record = {
          key,
          name,
          source: source.name,
          service: `${service.name}/${service.type}`,
          url: `https://${source.host}/arcgis/rest/services/${service.name}/${service.type}/${index}`,
          type: service.type,
          geometry,
          rawGeometry: RAW_GEOMETRY[geometry],
          srid: source.srid,
          fields,
          extent: source.extent,
        }
        events.push({ kind: 'layer', record, log: `SET ${key}` })
      })
    }
  }
  return events
}

const CRAWL = buildCrawl()
const TOTALS = {
  sources: SOURCES.length,
  services: CRAWL.filter((e) => e.kind === 'service').length,
  layers: CRAWL.filter((e) => e.kind === 'layer').length,
}

function JsonRecord({ record }) {
  const rows = [
    ['id', record.key],
    ['name', record.name],
    ['source', record.source],
    ['url', record.url],
    ['type', record.type],
    ['geometry', record.geometry, `normalized from "${record.rawGeometry}"`],
    ['srid', record.srid],
    ['fields', record.fields],
    ['extent', record.extent],
  ]
  return (
    <pre className="gis__json" aria-label={`Catalog record for ${record.name}`}>
      {'{\n'}
      {rows.map(([k, v, note], i) => (
        <span key={k}>
          {'  '}
          <span className="gis__json-key">"{k}"</span>
          {': '}
          {Array.isArray(v) ? (
            <span className="gis__json-num">[{v.join(', ')}]</span>
          ) : typeof v === 'number' ? (
            <span className="gis__json-num">{v}</span>
          ) : (
            <span className="gis__json-str">"{v}"</span>
          )}
          {i < rows.length - 1 ? ',' : ''}
          {note && <span className="gis__json-note">{`  // ${note}`}</span>}
          {'\n'}
        </span>
      ))}
      {'}'}
    </pre>
  )
}

export default function GisCatalog() {
  const ref = useRef(null)
  const logRef = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const [step, setStep] = useState(0)
  const [running, setRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [geometry, setGeometry] = useState(null)
  const [selected, setSelected] = useState(null)

  const done = CRAWL.slice(0, step)
  const catalog = useMemo(() => done.filter((e) => e.kind === 'layer').map((e) => e.record), [step])
  const counts = {
    sources: done.filter((e) => e.kind === 'source').length,
    services: done.filter((e) => e.kind === 'service').length,
    layers: catalog.length,
  }

  const crawl = () => {
    setSelected(null)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(CRAWL.length)
      return
    }
    setStep(0)
    setRunning(true)
  }

  useEffect(() => {
    if (inView) crawl()
  }, [inView])

  useEffect(() => {
    if (!running) return
    if (step >= CRAWL.length) {
      setRunning(false)
      return
    }
    const id = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(id)
  }, [running, step])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [step])

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.filter((r) => {
      if (geometry && r.geometry !== geometry) return false
      const hay = `${r.name} ${r.service} ${r.source} ${r.geometry}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [catalog, query, geometry])

  const active = selected && catalog.find((r) => r.key === selected)

  return (
    <figure ref={ref} className="gis" id="gis" data-ui>
      <div className="gis__bar">
        <button type="button" className="gis__crawl" onClick={crawl} disabled={running}>
          {running ? 'Crawling…' : step ? 'Crawl again' : 'Start crawl'}
        </button>
        <dl className="gis__counts">
          <div><dt>Sources</dt><dd>{counts.sources}/{TOTALS.sources}</dd></div>
          <div><dt>Services</dt><dd>{counts.services}/{TOTALS.services}</dd></div>
          <div><dt>Layers</dt><dd>{counts.layers}/{TOTALS.layers}</dd></div>
          <div><dt>Redis keys</dt><dd>{counts.layers}</dd></div>
        </dl>
      </div>

      <div className="gis__body">
        <div className="gis__log" ref={logRef} aria-label="Crawler log" role="log">
          {done.length === 0 && <p className="gis__log-line is-muted">Waiting to crawl…</p>}
          {done.map((e, i) => (
            <p key={i} className={`gis__log-line gis__log-line--${e.kind}`}>
              {e.log}
            </p>
          ))}
          {!running && step === CRAWL.length && (
            <p className="gis__log-line gis__log-line--done">
              Done. {TOTALS.layers} layers normalized to JSON and stored in Redis.
            </p>
          )}
        </div>

        <div className="gis__search">
          <input
            className="gis__input"
            type="search"
            placeholder="Search the catalog: hydrants, boundaries, river…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the GIS catalog"
          />
          <div className="gis__chips" role="group" aria-label="Filter by geometry">
            {GEOMETRIES.map((g) => (
              <button
                key={g}
                type="button"
                className="gis__chip"
                aria-pressed={geometry === g}
                onClick={() => setGeometry(geometry === g ? null : g)}
              >
                {g}
              </button>
            ))}
          </div>

          <ul className="gis__results">
            {catalog.length === 0 && <li className="gis__empty">The catalog is empty until the crawler finds something.</li>}
            {catalog.length > 0 && results.length === 0 && <li className="gis__empty">No layers match.</li>}
            {results.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  className="gis__result"
                  aria-pressed={selected === r.key}
                  onClick={() => setSelected(selected === r.key ? null : r.key)}
                >
                  <span className="gis__result-name">{r.name}</span>
                  <span className="gis__result-meta">{r.source} · {r.service}</span>
                  <span className={`gis__geom gis__geom--${r.geometry.toLowerCase()}`}>{r.geometry}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {active && <JsonRecord record={active} />}

      <figcaption className="demo__caption">
        A simulated crawl of four ArcGIS servers into Redis. Pick a result to see the stored
        record.
      </figcaption>
    </figure>
  )
}
