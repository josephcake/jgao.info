import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server:{middlewareMode:true}, appType:'custom', logLevel:'error'});
const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
const { checkRoom } = await s.ssrLoadModule('/src/gameplay/RoomSolver.ts');
for (const f of process.argv.slice(2)){const r=parseRoom(readFileSync(f,'utf8'));
console.log(f.split('/').pop(),'ok',checkRoom(r,{}).ok,'| noLens',checkRoom(r,{disable:['colour']}).ok);}
await s.close();
