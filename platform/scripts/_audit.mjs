// Dev audit: for each .room file, is it finishable, and which mechanics are actually required?
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
  const { checkRoom } = await s.ssrLoadModule('/src/gameplay/RoomSolver.ts');
  for (const f of process.argv.slice(2)) {
    const r = parseRoom(readFileSync(f, 'utf8'));
    const ok = checkRoom(r, { swing: true }).ok;
    const need = ['pull', 'anchor', 'wall', 'colour', 'hack', 'yank', 'power'].filter((m) => !checkRoom(r, { swing: true, disable: [m] }).ok);
    console.log(`${f.split('/').slice(-2).join('/')}: ${ok ? 'finishable' : 'NOT FINISHABLE'} | requires: ${need.join(', ') || '(nothing special)'}`);
  }
} finally {
  await s.close();
}
