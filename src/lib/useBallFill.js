import { useEffect, useState } from 'react'

// How far from where the ball lands a cell still gets filled, in screen pixels
const REACH = 12

// In Break it mode a ball fills in the cells of a chart it lands on instead of smashing it. Cells
// are the svg's `[data-cell]` rects, keyed by that attribute; the hit is measured in the chart's own
// units, so landing reads no layout per cell. "Fix it" empties them again.
export default function useBallFill(svgRef) {
  const [filled, setFilled] = useState(() => new Set())

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onHit = (e) => {
      e.preventDefault()
      const m = svg.getScreenCTM()
      if (!m) return
      const p = new DOMPoint(e.detail.x, e.detail.y).matrixTransform(m.inverse())
      const reach = REACH / Math.hypot(m.a, m.b)
      const hits = []
      let nearest = null
      let nearestD = Infinity
      for (const cell of svg.querySelectorAll('[data-cell]')) {
        const x = cell.x.baseVal.value
        const y = cell.y.baseVal.value
        const dx = Math.max(x - p.x, 0, p.x - x - cell.width.baseVal.value)
        const dy = Math.max(y - p.y, 0, p.y - y - cell.height.baseVal.value)
        const d = Math.hypot(dx, dy)
        if (d <= reach) hits.push(cell.dataset.cell)
        if (d < nearestD) {
          nearest = cell.dataset.cell
          nearestD = d
        }
      }
      // a ball that lands in a gap still fills the cell it was nearest to
      if (!hits.length && nearest && nearestD <= reach * 3) hits.push(nearest)
      setFilled((f) => {
        const fresh = hits.filter((k) => !f.has(k))
        return fresh.length ? new Set([...f, ...fresh]) : f
      })
    }
    const onFix = () => setFilled((f) => (f.size ? new Set() : f))
    svg.addEventListener('break:hit', onHit)
    window.addEventListener('break:fix', onFix)
    return () => {
      svg.removeEventListener('break:hit', onHit)
      window.removeEventListener('break:fix', onFix)
    }
  }, [svgRef])

  return filled
}
