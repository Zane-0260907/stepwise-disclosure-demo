import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve,basename,join} from 'node:path';
import {GAP_METHODS,GAP_SYSTEM,GAP_TOOLS,runGapAgent,digest} from '../src/research/evidence-gap.mjs';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return [x.slice(2,i),x.slice(i+1)];}));
const name=args['run-id'];if(!/^gap-[a-z0-9-]+$/.test(name||''))throw Error('Use a new --run-id=gap-...');
const input=await readFile('data/research/gap-inputs/inputs.json','utf8'),all=JSON.parse(input);
const count=Number(args.count||4);if(!Number.isInteger(count)||count<1||count>24)throw Error('INVALID_CASE_COUNT');
const selected=all.slice(0,count),methods=args.methods?args.methods.split(','):GAP_METHODS;
if(!methods.length||new Set(methods).size!==methods.length||methods.some(m=>!GAP_METHODS.includes(m)))throw Error('INVALID_METHODS');
const connectionPath=args.connection||'data/research/v8-session/connection.json';
let connection;try{connection=JSON.parse(await readFile(connectionPath,'utf8'));}catch{throw Error('LOCAL_PROXY_NOT_CONFIGURED: run scripts/start-native-proxy.mjs in another terminal');}
const endpoint=new URL(connection.url);
if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||!connection.token)throw Error('ONLY_LOOPBACK_PROXY_SUPPORTED');
// Check transport readiness without a paid request or printing bearer tokens.
try{await fetch(connection.url,{method:'OPTIONS',signal:AbortSignal.timeout(3000)});}catch{throw Error('LOCAL_PROXY_UNAVAILABLE: start scripts/start-native-proxy.mjs; no model request made');}
const out=resolve('data/research/gap-runs',name);await mkdir(out,{recursive:true});
const lock=await open(join(out,'RUNNING.lock'),'wx');
try{
  const sources=['src/research/evidence-gap.mjs','scripts/prepare-gap-pilot.py','scripts/run-gap-pilot.mjs','scripts/score-gap-pilot.py','scripts/verify-gap-pilot.mjs','docs/evidence-gap-pilot.zh-CN.md'];
  const hashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,digest(await readFile(p))])));
  const maxCalls=8,maxOutputTokens=1400,maxBatchCalls=count*methods.length*maxCalls;
  const maxBatchTokens=Number(args['max-tokens']||250000);
  if(!Number.isSafeInteger(maxBatchTokens)||maxBatchTokens<1000)throw Error('INVALID_TOKEN_CAP');
  const protocol={scope:'development only; actual model run required',runId:name,caseIds:selected.map(x=>x.id),methods,
    model:'deepseek-flash',temperature:0,maxCalls,maxOutputTokens,maxBatchCalls,maxBatchTokens,
    sourceBudget:12000,inputSha256:digest(input),sourceHashes:hashes,system:GAP_SYSTEM,tools:GAP_TOOLS,
    note:'No reference labels are read by this runner or sent to the model. A token cap reserves a conservative estimate before each request; measured tokens and transport failures are retained.'};
  await writeFile(join(out,'protocol.json'),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
  await mkdir(join(out,'frozen'));
  for(const p of sources)await writeFile(join(out,'frozen',basename(p)),await readFile(p));
  await writeFile(join(out,'frozen','inputs.json'),input);
  // Only the scorer reads evaluation-only.json. Its hash binds later scoring.
  const manifest=JSON.parse(await readFile('data/research/gap-inputs/manifest.json','utf8'));
  await writeFile(join(out,'input-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  let calls=0,tokens=0,stopped=null;const records=[];
  for(let index=0;index<selected.length&&!stopped;index++){
    // Rotate order so one method is not always last in time. Do not retry a
    // failed case under the same identity or overwrite it after an inspection.
    const order=methods.map((_,j)=>methods[(j+index)%methods.length]);
    for(const method of order){
      const item=selected[index],file=join(out,item.id+'--'+method+'.json');
      const record=await runGapAgent(item,method,connection,{
        maxCalls,maxTokens:maxOutputTokens,sourceBudget:protocol.sourceBudget,
        beforeCall:({requestBytes,maxOutputTokens})=>{
          // Reserve using the entire UTF-8 request size, including repeated
          // history, then check actual reported usage. This is a conservative
          // request gate, not a provider-enforced monetary billing limit.
          if(calls>=maxBatchCalls||tokens+requestBytes+maxOutputTokens+2048>maxBatchTokens)throw Error('BATCH_BUDGET');
          calls++;
        },
        afterCall:call=>{tokens+=call.usage?.total_tokens||0;},
        checkpoint:r=>writeFile(file,JSON.stringify(r,null,2)+'\n')});
      records.push({caseId:item.id,method,status:record.status,error:record.error||null,metrics:record.metrics});
      console.log(JSON.stringify({caseId:item.id,method,status:record.status,error:record.error||null,
        calls:record.metrics.modelCalls,tokens:record.metrics.tokens,sourceCharacters:record.metrics.uniqueSourceCharacters,batchTokens:tokens}));
      if(record.error==='BATCH_BUDGET'||record.error?.startsWith('MODEL_HTTP_')||record.error==='MODEL_TRANSPORT_FAILED')stopped=record.error;
      await writeFile(join(out,'manifest.json'),JSON.stringify({calls,tokens,stopped,records,
        unstartedAttempts:selected.length*methods.length-records.length,updatedAt:new Date().toISOString()},null,2)+'\n');
      if(stopped)break;
    }
  }
}finally{await lock.close();await unlink(join(out,'RUNNING.lock'));}
