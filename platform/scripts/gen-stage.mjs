// Draft a whole stage: npm run gen:stage -- --stage 2 [--seed 7] [--candidates 8] [--out assets/data/rooms/drafts] [--reach]
// Regenerate a level in place: --into assets/data/rooms/level1 rewrites its rooms in order, keeping
// each file's header (comment, id, name, tagline, bg) and leaving rooms past the plan (the boss) alone.
// Makes several candidates per beat of the stage plan, keeps the one closest to the beat's target
// difficulty, prints each room with its score, and writes .room files to polish by hand.
import { createServer } from 'vite';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const flag = (name) => args.includes(`--${name}`);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateStage, reachMap, STAGE_PLANS, stageProfile } = await server.ssrLoadModule('/src/gameplay/RoomGen.ts');
  const stage = Number(opt('stage', '2'));
  if (!STAGE_PLANS[stage]) throw new Error(`no plan for stage ${stage}; have ${Object.keys(STAGE_PLANS).join(', ')}`);
  const seed = Number(opt('seed', '1'));
  const out = opt('out', 'assets/data/rooms/drafts');
  mkdirSync(out, { recursive: true });
  const rooms = generateStage(stage, seed, Number(opt('candidates', '8')));
  const p = stageProfile(stage);
  console.log(`stage ${stage}: swing ${p.swing}, power ${p.power}, colours ${p.hues.join('+')}${p.white ? ', white' : ''}\n`);
  const into = opt('into');
  const existing = into ? readdirSync(into).filter((f) => f.endsWith('.room')).sort() : [];
  rooms.forEach((r, i) => {
    let file = join(out, `${String(i + 1).padStart(2, '0')}-${r.step.focus}${r.step.twist ? '-' + r.step.twist : ''}.room`);
    let text = r.result.text;
    if (into && existing[i]) {
      file = join(into, existing[i]);
      const head = readFileSync(file, 'utf8').split('\nmap\n')[0];
      text = head + '\nmap\n' + text.split('\nmap\n')[1];
    }
    writeFileSync(file, text);
    console.log(`== ${file}  ${r.result.room.name}  score ${r.score}  (seed ${r.picked}; candidates ${r.candidates.map((c) => c.score).join(' ')})`);
    console.log(flag('reach') ? reachMap(r.result.room, r.result.text, { swing: p.swing, white: p.white }).join('\n') : r.result.text.split('\nmap\n')[1].split('\nend\n')[0]);
    const ents = r.result.room.entities.filter((e) => !['terminal'].includes(e.type)).map((e) => `${e.type}${e.id ? ':' + e.id : ''}(${e.x},${e.y}${e.type === 'gate' ? ',h' + e.h + (e.invert ? ',inv' : '') : ''}${e.type === 'lift' ? '->' + e.toY : ''}${e.color ? ',' + e.color : ''})`);
    if (ents.length) console.log('   entities: ' + ents.join(' '));
    console.log();
  });
} finally {
  await server.close();
}
