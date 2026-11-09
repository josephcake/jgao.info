// Stitch two hand-authored .room files into one, horizontally.
//   node scripts/stitch-rooms.mjs <left.room> <right.room> <out.room> --id l1-XX --name "1-X NAME" --tagline "..." [--comment "..."]
// The left room keeps its spawn (@) and loses its exit (E); the right keeps its
// exit and loses its spawn. A short wall seam joins them, floored at the right
// room's walking height. Right-side tail coords (entity/term/zone) shift by the
// seam offset; colliding entity ids get a 'b' suffix.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const positionals = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; }
  positionals.push(args[i]);
}
const [L, R, OUT] = positionals;

const SEAM = 3;

function parse(text) {
  const lines = text.split('\n');
  const mapStart = lines.indexOf('map');
  const mapEnd = lines.indexOf('end');
  const header = lines.slice(0, mapStart);
  const rows = lines.slice(mapStart + 1, mapEnd);
  const tail = lines.slice(mapEnd + 1).filter((l) => l.trim().length);
  return { header, rows, tail };
}

const floorRow = (rows) => {
  // first solid row scanning up from the bottom, at column 3 (the spawn side)
  for (let y = rows.length - 1; y >= 0; y--) if (rows[y][3] === '#') return y;
  return rows.length - 2;
};

const left = parse(readFileSync(L, 'utf8'));
const right = parse(readFileSync(R, 'utf8'));

const lw = left.rows[0].length;
const rw = right.rows[0].length;
const lh = left.rows.length;
const rh = right.rows.length;
const H = Math.max(lh, rh);
const lDy = H - lh, rDy = H - rh;
const lFloor = floorRow(left.rows) + lDy;
const rFloor = floorRow(right.rows) + rDy;

const joinX = lw - 2;                 // drop the left room's right wall
const W = joinX + SEAM + (rw - 2);    // drop the right room's left wall
const sdx = joinX + SEAM - 2 - 2;     // x-shift applied to the right half's cells/coords

// build an empty grid of '.'
const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
const setG = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = ch; };

// find the left room's exit row (top of its exit column) so the seam opens there
let leftExitRow = lFloor;
for (let y = 0; y < lh; y++) if (left.rows[y].includes('E')) { leftExitRow = y + lDy; break; }

// paste left half [0, joinX), dropping its exit
for (let y = 0; y < lh; y++) {
  for (let x = 0; x < joinX; x++) {
    const ch = left.rows[y][x];
    if (ch === 'E') continue;
    setG(x, y + lDy, ch);
  }
}
// paste right half [2, rw), shifted, dropping its spawn
for (let y = 0; y < rh; y++) {
  for (let x = 2; x < rw; x++) {
    const ch = right.rows[y][x];
    if (ch === '@') continue;
    setG(x + sdx, y + rDy, ch);
  }
}
// seam: connect the left room's exit height to the right room's floor.
// Open the shaft between those rows so Pix can walk/drop across; floor the bottom,
// and lay a landing ledge at the left exit row so there is ground to leave on.
const top = Math.max(0, Math.min(leftExitRow, rFloor) - 1);
for (let y = 0; y < H; y++) {
  for (let x = joinX; x < joinX + SEAM; x++) {
    if (y >= rFloor) setG(x, y, '#');            // floor to the right room's ground
    else if (y < top) setG(x, y, '#');           // keep ceiling solid above the passage
    else setG(x, y, '.');                        // open passage
  }
}
// a one-tile landing lip at the left exit row, so the left climb has a floor to step onto
if (leftExitRow < rFloor) for (let x = joinX; x < joinX + SEAM; x++) setG(x, leftExitRow + 1, '#');
void lFloor;

const rows = grid.map((r) => r.join(''));

// --- tail: left tail unchanged, right tail shifted by (sdx, rDy), ids suffixed 'b' ---
const leftTail = left.tail;
const shiftNum = (line) => line
  .replace(/"x":\s*(\d+)/g, (_, n) => `"x": ${Number(n) + sdx}`)
  .replace(/"y":\s*(\d+)/g, (_, n) => `"y": ${Number(n) + rDy}`)
  .replace(/"toX":\s*(\d+)/g, (_, n) => `"toX": ${Number(n) + sdx}`)
  .replace(/"toY":\s*(\d+)/g, (_, n) => `"toY": ${Number(n) + rDy}`);

// rename colliding ids in the right half
const idRe = /"(id|inputs)":\s*("(\w+)"|\[([^\]]*)\])/g;
const shiftZone = (line) => {
  const p = line.split(/\s+/); // zone <hue> x y w h
  return `zone ${p[1]} ${Number(p[2]) + sdx} ${Number(p[3]) + rDy} ${p[4]} ${p[5]}`;
};

const rightTail = right.tail.map((line) => {
  if (line.startsWith('zone ')) return shiftZone(line);
  if (line.startsWith('entity ')) {
    let l = shiftNum(line);
    // suffix any id / input id with 'b'
    l = l.replace(/"id":\s*"(\w+)"/g, (_, id) => `"id": "${id}b"`);
    l = l.replace(/"inputs":\s*\[([^\]]*)\]/g, (_, body) => {
      const ids = body.split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean).map((id) => `"${id}b"`);
      return `"inputs": [${ids.join(', ')}]`;
    });
    return l;
  }
  return line; // text lines unchanged
});

// header
const id = opt('id');
const name = opt('name');
const tagline = opt('tagline', '');
const comment = opt('comment', '// merged room');
const bgLine = left.header.find((l) => l.startsWith('bg ')) ?? 'bg hall';

const header = [comment, `id ${id}`, `name ${name}`, `tagline ${tagline}`, bgLine];
const out = [...header, 'map', ...rows, 'end', ...leftTail, ...rightTail].join('\n') + '\n';
writeFileSync(OUT, out);
console.log(`wrote ${OUT}  (${W}x${H}, seam at x${joinX})`);
