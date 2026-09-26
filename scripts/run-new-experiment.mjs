// Fresh or explicitly resumed records; published archives are never overwritten.
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRun} from '../src/research/engine.mjs';
import {executeFinancialRun} from '../src/research/financial-execution.mjs';
import {executeControlledRun} from '../src/research/controlled-execution-v4.mjs';
import {scoreFinancial} from '../src/research/financial-score.mjs';
import {scoreValidation} from '../src/research/validation-score.mjs';
import {createTransport} from '../src/research/transport.mjs';
import {startDeepSeekProxy} from '../src/research/deepseek-live.mjs';
import {claimExperimentDirectory} from '../src/research/experiment-directory.mjs';
const root=new URL('../',import.meta.url),pilot=process.argv.includes('--pilot');
const suite=process.argv.includes('--controls')?'controls':'finqa';
const pilotRound=process.argv.find(x=>/^--pilot-round=\d+$/.test(x))?.split('=')[1]||'1';
const protocol=pilot?{id:`v4-${suite}-development-${pilotRound}`,suite,model:'deepseek-flash',methods:suite==='finqa'?['eager_allowed','requested_cells','local_program']:['joint','allowed_eager','numeric_prefetch','no_acquisition'],repetitions:1,concurrency:3,hashes:{}}:JSON.parse(await readFile(new URL(`evidence/validation-v4/${suite}/protocol.json`,root),'utf8'));
async function verify(){for(const [file,hash] of Object.entries(protocol.hashes))if(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex')!==hash)throw Error(`PROTOCOL_CHANGED: ${file}`);}
await verify();
const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw Error('DEEPSEEK_API_KEY is required for new calls. Use verify:v4 for saved records.');
const prefix=suite==='finqa'?'finqa-v4':'validation-v3';
let cases=JSON.parse(await readFile(new URL(`fixtures/${prefix}/${pilot&&suite==='finqa'?'development':'cases'}.json`,root),'utf8'));
if(pilot&&suite==='controls')cases=cases.filter(c=>['progressive-09','progressive-17','progressive-25'].includes(c.id));
if(pilot&&suite==='finqa')cases=cases.slice(0,3);
const labels=JSON.parse(await readFile(new URL(`fixtures/${prefix}/labels.json`,root),'utf8'));
const suppliedId=process.argv.find(x=>x.startsWith('--run-id='))?.slice(9);
if(suppliedId&&!/^[a-zA-Z0-9_-]{1,90}$/.test(suppliedId))throw Error('Invalid run-id');
const recordId=suppliedId||`new-${suite}-${Date.now()}`;
console.log(JSON.stringify({recordDirectory:`data/research/validation/${recordId}`,protocol:protocol.id}));
const claim=await claimExperimentDirectory(new URL('data/research/validation/',root),recordId,protocol);
const dir=claim.directory;let proxy,transport;
try {
proxy=await startDeepSeekProxy({key,recordDirectory:new URL('provider-egress/',dir)});
process.env.DASHSCOPE_API_KEY=proxy.internalToken;process.env.DEMO_MODEL_URL=proxy.url;
transport=await createTransport();let previous=[];
try{previous=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code!=='ENOENT')throw e;}
const completed=new Set(previous.map(r=>r.jobId)),jobs=[];
if(completed.size!==previous.length)throw Error('DUPLICATE_SAVED_JOB');
const permittedJobs=new Set(cases.flatMap(item=>protocol.methods.flatMap(method=>Array.from({length:protocol.repetitions},(_,repetition)=>`${item.id}/${method}/${repetition}`))));
if(previous.some(row=>!permittedJobs.has(row.jobId)))throw Error('RESUME_JOB_MISMATCH');
for(let repetition=0;repetition<protocol.repetitions;repetition++)for(let i=0;i<cases.length;i++)for(let j=0;j<protocol.methods.length;j++){
 const method=protocol.methods[(j+i+repetition)%protocol.methods.length],item=cases[i],jobId=`${item.id}/${method}/${repetition}`;
 if(!completed.has(jobId))jobs.push({item,method,repetition,jobId});
}
const total=cases.length*protocol.methods.length*protocol.repetitions;
await writeFile(new URL('manifest.json',dir),JSON.stringify({protocol,startedAt:claim.previous?.startedAt||new Date().toISOString(),resumedAt:claim.previous?new Date().toISOString():null,previous:previous.length,pending:jobs.length},null,2));
let next=0,done=previous.length,stop=false;
 await Promise.all(Array.from({length:protocol.concurrency},async()=>{
  while(next<jobs.length&&!stop){
   const {item,method,repetition,jobId}=jobs[next++],run=createRun(item,{method:'joint',model:protocol.model});run.method=method;
   if(suite==='finqa')await executeFinancialRun(run,item,transport);else await executeControlledRun(run,item,transport);
   const score={...(suite==='finqa'?scoreFinancial(run,labels[item.id]):scoreValidation(run,labels[item.id])),jobId,repetition};
   await writeFile(new URL(`${run.id}.json`,dir),JSON.stringify(run));await appendFile(new URL('scores.jsonl',dir),JSON.stringify(score)+'\n');done++;
   if(pilot||done%12===0||done===total)console.log(JSON.stringify({suite,done,total,caseId:item.id,method,success:score.structuredSuccess,error:score.error}));
   if(/MODEL_HTTP_(401|402|403)|Arrearage|Insufficient Balance/.test(run.error||''))stop=true;
  }
 }));
 await verify();await writeFile(new URL(done===total?'complete.json':'interrupted.json',dir),JSON.stringify({done,total,finishedAt:new Date().toISOString(),reason:stop?'provider error':null},null,2));
 if(done!==total)process.exitCode=2;
}finally{transport?.close();await proxy?.close();await claim.release();}
