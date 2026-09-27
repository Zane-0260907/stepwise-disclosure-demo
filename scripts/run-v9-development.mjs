import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runViewAgent,METHODS,SYSTEM} from '../src/research/view-agent-v9.mjs';
import {hash,VIEW_TOOLS} from '../src/research/view-runtime-v9.mjs';
const opt=Object.fromEntries(process.argv.slice(2).filter(a=>a.includes('=')).map(a=>a.replace(/^--/,'').split('=')));
const name=opt['run-id'];if(!/^dev-v9-[a-z0-9-]+$/.test(name||''))throw Error('Use a new --run-id=dev-v9-...');
const base=resolve('data/research/v9-development-inputs'),out=resolve('data/research/v9-runs',name);await mkdir(out,{recursive:true});
const cases=JSON.parse(await readFile(resolve(base,'cases.json'),'utf8'));
const connection=JSON.parse(await readFile(opt.connection||'data/research/v8-session/connection.json','utf8'));
const chosen=opt.cases?cases.filter(c=>opt.cases.split(',').includes(c.id)):cases;
const methods=opt.methods?opt.methods.split(','):METHODS;
if(methods.some(x=>!METHODS.includes(x)))throw Error('UNKNOWN_METHOD');
const sources=['src/research/view-runtime-v9.mjs','src/research/view-agent-v9.mjs','scripts/prepare-v9-development.py','scripts/run-v9-development.mjs'];
const code=Object.fromEntries(await Promise.all(sources.map(async f=>[f,hash(await readFile(f,'utf8'))])));
const protocol={kind:'development only; not held-out evaluation',runId:name,caseIds:chosen.map(c=>c.id),methods,maxModelCalls:chosen.length*methods.length*10,maxTokens:2000000,maxCallsPerRun:10,caseSha256:hash(await readFile(resolve(base,'cases.json'),'utf8')),sourceHashes:code,system:SYSTEM,tools:VIEW_TOOLS};
let old;try{old=JSON.parse(await readFile(resolve(out,'protocol.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(old&&JSON.stringify(old)!==JSON.stringify(protocol))throw Error('PROTOCOL_CHANGED_USE_NEW_RUN_ID');
if(!old)await writeFile(resolve(out,'protocol.json'),JSON.stringify(protocol,null,2));
if(!old){const frozen=resolve(out,'frozen');await mkdir(frozen,{recursive:true});for(const f of sources)await writeFile(resolve(frozen,f.split('/').at(-1)),await readFile(f));await writeFile(resolve(frozen,'cases.json'),await readFile(resolve(base,'cases.json')));await writeFile(resolve(frozen,'labels.json'),await readFile(resolve(base,'labels.json')));}
let calls=0,tokens=0,finished=0;const pending=[];
for(const c of chosen)for(const method of methods){const path=resolve(out,c.id+'--'+method+'.json');try{const r=JSON.parse(await readFile(path,'utf8'));calls+=r.calls.length;tokens+=r.metrics.totalTokens;finished++;}catch(e){if(e.code!=='ENOENT')throw e;pending.push({c,method,path});}}
let next=0;
async function worker(){while(next<pending.length){const {c,method,path}=pending[next++];const record=await runViewAgent(c,method,connection,{id:name+'-'+c.id+'-'+method,beforeCall:()=>{if(calls>=protocol.maxModelCalls||tokens>=protocol.maxTokens)throw Error('BATCH_BUDGET');calls++;},afterCall:call=>{tokens+=call.usage?.total_tokens||0;}});await writeFile(path,JSON.stringify(record,null,2));finished++;console.log(JSON.stringify({finished,total:chosen.length*methods.length,case:c.id,method,status:record.status,error:record.error,calls:record.calls.length,sourceCells:record.metrics.sourceCells,tokens:record.metrics.totalTokens,batchCalls:calls,batchTokens:tokens}));}}
await Promise.all(Array.from({length:3},worker));
await writeFile(resolve(out,'manifest.json'),JSON.stringify({protocolHash:hash(protocol),finished,calls,tokens,finishedAt:new Date().toISOString()},null,2));
