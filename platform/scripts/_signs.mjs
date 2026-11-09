// Dev check: which text each terminal sign in a room actually shows (they're matched in reading order).
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
  for (const f of process.argv.slice(2)) {
    const r = parseRoom(readFileSync(f, 'utf8'));
    const signs = r.entities.filter((e) => e.type === 'terminal');
    console.log(`${r.id}: ${signs.map((e) => `(${e.x},${e.y}) "${(e.text ?? '').slice(0, 34)}"`).join(' | ') || '(no signs)'}`);
  }
} finally {
  await s.close();
}
