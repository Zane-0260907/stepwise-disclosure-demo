// A separate serial timing pass fixes the first runner's cached-greedy timing.
// Published development timings remain intact; no model calls are performed.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {planDisclosureFrontier} from '../src/research/bounded-disclosure-frontier.mjs';
import {planLiveFrontier} from '../src/research/live-frontier.mjs';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
const base=new URL('../evidence/frontier-study/final/',import.meta.url),load=async p=>JSON.parse(await readFile(new URL(p,base)));
const destination=process.argv.find(x=>x.startsWith('--out='))?.slice(6)||'data/research/frontier-timing';
if(!/^data\/[A-Za-z0-9_./-]+$/.test(destination)||destination.split('/').includes('..'))throw Error('Output must be below data/');
const out=new URL('../'+destination.replace(/\/$/,'')+'/',import.meta.url);await mkdir(out,{recursive:true});
try{await access(new URL('timing.json',out));throw Error('ALREADY_COMPLETED');}catch(e){if(e.code!=='ENOENT')throw e;}
const workloads=await load('workloads.json'),results=await load('records.json'),records=[];
const py=spawn(process.env.PYTHON||'python',['-u',fileURLToPath(new URL('frontier-milp.py',import.meta.url))],{stdio:['pipe','pipe','inherit']});
let pending;const lines=createInterface({input:py.stdout});lines.on('line',line=>{pending?.(JSON.parse(line));pending=null;});
const oracle=x=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('ORACLE_TIMEOUT')),30000);pending=r=>{clearTimeout(timer);resolve(r);};py.stdin.write(JSON.stringify(x)+'\n');});
try{
 for(const [i,w]of workloads.entries())for(const slack of [0,.25,1]){
  const baseRecord=results.find(r=>r.caseId===w.id&&r.slack===slack&&r.method==='milp'&&r.repeat===0),budget=baseRecord.budget;
  for(let repeat=-1;repeat<5;repeat++)for(let j=0;j<4;j++){
   const method=['greedy','live-frontier','disclosure-frontier','milp'][(i+repeat+5+j)%4],start=performance.now();let result;
   try{
    if(method==='milp')result=await oracle({workload:w,budget,timeLimitMs:10000});
    else{
     const p=method==='greedy'?planBudgeted(w.steps,w.history,{strategy:'greedy',maxFields:budget}):method==='live-frontier'?planLiveFrontier(w.steps,w.history,{maxFields:budget}):planDisclosureFrontier(w.steps,w.history,{maxFields:budget});
     result={status:p.feasible?'optimal-candidate':'infeasible',elapsedMs:performance.now()-start,tuple:p.feasible?[p.newDisclosures.length,p.work,p.fields]:null};
    }
   }catch(e){result={status:e.message==='FRONTIER_BOUND_EXCEEDED'?'label-limit':'error',error:e.message,elapsedMs:performance.now()-start};}
   if(result.tuple&&method!=='greedy'&&JSON.stringify(result.tuple)!==JSON.stringify(baseRecord.tuple))throw Error('TIMING_RESULT_CHANGED');
   if(repeat>=0)records.push({caseId:w.id,slack,method,repeat,...result});
  }
  if(slack===1&&i%8===7)console.log(JSON.stringify({timedCases:i+1,total:48}));
 }
 await writeFile(new URL('timing.json',out),JSON.stringify({description:'Serial measurements. One warm-up and five measured repetitions, rotated method order. JS timing includes planning; Python timing includes model construction and solver but excludes IPC/import. Greedy is actually recomputed. No dedicated CPU isolation.',records},null,2)+'\n',{flag:'wx'});
}finally{py.stdin.end();lines.close();}
