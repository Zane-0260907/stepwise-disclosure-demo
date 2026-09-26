import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { METHODS } from '../src/research/catalog.mjs';
const id=process.argv[2]||'frozen-v1-20260925';if(!/^[\w.-]+$/.test(id))throw new Error('Invalid ID');
const source=new URL(`../data/research/experiments/${id}/`,import.meta.url);
await readFile(new URL('complete.json',source));
const manifest=JSON.parse(await readFile(new URL('manifest.json',source),'utf8'));
const rows=(await readFile(new URL('scores.jsonl',source),'utf8')).trim().split('\n').map(JSON.parse);
if(rows.length!==manifest.jobs)throw new Error('Incomplete results');
if(new Set(rows.map(r=>`${r.caseId}|${r.method}|${r.repetition}`)).size!==rows.length)throw new Error('Duplicate experiment rows');
const out=new URL('../evidence/research/results/',import.meta.url);await mkdir(out,{recursive:true});
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const quantile=(a,q)=>{const s=[...a].sort((x,y)=>x-y);if(!s.length)return null;const i=(s.length-1)*q,lo=Math.floor(i);return s[lo]+(s[Math.ceil(i)]-s[lo])*(i-lo);};
let seed=20260925;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
function ci(values){const boots=[];for(let b=0;b<2000;b++){let total=0;for(let i=0;i<values.length;i++)total+=values[Math.floor(rand()*values.length)];boots.push(total/values.length);}return [quantile(boots,.025),quantile(boots,.975)];}
const caseRows=[];
for(const method of METHODS)for(const caseId of manifest.caseIds){
 const group=rows.filter(r=>r.method===method&&r.caseId===caseId);if(group.length!==manifest.repeats)throw new Error(`Wrong repeats ${caseId}/${method}`);
 caseRows.push({method,caseId,family:group[0].family,success:mean(group.map(r=>Number(r.structuredTaskSuccess))),unnecessary:mean(group.map(r=>r.unnecessaryFactTransmissions||0)),total:mean(group.map(r=>r.totalFactTransmissions||0)),elapsedMs:mean(group.map(r=>r.elapsedMs||0)),bytes:mean(group.map(r=>r.bytes||0)),modelCalls:mean(group.map(r=>r.modelCalls||0)),forbidden:mean(group.map(r=>r.forbiddenFactTransmissions||0))});
}
const summary=METHODS.map(method=>{
 const group=rows.filter(r=>r.method===method),cases=caseRows.filter(r=>r.method===method),control=group.flatMap(r=>r.controlMs||[]);
 const byRecipient={};for(const recipient of ['cloud-model','reference-service'])byRecipient[recipient]={total:mean(group.map(r=>r.recipients?.[recipient]?.totalFacts||0)),unnecessary:mean(group.map(r=>r.recipients?.[recipient]?.unnecessaryFacts||0))};
 return {method,runs:group.length,cases:cases.length,structuredSuccess:mean(cases.map(r=>r.success)),successCI:ci(cases.map(r=>r.success)),completed:group.filter(r=>r.status==='completed').length,blocked:group.filter(r=>r.status==='blocked').length,failed:group.filter(r=>!['completed','blocked'].includes(r.status)).length,
   unnecessary:mean(cases.map(r=>r.unnecessary)),unnecessaryCI:ci(cases.map(r=>r.unnecessary)),totalFacts:mean(cases.map(r=>r.total)),forbiddenTasks:group.filter(r=>r.forbiddenFactTransmissions>0).length,
   latencyP50:quantile(group.map(r=>r.elapsedMs||0),.5),latencyP95:quantile(group.map(r=>r.elapsedMs||0),.95),controlP50:quantile(control,.5),controlP95:quantile(control,.95),modelCalls:group.reduce((s,r)=>s+(r.modelCalls||0),0),toolCalls:group.reduce((s,r)=>s+(r.toolCalls||0),0),promptTokens:group.reduce((s,r)=>s+(r.promptTokens||0),0),completionTokens:group.reduce((s,r)=>s+(r.completionTokens||0),0),bytes:group.reduce((s,r)=>s+(r.bytes||0),0),byRecipient};
});
const pair=(a,b,key)=>{const differences=manifest.caseIds.map(id=>caseRows.find(r=>r.caseId===id&&r.method===a)[key]-caseRows.find(r=>r.caseId===id&&r.method===b)[key]);return {difference:mean(differences),ci:ci(differences)};};
const labels=JSON.parse(await readFile(new URL('../fixtures/research/ground-truth.json',import.meta.url),'utf8'));
const errors={},sensitivity=[],review=[];
for(const row of rows){
 if(row.error)errors[row.error.split(':')[0]]=(errors[row.error.split(':')[0]]||0)+1;
 const run=JSON.parse(await readFile(new URL(`${row.runId}.json`,source),'utf8'));
 const zeroVsNull=run.status==='completed'&&labels[row.caseId].expectedAmount===0&&run.result?.amount===null&&row.classificationCorrect&&row.referenceCorrect;
 sensitivity.push({...row,zeroVsNull,relaxedSuccess:row.structuredTaskSuccess||zeroVsNull});
 if(!row.structuredTaskSuccess)review.push({runId:row.runId,caseId:row.caseId,method:row.method,reason:row.error||(!row.classificationCorrect?'classification':!row.amountCorrect?'amount':'reference'),expected:labels[row.caseId],actual:run.result,zeroVsNull});
}
const result={experiment:id,manifest,runs:rows.length,caseUnit:'60 cases; three repeats aggregated within case; percentile bootstrap 2000 samples',summary,paired:{jointVsFull:{success:pair('joint','full','success'),unnecessary:pair('joint','full','unnecessary')},jointVsPerStep:{success:pair('joint','per_step','success'),unnecessary:pair('joint','per_step','unnecessary'),elapsedMs:pair('joint','per_step','elapsedMs')}},errors,
  postHocSensitivity:{description:'Exploratory only: accept null instead of numeric zero for a completed no-penalty case. Original primary results unchanged.',methods:METHODS.map(method=>{const r=sensitivity.filter(x=>x.method===method);return{method,zeroVsNull:r.filter(x=>x.zeroVsNull).length,relaxedSuccess:mean(r.map(x=>Number(x.relaxedSuccess)))};})},
  limitations:['Synthetic inputs and explicitly supported operation contracts.','Self-authored mechanism baselines; no claim of outperforming MINIM/ToolMinimize/Fides.','Structured outcome checking is not independent human validation of prose.','Control timings are wall-clock intervals including event recording and scheduling, not isolated CPU costs.','No observed forbidden fields is limited to known fields through registered adapters.','Development and evaluation share operation families; no unseen-template generalization claim.'],humanTextReview:'not performed'};
await writeFile(new URL('summary.json',out),JSON.stringify(result,null,2));await writeFile(new URL('case-aggregates.json',out),JSON.stringify(caseRows,null,2));await writeFile(new URL('scores.jsonl',out),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');await writeFile(new URL('failures-for-review.json',out),JSON.stringify(review,null,2));
const columns=['runId','caseId','family','method','repetition','status','structuredTaskSuccess','unnecessaryFactTransmissions','totalFactTransmissions','forbiddenFactTransmissions','modelCalls','toolCalls','promptTokens','completionTokens','bytes','elapsedMs','error'];
const csv=columns.join(',')+'\n'+rows.map(r=>columns.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(',')).join('\n');await writeFile(new URL('scores.csv',out),'\uFEFF'+csv);
console.log(JSON.stringify({runs:rows.length,summary,paired:result.paired,postHocSensitivity:result.postHocSensitivity},null,2));
