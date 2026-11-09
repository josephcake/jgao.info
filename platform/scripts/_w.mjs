import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
const { checkRoom } = await s.ssrLoadModule('/src/gameplay/RoomSolver.ts');
for (const f of process.argv.slice(2)) {
  const r = parseRoom(readFileSync(f, 'utf8'));
  const o = { swing: true, white: true };
  console.log(r.id, 'with true view:', checkRoom(r, o).ok, '| without it:', checkRoom(r, { swing: true }).ok, '| no colour/true view at all:', checkRoom(r, { ...o, disable: ['colour'] }).ok);
}
await s.close();
