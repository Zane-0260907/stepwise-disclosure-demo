import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadCases, METHODS } from '../src/research/catalog.mjs';
import { evaluateRun } from '../src/research/evaluate.mjs';
const argv=process.argv.slice(2);const option=(key,fallback)=>{const i=argv.indexOf(key);return i<0?fallback:argv[i+1];};
const batch=argv.includes('--batch'),pilot=argv.includes('--pilot');
const base=option('--base','http://127.0.0.1:4793');
const serverHealth=await(await fetch(`${base}/api/health`)).json();
const concurrency=Number(option('--concurrency',batch?'4':'2'));
const repeats=Number(option('--repeats',batch?'3':'1'));
const selected=option('--case',null);const methods=argv.includes('--all-methods')||batch?METHODS:[option('--method','joint')];
const cases=(await loadCases()).filter(c=>selected?c.id===selected:c.split===(pilot?'development':'evaluation'));
if(!cases.length)throw new Error('No cases selected');
const id=option('--id',`${batch?'batch':pilot?'pilot':'trial'}-${new Date().toISOString().replace(/[:.]/g,'-')}`);
if(!/^[a-zA-Z0-9_.-]+$/.test(id))throw new Error('Invalid batch ID');
const dir=new URL(`../data/research/experiments/${id}/`,import.meta.url);await mkdir(dir,{recursive:true});
try{await readFile(new URL('manifest.json',dir));throw new Error('EXPERIMENT_EXISTS: Use a new --id to avoid mixing results.');}catch(error){if(error.code!=='ENOENT')throw error;}
let protocol=null;
if(batch){protocol=JSON.parse(await readFile(new URL('../evidence/research/frozen-protocol.json',import.meta.url),'utf8'));await verifyFrozen();}
async function verifyFrozen(){if(serverHealth.liveModel&&serverHealth.liveModel!==protocol.model)throw new Error(`FROZEN_MODEL_MISMATCH: protocol uses ${protocol.model}; server uses ${serverHealth.liveModel}. Create a new protocol and experiment ID.`);if((process.env.RESEARCH_MODEL||protocol.model)!==protocol.model)throw new Error(`FROZEN_MODEL_MISMATCH: runner uses ${process.env.RESEARCH_MODEL}.`);for(const[file,expected]of Object.entries(protocol.hashes)){const actual=createHash('sha256').update(await readFile(new URL(`../${file}`,import.meta.url))).digest('hex');if(actual!==expected)throw new Error(`FROZEN_SOURCE_CHANGED: ${file}`);}}
const jobs=[];
for(let repetition=0;repetition<repeats;repetition++)for(let i=0;i<cases.length;i++)for(let j=0;j<methods.length;j++)jobs.push({caseId:cases[i].id,method:methods[(i+j+repetition)%methods.length],repetition});
const raw=await readFile(new URL('../fixtures/research/cases.json',import.meta.url));
const manifest={id,startedAt:new Date().toISOString(),jobs:jobs.length,concurrency,repeats,methods,caseIds:cases.map(c=>c.id),caseSha256:createHash('sha256').update(raw).digest('hex'),model:serverHealth.liveModel||process.env.RESEARCH_MODEL||'qwen-plus',source:'live',protocol,evaluation:'Structured checks only; prose quality requires separate review.'};
await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));
let index=0,completed=0;const scores=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function execute(job){
  const created=await fetch(`${base}/api/research/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...job,captureFrames:!batch})});
  const result=await created.json();if(!created.ok)throw new Error(result.error||'Create failed');
  for(let i=0;i<420;i++){
    const run=await(await fetch(`${base}/api/research/runs/${result.id}`)).json();
    if(run.status!=='running')return {run,score:{...await evaluateRun(run),repetition:job.repetition}};
    await sleep(1000);
  }
  throw new Error(`Run timeout ${result.id}`);
}
await Promise.all(Array.from({length:concurrency},async()=>{
  while(index<jobs.length){const job=jobs[index++];let score;
    try{const output=await execute(job);score=output.score;await writeFile(new URL(`${output.run.id}.json`,dir),JSON.stringify(output.run));}
    catch(error){score={...job,status:'runner_error',structuredTaskSuccess:false,error:error.message};}
    scores.push(score);await appendFile(new URL('scores.jsonl',dir),JSON.stringify(score)+'\n');completed++;
    await writeFile(new URL('progress.json',dir),JSON.stringify({completed,total:jobs.length,success:scores.filter(s=>s.structuredTaskSuccess).length,failed:scores.filter(s=>s.status!=='completed').length,last:score},null,2));
    console.log(JSON.stringify({completed,total:jobs.length,caseId:job.caseId,method:job.method,status:score.status,success:score.structuredTaskSuccess,error:score.error}));
  }
}));
if(protocol)await verifyFrozen();
await writeFile(new URL('complete.json',dir),JSON.stringify({completed:jobs.length,finishedAt:new Date().toISOString(),id},null,2));
console.log(JSON.stringify({experiment:id,runs:completed,structuredSuccess:scores.filter(s=>s.structuredTaskSuccess).length,output:dir.pathname}));
