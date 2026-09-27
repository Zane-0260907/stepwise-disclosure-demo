import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {synthetic} from './build-frontier-workloads.mjs';
import {planDisclosureFrontier} from '../src/research/bounded-disclosure-frontier.mjs';
import {planLiveFrontier} from '../src/research/live-frontier.mjs';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
const root=new URL('../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const destination=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'data/research/frontier-local';
if(!/^data\/[A-Za-z0-9_./-]+$/.test(destination)||destination.split('/').includes('..'))throw Error('Output must be a new directory below data/');
const out=new URL(destination.replace(/\/$/,'')+'/',root);
await mkdir(out,{recursive:true});try{await access(new URL('records.json',out));throw Error('ALREADY_COMPLETED');}catch(e){if(e.code!=='ENOENT')throw e;}
const workloads=[];let seed=91000;
for(const family of ['independent','local-share','wide-share','overlap','recipient','mixed-local'])for(const n of [8,16,32,64])for(let repeat=0;repeat<2;repeat++){
 const w=synthetic(family,n,seed++);w.id='final-'+w.id;
 let s=w.seed;const rnd=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 // New cost/history assignments, specified before inspecting their outcomes.
 for(const step of w.steps)for(const a of step.alternatives)a.work=1+Math.floor(rnd()*4);
 const tokens=[...new Set(w.steps.flatMap(x=>x.alternatives.flatMap(a=>a.tokens)))];w.history=tokens.filter(()=>rnd()<.10);
 workloads.push(w);
}
const bytes=JSON.stringify(workloads,null,2)+'\n';await writeFile(new URL('workloads.json',out),bytes);
const sources=['src/research/bounded-disclosure-frontier.mjs','src/research/lex-frontier.mjs','src/research/live-frontier.mjs','scripts/frontier-milp.py','scripts/run-disclosure-study.mjs'];
const hashes={};for(const f of sources){const bytes=await readFile(new URL(f,root));hashes[f]=sha(bytes);const target=new URL('frozen-source/'+f,out);await mkdir(path.dirname(fileURLToPath(target)),{recursive:true});await writeFile(target,bytes);}
const protocol={frozenAt:new Date().toISOString(),sourceHashes:hashes,workloadsSha256:sha(bytes),cases:48,seedStart:91000,modifications:'Work cost uniformly 1..4; each candidate token independently in initial history with p=.10.',relation:'New cost/history draws of the six development workload families, not a new real-world domain.',methods:['greedy','live-frontier','disclosure-frontier','milp'],repeats:3,maxLabels:4096,slacks:[0,.25,1],timeLimitMs:10000};
await writeFile(new URL('protocol.json',out),JSON.stringify(protocol,null,2)+'\n');
const py=spawn(process.env.PYTHON||'python',['-u',fileURLToPath(new URL('frontier-milp.py',import.meta.url))],{stdio:['pipe','pipe','inherit']}),lines=createInterface({input:py.stdout});let pending;
lines.on('line',line=>{pending?.(JSON.parse(line));pending=null;});
const oracle=payload=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ORACLE_TIMEOUT')),30000);pending=r=>{clearTimeout(timer);resolve(r);};py.stdin.write(JSON.stringify(payload)+'\n');});
const records=[];
try{
 for(const [ci,w]of workloads.entries())for(const slack of protocol.slacks){
  const reference=planBudgeted(w.steps,w.history,{strategy:'greedy'}),budget=Math.floor(reference.fields*(1+slack)+1e-9);
  for(let repeat=0;repeat<3;repeat++)for(let mi=0;mi<4;mi++){
   const method=protocol.methods[(ci+repeat+mi)%4],started=performance.now();let result;
   try{
    if(method==='milp')result=await oracle({workload:w,budget,timeLimitMs:10000});
    else{
     const p=method==='disclosure-frontier'?planDisclosureFrontier(w.steps,w.history,{maxFields:budget,maxLabels:4096}):method==='live-frontier'?planLiveFrontier(w.steps,w.history,{maxFields:budget,maxLabels:4096}):planBudgeted(w.steps,w.history,{strategy:'greedy',maxFields:budget});
     result={status:p.feasible?'optimal-candidate':'infeasible',tuple:p.feasible?[p.newDisclosures.length,p.work,p.fields]:null,path:p.path?.map(a=>a.id),peak:p.peak,width:p.width,components:p.components,largestComponent:p.largestComponent,elapsedMs:performance.now()-started};
    }
   }catch(e){result={status:e.message==='FRONTIER_BOUND_EXCEEDED'?'label-limit':'error',error:e.message,elapsedMs:performance.now()-started};}
   records.push({caseId:w.id,family:w.family,n:w.n,slack,budget,repeat,method,...result});
  }
  await writeFile(new URL('records.partial.json',out),JSON.stringify(records,null,2)+'\n');
  if(slack===1)console.log(JSON.stringify({done:ci+1,id:w.id,results:records.filter(r=>r.caseId===w.id&&r.slack===1&&r.repeat===0).map(r=>({method:r.method,status:r.status,tuple:r.tuple,ms:Math.round(r.elapsedMs),peak:r.peak}))}));
 }
 await writeFile(new URL('records.json',out),JSON.stringify(records,null,2)+'\n');
}finally{py.stdin.end();lines.close();}
