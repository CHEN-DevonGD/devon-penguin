import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {compile,settings} from '../lib/compiler.js';
import {emptyState,nextQuestion,quote} from '../lib/domain.js';
const cases=JSON.parse(await readFile(new URL('../fixtures/cases.json',import.meta.url),'utf8'));
const reportDir=process.env.BENCHMARK_DIR||'data/benchmarks';
const limit=Number(process.env.CASE_LIMIT||cases.length),results=[],times=[];
export function assess(state,e){const failures=[],q=quote(state);const active=state.services.filter(s=>s.status==='confirmed');const test=(ok,msg)=>{if(!ok)failures.push(msg);};if(e.intent)test(state.intent===e.intent,'intent');for(const [k,n]of Object.entries(e.services||{}))test(state.services.some(s=>s.kind===k&&s.status!=='excluded'&&s.quantity===n),'service:'+k);for(const k of e.absent||[])test(!active.some(s=>s.kind===k),'excluded:'+k);for(const status of ['known','undecided','conflict'])for(const k of e[status]||[])test(state.slots[k].status===status,status+':'+k);for(const [k,v]of Object.entries(e.contains||{}))test(state.slots[k].value?.includes(v),'value:'+k);if(e.subtotal!==undefined)test(q.subtotal===e.subtotal,'subtotal:'+q.subtotal);if(e.pending)test(q.pending.length>0,'pending');return failures;}
for(const c of cases.slice(0,limit)){
 let state=emptyState(),turns=[],runs=[],errors=[];for(const text of c.messages){const question=turns.length?nextQuestion(state):null;turns.push({id:turns.length+1,text,question_key:question?.key??null,question:question?.text??null});try{const run=await compile(state,turns);state=run.state;runs.push(run);times.push(run.durationMs);}catch(e){errors.push(e.message);break;}}
 const failures=errors.length?errors:assess(state,c.expect);const result={id:c.id,name:c.name,passed:failures.length===0,failures,expect:c.expect,turns,runs,state,quote:quote(state)};results.push(result);console.log(`${result.passed?'PASS':'FAIL'} ${c.id} ${runs.map(r=>(r.durationMs/1000).toFixed(1)+'s').join(', ')} ${failures.join('; ')}`);
 await mkdir(reportDir,{recursive:true});await writeFile(reportDir+'/latest.partial.json',JSON.stringify(results,null,2));
}
const sorted=times.toSorted((a,b)=>a-b);const percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??null;
const report={at:new Date().toISOString(),settings,passed:results.filter(r=>r.passed).length,total:results.length,latency:{calls:times.length,medianMs:percentile(.5),p90Ms:percentile(.9),over10s:times.filter(t=>t>10000).length},results};
const name=reportDir+'/' +new Date().toISOString().replace(/[:.]/g,'-')+'.json';await writeFile(name,JSON.stringify(report,null,2));await writeFile(reportDir+'/latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify({report:name,passed:report.passed,total:report.total,latency:report.latency}));if(report.passed!==report.total)process.exitCode=1;
