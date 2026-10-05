import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {compile} from '../lib/compiler.js';
import {emptyState,quote} from '../lib/domain.js';
const file=process.argv[2];if(!file){console.error('用法：npm run replay -- data/appointment-sessions/<id>.json');process.exit(1);}
const session=JSON.parse(await readFile(file,'utf8'));let state=emptyState();const turns=[],runs=[];
for(const turn of session.turns){turns.push(turn);const run=await compile(state,turns);state=run.state;runs.push(run);console.log(`第 ${turn.id} 輪：${run.durationMs} ms`);}
await mkdir('data/replays',{recursive:true});const out=`data/replays/${Date.now()}-${basename(file)}`;await writeFile(out,JSON.stringify({source:file,replayedAt:new Date().toISOString(),turns,runs,state,quote:quote(state)},null,2));console.log(out);
