import pricing from '../config/pricing.json' with { type: 'json' };
export const fields = [
 ['services','需要的功能','除了基本預約，還需要自動提醒、多人管理或行事曆同步嗎？其他想法也可以說。'],
 ['purpose','使用情境與目的','你提供什麼服務？希望讓誰預約你的時間，改善什麼問題？'],
 ['team','使用與管理人員','有幾位人員可以被預約？誰負責管理預約？'],
 ['availability','時段與預約規則','每次預約多久？有哪些可預約時段、提前預約或取消的規則？'],
 ['workflow','目前做法與額外要求','目前怎麼安排預約？需要沿用哪些資料，或與其他工具連接？沒有也可以直接說。'],
 ['budget','預算與付費方式','每月服務費及一次性設定費，各有多少預算？還沒決定也沒關係。'],
 ['deadline','開始使用時間','希望什麼時候開始使用？有固定日期嗎？']
];
export function emptyState(){return {intent:'planning',services:[],services_status:'missing',slots:Object.fromEntries(fields.slice(1).map(([k])=>[k,{value:null,status:'missing',source_turn:null,source_quote:null}]))};}
export function nextQuestion(state){
 if(state.intent==='out_of_scope') return null;
 const conflict=fields.find(([k])=>(k==='services'?state.services_status:state.slots[k].status)==='conflict');
 if(conflict) return {key:conflict[0],text:`關於「${conflict[1]}」，目前有不同說法。可以確認你最後想採用哪個安排嗎？`};
 if(state.services_status==='missing')return {key:'services',text:fields[0][2]};
 const missing=fields.slice(1).find(([k])=>state.slots[k].status==='missing');
 return missing?{key:missing[0],text:missing[2]}:null;
}
export function budgetAmount(text){
 if(!text||/[到至~～–-]|美金|美元|日圓|日元|歐元|USD|JPY|EUR/i.test(text))return null;
 const m=text.replaceAll(',','').match(/([0-9]+(?:\.[0-9]+)?|[零〇一二兩三四五六七八九十百千]+)\s*(萬|万|千)?\s*(元|塊|塊錢)?/);
 if(!m)return null;
 if(/^[零〇一二兩三四五六七八九十百千0-9]/.test(text.replaceAll(',','').slice(m.index+m[0].length).trim()))return null;
 let n=Number(m[1]);
 if(!Number.isFinite(n)){const digits={零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000};n=0;let digit=0;for(const c of m[1]){if(c in digits)digit=digits[c];else {n+=(digit||1)*units[c];digit=0;}}n+=digit;}
 return n*({萬:10000,万:10000,千:1000}[m[2]]||1);
}
export function quote(state){
 const lines=[],pending=[];
 for(const s of state.services){
  if(s.status==='excluded')continue;
  const item=pricing.items[s.kind];
  if(state.intent!=='planning'||s.status!=='confirmed'||!item){pending.push({label:s.label,reason:!item?'另外開發，需專人確認範圍與報價':s.status==='conflict'?'需求有矛盾，待確認':'是否採用待確認',unitPrice:item?.price??null});continue;}
  lines.push({kind:s.kind,label:item.label,quantity:1,unit:item.unit,unitPrice:item.price,amount:item.price,setup:item.setup});
 }
 const monthly=lines.reduce((a,l)=>a+l.amount,0),setup=lines.reduce((a,l)=>a+l.setup,0);
 return {currency:pricing.currency,label:pricing.label,lines,pending,monthly,setup,subtotal:monthly,overBudget:false};
}
export function view(session){const q=nextQuestion(session.state);return {id:session.id,contact:session.contact||null,state:session.state,question:q,phase:session.phase,canResume:session.phase==='result',draft:session.phase==='result'?'':session.draft||'',editing:session.editing===true,turnCount:session.turns.length,quote:quote(session.state),progress:{completed:fields.filter(([k])=>(k==='services'?session.state.services_status:session.state.slots[k].status)!=='missing').length,total:fields.length},lastDurationMs:session.runs.at(-1)?.durationMs??null};}
export function markdown(session){const v=view(session);return ['# 預約服務需求摘要','',pricing.label,'','## 所需功能',...v.state.services.filter(s=>s.status!=='excluded').map(s=>`- ${s.label}（${s.status==='confirmed'?'已確認':'待確認'}）`),'','## 需求條件',...fields.slice(1).map(([k,label])=>`- ${label}：${v.state.slots[k].value??'未提供'}`),'','## 初步費用',...v.quote.lines.map(l=>`- ${l.label}：每月 NT$${l.amount}；一次性 NT$${l.setup}`),`每月服務費：NT$${v.quote.monthly}`,`一次性設定費：NT$${v.quote.setup}`,...v.quote.pending.map(l=>`- 待評估：${l.label}，${l.reason}`),'','所有功能與價格為 POC 示範；另外開發、第三方費用及稅額需專人確認。',...(v.contact?['','## 聯絡資料',`姓名：${v.contact.name}`,`Email：${v.contact.email}`,`電話：${v.contact.phone}`]:[]),'','以上為初步需求與費用評估，後續將由專人與您聯絡，確認適合的方案與正式報價。',''].join('\n');}
