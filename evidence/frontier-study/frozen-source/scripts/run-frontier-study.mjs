import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
const root=new URL('../',import.meta.url),base=new URL('evidence/frontier-study/',root);
const load=async f=>JSON.parse(await readFile(new URL(f,base))),sha=x=>createHash('sha256').update(x).digest('hex');
const p=await load('protocol.json'),raw=await readFile(new URL('workloads.json',base));
if(sha(raw)!==p.workloadsSha256)throw Error('WORKLOAD_HASH_MISMATCH');
for(const [f,h]of Object.entries(p.sourceHashes))if(sha(await readFile(new URL(f,root)))!==h)throw Error('SOURCE_HASH_MISMATCH:'+f);
const file=new URL('records.json',base);try{await access(file);throw Error('RECORDS_ALREADY_EXIST');}catch(e){if(e.code!=='ENOENT')throw e;}
const workloads=JSON.parse(raw),records=[];
const py=spawn(process.env.PYTHON||'python',['-u',fileURLToPath(new URL('frontier-milp.py',import.meta.url))],{stdio:['pipe','pipe','inherit']});
const lines=createInterface({input:py.stdout});let pending;
lines.on('line',line=>{pending?.(JSON.parse(line));pending=null;});
async function oracle(payload){return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=null;reject(Error('ORACLE_TRANSPORT_TIMEOUT'));},p.timeLimitMs+20000);pending=x=>{clearTimeout(timer);resolve(x);};py.stdin.write(JSON.stringify(payload)+'\n');});}
async function javascript(payload){
 const worker=new Worker(new URL('frontier-worker.mjs',import.meta.url));
 return await new Promise(resolve=>{
  let start;const timer=setTimeout(()=>done({status:'time-limit',elapsedMs:p.timeLimitMs}),p.timeLimitMs+1000);
  const done=result=>{clearTimeout(timer);worker.terminate();resolve(result);};
  worker.once('online',()=>{start=performance.now();worker.postMessage(payload);});worker.once('message',done);worker.once('error',e=>done({status:'error',error:e.message,elapsedMs:performance.now()-start}));
 });
}
const hardware={node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryBytes:os.totalmem(),protocolSha256:sha(await readFile(new URL('protocol.json',base)))};
await writeFile(new URL('machine.json',base),JSON.stringify(hardware,null,2)+'\n');
try{
 for(const [ci,w]of workloads.entries()){
  if(!w.steps){records.push({caseId:w.id,status:'source-model-failed'});continue;}
  const greedy=planBudgeted(w.steps,w.history,{strategy:'greedy'}),budget=Math.floor(greedy.fields*(1+w.slack));
  for(let repeat=0;repeat<p.repeats;repeat++)for(let mi=0;mi<p.methods.length;mi++){
   const method=p.methods[(ci+repeat+mi)%p.methods.length],payload={workload:w,method,budget,limit:p.maxLabels,timeLimitMs:p.timeLimitMs};
   const result=method==='milp'?await oracle(payload):await javascript(payload);
   records.push({caseId:w.id,family:w.family,n:w.n,repeat,method,budget,...result});
   // All three repetitions, including limit failures, are retained.
  }
  await writeFile(new URL('records.partial.json',base),JSON.stringify(records,null,2)+'\n');
  console.log(JSON.stringify({done:ci+1,total:workloads.length,id:w.id,results:records.filter(r=>r.caseId===w.id&&r.repeat===0).map(r=>({method:r.method,status:r.status,ms:Math.round(r.elapsedMs),tuple:r.tuple,peak:r.peak}))}));
 }
 await writeFile(file,JSON.stringify(records,null,2)+'\n');
}finally{py.stdin.end();lines.close();}
