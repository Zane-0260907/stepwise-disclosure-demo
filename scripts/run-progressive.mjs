import { readFile,writeFile,mkdir,appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun } from '../src/research/engine.mjs';
import { executeAdaptiveRun } from '../src/research/adaptive-execution.mjs';
import { createTransport } from '../src/research/transport.mjs';
import { startDeepSeekProxy } from '../src/research/deepseek-live.mjs';
import { scoreValidation } from '../src/research/validation-score.mjs';
const root=new URL('../',import.meta.url),pilot=process.argv.includes('--pilot');
const pilotRound=process.argv.find(x=>/^--pilot-round=\d+$/.test(x))?.split('=')[1]||'1';
const protocol=pilot?{id:`v3-development-on-v2-round${pilotRound}`,model:'deepseek-flash',methods:['joint'],repetitions:1,concurrency:2,jobs:3,hashes:{}}:JSON.parse(await readFile(new URL('evidence/validation-v3/protocol.json',root),'utf8'));
async function verify(){for(const[file,hash]of Object.entries(protocol.hashes))if(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex')!==hash)throw new Error(`PROTOCOL_CHANGED: ${file}`);}
await verify();
const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw new Error('DEEPSEEK_API_KEY required for new provider calls');
const fixtures=pilot?'validation-v2':'validation-v3';
let cases=JSON.parse(await readFile(new URL(`fixtures/${fixtures}/cases.json`,root),'utf8'));
if(pilot)cases=cases.filter(c=>['validation-07','validation-10','validation-25'].includes(c.id));
const labels=JSON.parse(await readFile(new URL(`fixtures/${fixtures}/labels.json`,root),'utf8'));
const dir=new URL(`data/research/validation/${protocol.id}/`,root);await mkdir(dir,{recursive:true});
const proxy=await startDeepSeekProxy({key,recordDirectory:new URL('provider-egress/',dir)});
process.env.DASHSCOPE_API_KEY=proxy.internalToken;process.env.DEMO_MODEL_URL=proxy.url;
const transport=await createTransport();let previous=[];
try{previous=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code!=='ENOENT')throw e;}
const completed=new Set(previous.map(r=>r.jobId)),jobs=[];
for(let repetition=0;repetition<protocol.repetitions;repetition++)for(let i=0;i<cases.length;i++)for(let j=0;j<protocol.methods.length;j++){
 const method=protocol.methods[(j+i+repetition)%protocol.methods.length],item=cases[i],jobId=`${item.id}/${method}/${repetition}`;
 if(!completed.has(jobId))jobs.push({item,method,repetition,jobId});
}
await writeFile(new URL('manifest.json',dir),JSON.stringify({protocol,startedAt:new Date().toISOString(),previous:previous.length,pending:jobs.length},null,2));
let index=0,done=previous.length,stop=false;
try{
 await Promise.all(Array.from({length:protocol.concurrency},async()=>{
  while(index<jobs.length&&!stop){
   const {item,method,repetition,jobId}=jobs[index++];
   const run=createRun(item,{method:['no_acquisition','placement_full'].includes(method)?'joint':method,model:protocol.model});run.method=method;
   await executeAdaptiveRun(run,item,transport);
   const score={...scoreValidation(run,labels[item.id]),jobId,repetition,factRequestCount:run.factRequests.length,requestedFields:run.factRequests.flatMap(r=>r.fields)};
   const modelReceipts=run.receipts.filter(r=>r.recipient==='cloud-model');
   const final=modelReceipts.at(-1);
   if(final){const f=JSON.parse(JSON.parse(final.rawBody).messages[1].content).facts;score.finalMissingFacts=labels[item.id].analysisNecessary.filter(k=>!(k in f)).length;}else score.finalMissingFacts=null;
   await writeFile(new URL(`${run.id}.json`,dir),JSON.stringify(run));await appendFile(new URL('scores.jsonl',dir),JSON.stringify(score)+'\n');done++;
   if(pilot||done%16===0||done===protocol.jobs)console.log(JSON.stringify({done,total:protocol.jobs,caseId:item.id,method,success:score.structuredSuccess,acquisitions:score.factRequestCount,error:score.error}));
   if(/MODEL_HTTP_(401|402|403)|Arrearage|Insufficient Balance/.test(run.error||''))stop=true;
  }
 }));
 await verify();await writeFile(new URL(done===protocol.jobs?'complete.json':'interrupted.json',dir),JSON.stringify({done,total:protocol.jobs,finishedAt:new Date().toISOString(),reason:stop?'provider error':null},null,2));
 if(done!==protocol.jobs)process.exitCode=2;
}finally{transport.close();await proxy.close();}
