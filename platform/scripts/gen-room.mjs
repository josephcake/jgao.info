// Generate draft rooms: npm run gen:room -- --focus gap [--twist fling] [--difficulty 2]
//   [--flow right|up] [--hue blue|green|red] [--white] [--seed 42] [--count 3] [--packet]
//   [--reach] [--swing] [--out assets/data/rooms/drafts]
// Prints each room (--reach marks where the solver got to) and writes it as a .room file to edit by hand.
// Check a hand-made room instead: npm run gen:room -- --check assets/data/rooms/level1/01-last-mile.room
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateRoom, checkRoom, reachMap, FOCI } = await server.ssrLoadModule('/src/gameplay/RoomGen.ts');
  const check = opt('check');
  if (check) {
    const { parseRoom } = await server.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
    const text = readFileSync(check, 'utf8');
    const room = parseRoom(text);
    const c = checkRoom(room, { white: flag('white'), swing: flag('swing') });
    console.log(`${check}: ${c.ok ? 'can be finished' : 'NOT finishable'}; packets reachable ${c.packetsReached}/${c.packets}`);
    console.log(reachMap(room, text, { white: flag('white'), swing: flag('swing') }).join('\n'));
    process.exitCode = c.ok ? 0 : 1;
  } else {
  const focus = opt('focus', 'gap');
  if (!FOCI.includes(focus)) throw new Error(`--focus must be one of ${FOCI.join(', ')}`);
  const count = Number(opt('count', '1'));
  const out = opt('out', 'assets/data/rooms/drafts');
  mkdirSync(out, { recursive: true });
  let seed = Number(opt('seed', String(Date.now() % 100000)));
  for (let n = 0; n < count; n++, seed += 1) {
    const r = generateRoom({
      seed, focus, twist: opt('twist'), difficulty: Number(opt('difficulty', '2')), flow: opt('flow', 'right'), packet: flag('packet'),
      hue: opt('hue'), white: flag('white'),
    });
    const c = checkRoom(r.room, { white: flag('white') });
    const file = join(out, `${r.room.id}.room`);
    writeFileSync(file, r.text);
    console.log(`\n== ${file}  (attempts ${r.attempts}, packets reachable ${c.packetsReached}/${c.packets})`);
    console.log(flag('reach') ? reachMap(r.room, r.text, { white: flag('white') }).join('\n') : r.text.split('\nmap\n')[1].split('\nend\n')[0]);
  }
  }
} finally {
  await server.close();
}
