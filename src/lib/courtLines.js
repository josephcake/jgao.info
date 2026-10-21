// A doubles court in metres, centred on the net: x runs along the court, y across it. Each line is
// a painted strip [x0, y0, x1, y1].
export const COURT = { length: 23.77, width: 10.97, singles: 8.23, service: 6.4, line: 0.05, baseline: 0.1, run: 6.4, side: 3.66 }

const L = COURT.length / 2
const D = COURT.width / 2
const S = COURT.singles / 2
const w = COURT.line / 2

export const LINES = [
  [-L, -D - w, -L + COURT.baseline, D + w], [L - COURT.baseline, -D - w, L, D + w],
  [-L, -D - w, L, -D + w], [-L, D - w, L, D + w],
  [-L, -S - w, L, -S + w], [-L, S - w, L, S + w],
  [-COURT.service - w, -S, -COURT.service + w, S], [COURT.service - w, -S, COURT.service + w, S],
  [-COURT.service, -w, COURT.service, w],
  [-L + COURT.baseline, -w, -L + COURT.baseline + 0.15, w], [L - COURT.baseline - 0.15, -w, L - COURT.baseline, w],
]
export const NET = { y: D + 0.914, height: 0.914, posts: 1.07 }
// One court's plot with the run-back behind each baseline and room at the sides
export const PLOT = { x: COURT.length + COURT.run * 2, y: COURT.width + COURT.side * 2 }
