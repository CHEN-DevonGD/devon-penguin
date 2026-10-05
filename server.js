import http from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {networkInterfaces} from 'node:os';
import {emptyState,nextQuestion,view,markdown} from './lib/domain.js';
import {compile} from './lib/compiler.js';
const root=fileURLToPath(new URL('.',import.meta.url));const data=join(root,'data','appointment-sessions');await mkdir(data,{recursive:true});
const busy=new Set();
const save=async s=>{const p=join(data,s.id+'.json'),temp=p+'.tmp';await writeFile(temp,JSON.stringify(s,null,2));await rename(temp,p);};
const load=async id=>{if(!/^[0-9a-f-]{36}$/.test(id))throw Object.assign(new Error('接待不存在。'),{status:404});try{return JSON.parse(await readFile(join(data,id+'.json'),'utf8'));}catch{throw Object.assign(new Error('接待不存在。'),{status:404});}};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw Object.assign(new Error('文字過長，請縮短後再試。'),{status:413});}try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('無效的請求。'),{status:400});}}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
 try{
 if(req.method==='GET'&&url.pathname==='/api/health'){const r=spawnSync(process.env.CODEX_BIN||'codex',['login','status'],{encoding:'utf8',timeout:3000});return send(200,{ok:true,cliReady:r.status===0&&/ChatGPT/.test(r.stdout+r.stderr)});}
 if(req.method==='POST'&&url.pathname==='/api/sessions'){const s={id:randomUUID(),createdAt:new Date().toISOString(),state:emptyState(),turns:[],runs:[],phase:'intro',domain:'appointment-v1'};await save(s);return send(201,view(s));}
 const match=url.pathname.match(/^\/api\/sessions\/([^/]+)(?:\/(turns|finish|confirm|resume|contact|export))?$/);
 if(match){const [,id,action]=match;const s=await load(id);
  if(req.method==='GET'&&action==='export'){const md=url.searchParams.get('format')==='md';res.writeHead(200,{'Content-Type':md?'text/markdown; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="appointment-intake-${id.slice(0,8)}.${md?'md':'json'}"`});return res.end(md?markdown(s):JSON.stringify({...s,result:view(s)},null,2));}
  if(req.method==='GET'&&!action)return send(200,view(s));
  if(req.method==='POST'&&['turns','finish','confirm','resume','contact'].includes(action)){
   if(busy.has(id))return send(409,{error:'目前正在整理，請稍候。'});busy.add(id);
   try{
    if(action==='contact'){const b=await body(req);const name=typeof b.name==='string'?b.name.trim():'';const email=typeof b.email==='string'?b.email.trim():'';const phone=typeof b.phone==='string'?b.phone.trim():'';if(s.phase!=='result')return send(400,{error:'請先完成初步評估。'});if(!name||(!email&&!phone)||name.length>100||email.length>254||phone.length>50||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return send(400,{error:'請填寫姓名及有效的 Email 或電話。'});s.contact={name,email,phone,savedAt:new Date().toISOString()};await save(s);return send(200,view(s));}
    if(action==='resume'){const b=await body(req);const paused=s.paused;const extra=typeof b.draft==='string'?b.draft:'';s.phase=paused?.phase||(s.turns.length===0?'intro':nextQuestion(s.state)?'questions':'review');s.draft=paused?.draft||'';if(extra.trim()&&extra!==s.draft)s.draft+=(s.draft?'\n\n':'')+extra;s.editing=paused?.editing||false;if(s.phase==='review'&&s.draft)s.editing=true;delete s.paused;await save(s);return send(200,view(s));}
    if(action==='confirm'){s.draft='';s.editing=false;s.phase=nextQuestion(s.state)?'questions':'result';await save(s);return send(200,view(s));}
    if(action==='finish'){const b=await body(req);if(s.phase!=='result')s.paused={phase:s.phase,draft:typeof b.draft==='string'?b.draft:'',editing:b.editing===true};s.phase='result';await save(s);return send(200,view(s));}
    const b=await body(req);if(typeof b.text!=='string'||!b.text.trim())return send(400,{error:'請輸入內容，或選擇還沒決定。'});
    const question=s.phase==='questions'?nextQuestion(s.state):null;
    const turn={id:s.turns.length+1,text:b.text.trim(),question_key:question?.key??null,question:question?.text??null};
    const proposed=[...s.turns,turn];let run;
    try{run=await compile(s.state,proposed);}catch(e){s.runs.push({at:new Date().toISOString(),failed:true,error:e.message,input:turn});await save(s);return send(502,{error:e.message});}
    s.draft='';s.editing=false;delete s.paused;s.turns=proposed;s.state=run.state;s.runs.push({at:new Date().toISOString(),...run});s.phase=s.phase==='intro'?'review':s.phase==='result'?'result':nextQuestion(s.state)?'questions':'result';await save(s);return send(200,view(s));
   }finally{busy.delete(id);}
  }
  return send(405,{error:'不支援的操作。'});
 }
 if(req.method==='GET'&&['/','/app.js','/style.css'].includes(url.pathname)){const file=url.pathname==='/'?'index.html':url.pathname.slice(1);res.writeHead(200,{'Content-Type':{'index.html':'text/html','app.js':'text/javascript','style.css':'text/css'}[file]+'; charset=utf-8'});return res.end(await readFile(join(root,'public',file)));}
 send(404,{error:'找不到頁面。'});
 }catch(e){send(e.status||500,{error:e.status?e.message:'暫時無法處理，請重試。'});}
});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>{
 const port=server.address().port;console.log(`預約需求 POC：http://localhost:${port}`);
 if(server.address().address==='0.0.0.0')for(const addresses of Object.values(networkInterfaces()))for(const address of addresses||[])if(address.family==='IPv4'&&!address.internal)console.log(`區網網址：http://${address.address}:${port}`);
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
