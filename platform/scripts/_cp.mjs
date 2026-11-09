import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server:{middlewareMode:true}, appType:'custom', logLevel:'error'});
const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
const { checkRoom } = await s.ssrLoadModule('/src/gameplay/RoomSolver.ts');
const r=parseRoom(readFileSync(process.argv[2],'utf8'));
console.log('noPull',checkRoom(r,{disable:['pull']}).ok,'| noLens',checkRoom(r,{disable:['colour']}).ok);
await s.close();
