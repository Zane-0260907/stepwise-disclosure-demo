import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {alternatives} from '../src/research/model-repair-v8.mjs';
const root=new URL('../',import.meta.url),out=new URL('evidence/frontier-study/',root);
const sha=x=>createHash('sha256').update(x).digest('hex');
const a=(id,tokens,fields=tokens.length,work=1)=>({id,tokens,fields,work,feasible:true});
function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function synthetic(family,n,seed){
 const r=random(seed),history=[],steps=[];
 for(let i=0;i<n;i++){
  let options;
  if(family==='independent') options=[a('left',[`l:${i}`]),a('right',[`r:${i}`])];
  else if(family==='local-share') {const k=Math.floor(i/4);options=[a('private',[`value:${i}`]),a('shared',[`raw:${k}:x`,`raw:${k}:y`])];}
  else if(family==='wide-share') {const k=i%Math.max(2,Math.floor(n/2));options=[a('private',[`view:${i}`]),a('shared',[`x:${k}`,`y:${k}`])];}
  else if(family==='overlap') {const k=Math.floor(i/4);options=[a('a',[`r:a${k}`,`r:a${k+1}`],2,1+Math.floor(r()*3)),a('b',[`r:b${k}`,`r:b${k+1}`],2,1+Math.floor(r()*3)),a('u',[`r:u${i}`],1,2)];}
  else if(family==='recipient') {const k=Math.floor(i/3);options=[a('service-a',[`service-a:x${k}`,`service-a:y${k}`]),a('service-b',[`service-b:x${k}`,`service-b:y${k}`]),a('derived',[`service-a:v${i}`],1,2)];if(k%3===0)history.push(`service-a:x${k}`);}
  else if(family==='mixed-local') {const k=Math.floor(i/4);options=[a('raw',[`r:x${k}`,`r:y${k}`],2,2),a('derived',[`r:v${i}`],1,1),{...a('local',[],0,2),feasible:i%4===0}];}
  else throw Error('UNKNOWN_FAMILY');
  steps.push({alternatives:options});
 }
 return {id:`syn-${family}-${n}-${seed}`,sourceKind:'constructed-planning-workload',family,n,seed,history:[...new Set(history)],steps,slack:1};
}
export async function build(){
 const workloads=[];let seed=71000;
 for(const family of ['independent','local-share','wide-share','overlap','recipient','mixed-local'])for(const n of [8,16,32,64])for(let repeat=0;repeat<2;repeat++)workloads.push(synthetic(family,n,seed++));
 const cases=JSON.parse(await readFile(new URL('fixtures/model-repair-v8/cases.json',root)));
 const dir=new URL('data/research/validation/frozen-v8-20260927/',root);
 const models=(await readdir(dir)).filter(f=>f.endsWith('.model.json')).sort();
 for(const filename of models){
  const raw=await readFile(new URL(filename,dir)),model=JSON.parse(raw),item=cases.find(c=>c.id===model.caseId);
  if(!item)throw Error('UNKNOWN_MODEL_SOURCE');
  if(model.status!=='ready') {workloads.push({id:`model-${model.id}`,sourceKind:'saved-model-plan',family:'model',n:0,sourceId:item.sourceId,sourceFile:item.sourceFile,modelRecord:model.id,sourceSha256:sha(raw),status:model.status,error:model.error});continue;}
  const state={facts:item.facts,versions:Object.fromEntries(Object.keys(item.facts).map(k=>[k,1])),localOps:['add','subtract'],allowedFields:Object.keys(item.facts),remoteAllowed:true};
  workloads.push({id:`model-${model.id}`,sourceKind:'saved-model-plan',family:'model',n:model.program.length,sourceId:item.sourceId,sourceFile:item.sourceFile,modelRecord:model.id,sourceSha256:sha(raw),history:[],steps:model.program.map((_,i)=>({alternatives:alternatives(model.program,i,state)})),slack:1});
 }
 await mkdir(out,{recursive:true});
 const bytes=JSON.stringify(workloads,null,2)+'\n';await writeFile(new URL('workloads.json',out),bytes);
 const sources=['src/research/live-frontier.mjs','src/research/budget-frontier-v8.mjs','scripts/build-frontier-workloads.mjs','scripts/run-frontier-study.mjs','scripts/frontier-worker.mjs','scripts/frontier-milp.py'];
 const hashes={};for(const file of sources)hashes[file]=sha(await readFile(new URL(file,root)));
 const protocol={id:'frontier-study-20260928',createdAt:new Date().toISOString(),workloadsSha256:sha(bytes),sourceHashes:hashes,synthetic:workloads.filter(w=>w.family!=='model').length,savedPlans:models.length,newModelCalls:0,methods:['greedy','full-frontier','live-frontier','milp'],maxLabels:4096,timeLimitMs:10000,repeats:3,order:'rotated by case and repeat',budget:'At most twice the shared greedy numeric-field traffic; one common explicit budget per case',note:'Synthetic workloads are separate from saved real model plans; repeats are timing repetitions, not independent samples.'};
 await writeFile(new URL('protocol.json',out),JSON.stringify(protocol,null,2)+'\n');
 console.log(JSON.stringify({workloads:workloads.length,synthetic:protocol.synthetic,models:models.length}));
}
if(process.argv[1]&&new URL('file:///'+process.argv[1].replaceAll('\\','/')).href===import.meta.url)await build();
