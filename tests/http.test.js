import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

test('CLI失敗恢復、預覽返回與草稿保留、匯出',async()=>{
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',CODEX_BIN:process.execPath},stdio:['ignore','pipe','pipe']});
 try{
  let output='';const base=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{output+=d;const m=output.match(/http:\/\/localhost:(\d+)/);if(m)resolve('http://127.0.0.1:'+m[1]);});child.once('error',reject);child.once('exit',()=>reject(new Error('服務未啟動')));});
  const post=(path,data={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const created=await post('/api/sessions');assert.equal(created.status,201);const s=await created.json();
  const failed=await post(`/api/sessions/${s.id}/turns`,{text:'測試預約需求'});assert.equal(failed.status,502);
  const unchanged=await (await fetch(base+`/api/sessions/${s.id}`)).json();assert.equal(unchanged.turnCount,0);assert.equal(unchanged.phase,'intro');
  const stored=JSON.parse(await readFile(new URL(`../data/appointment-sessions/${s.id}.json`,import.meta.url),'utf8'));assert.equal(stored.runs[0].input.text,'測試預約需求');assert.equal(stored.runs[0].failed,true);
  const finished=await (await post(`/api/sessions/${s.id}/finish`)).json();assert.equal(finished.phase,'result');
  assert.equal((await post(`/api/sessions/${s.id}/contact`,{name:'測試'})).status,400);
  const saved=await (await post(`/api/sessions/${s.id}/contact`,{name:'測試客戶',email:'test@example.com',phone:''})).json();assert.equal(saved.contact.name,'測試客戶');
  assert.equal((await (await fetch(base+`/api/sessions/${s.id}`)).json()).contact.email,'test@example.com');
  const md=await fetch(base+`/api/sessions/${s.id}/export?format=md`);assert.match(await md.text(),/POC 示範價目/);assert.match(md.headers.get('content-disposition'),/attachment/);
  const resumed=await (await post(`/api/sessions/${s.id}/resume`)).json();assert.equal(resumed.phase,'intro');
  const path=new URL(`../data/appointment-sessions/${s.id}.json`,import.meta.url);
  for(const phase of ['questions','review']){
   const fixture=JSON.parse(await readFile(path,'utf8'));fixture.phase=phase;await writeFile(path,JSON.stringify(fixture));
   const before=fixture.state;
   await post(`/api/sessions/${s.id}/finish`,{draft:'還沒送出的其他想法',editing:phase==='review'});
   // Repeated preview and reload must not replace the original step or draft.
   await post(`/api/sessions/${s.id}/finish`);
   const preview=await (await fetch(base+`/api/sessions/${s.id}`)).json();assert.equal(preview.canResume,true);assert.equal(preview.draft,'');
   const back=await (await post(`/api/sessions/${s.id}/resume`,{draft:'結果頁尚未送出的補充'})).json();assert.equal(back.phase,phase);assert.equal(back.draft,'還沒送出的其他想法\n\n結果頁尚未送出的補充');assert.equal(back.editing,phase==='review');assert.deepEqual(back.state,before);assert.equal(back.turnCount,0);
   const reloaded=await (await fetch(base+`/api/sessions/${s.id}`)).json();assert.equal(reloaded.draft,back.draft);
  }
  // Existing results created before this change still have a continuation route.
  const old=JSON.parse(await readFile(path,'utf8'));old.phase='result';delete old.paused;await writeFile(path,JSON.stringify(old));
  assert.notEqual((await (await post(`/api/sessions/${s.id}/resume`)).json()).phase,'result');
  assert.equal((await fetch(base+'/api/sessions/invalid')).status,404);
 }finally{const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
});
