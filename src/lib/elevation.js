// Cosine-smoothed climb through each stop ({ x: 0..1, e: elevation }).
export function elevationAt(x, stops) {
  if (x <= stops[0].x) return stops[0].e
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1)
      const s = (1 - Math.cos(t * Math.PI)) / 2
      return a.e + (b.e - a.e) * s
    }
  }
  return stops[stops.length - 1].e
}

// A little trail texture so the line reads as ground, not a chart.
export const wiggle = (x) => Math.sin(x * 47) * 1.6 + Math.sin(x * 113) * 0.9
