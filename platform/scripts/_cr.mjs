import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
const s = await createServer({ server:{middlewareMode:true}, appType:'custom', logLevel:'error'});
const { parseRoom } = await s.ssrLoadModule('/src/gameplay/AsciiRoom.ts');
const { checkRoom, reachMap } = await s.ssrLoadModule('/src/gameplay/RoomGen.ts');
const text=readFileSync(process.argv[2],'utf8');
const r=parseRoom(text);
console.log(reachMap(r,text,{disable:['pull']}).join('\n'));
await s.close();
