import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {runNativeTask,NATIVE_SYSTEM} from '../src/research/native-agent-v10.mjs';
const options=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const name=options['run-id'];if(!/^dev-v10-[a-z0-9-]+$/.test(name||''))throw Error('Use --run-id=dev-v10-...');
const viewMode=options.view||'full';if(!['full','masked','tokenized','scoped'].includes(viewMode))throw Error('INVALID_VIEW_MODE');
const localConfirmation=options.confirm==='local';
const root=resolve('data/research/v10-runs',name);await mkdir(root,{recursive:true});
const lock=await open(resolve(root,'RUNNING.lock'),'wx');
try{
 const inputs=resolve('data/research/v10-inputs');const all=JSON.parse(await readFile(resolve(inputs,'cases.json'),'utf8'));
 const cases=options.cases?all.filter(c=>options.cases.split(',').includes(c.id)):all;
 if(!cases.length)throw Error('EMPTY_CASE_SELECTION');
 const connection=JSON.parse(await readFile(options.connection||'data/research/v8-session/connection.json','utf8'));
 const userGuidelines=await readFile(resolve(inputs,'user-simulation-guidelines.md'),'utf8');
 const sources=['src/research/native-agent-v10.mjs','src/research/native-tau-v10.mjs','src/research/bound-views-v10.mjs','src/research/local-confirmation-v10.mjs','scripts/native_tau_bridge.py','scripts/run-native-v10.mjs','scripts/prepare-v10-tasks.py'];
 const sha=b=>createHash('sha256').update(b).digest('hex');
 const hashes=Object.fromEntries(await Promise.all(sources.map(async s=>[s,sha(await readFile(s))])));
 const protocol={kind:'development-native-task-probe',runId:name,caseIds:cases.map(c=>c.id),model:'deepseek-flash',method:'native-'+viewMode,maxAgentCalls:40,maxUserCalls:20,maxBatchCalls:cases.length*60,maxBatchTokens:3000000,sourceHashes:hashes,inputHash:sha(await readFile(resolve(inputs,'cases.json'))),agentSystem:NATIVE_SYSTEM,userGuidelines,
  localConfirmation,scope:'Original domain tools/policies/tasks with a custom text conversation runner and DeepSeek user simulator. Database-state agreement will be independently scored; this is not the full official benchmark reward. User-simulator calls, including raw local confirmation details, are evaluation infrastructure and must be reported separately. This test setup does not establish privacy from the provider operating the simulator.'};
 await writeFile(resolve(root,'protocol.json'),JSON.stringify(protocol,null,2),{flag:'wx'});
 const frozen=resolve(root,'frozen');await mkdir(frozen);for(const file of sources)await writeFile(resolve(frozen,file.split('/').at(-1)),await readFile(file));for(const f of ['cases.json','labels.json','manifest.json','user-simulation-guidelines.md'])await writeFile(resolve(frozen,f),await readFile(resolve(inputs,f)));
 let calls=0,tokens=0;
 for(const item of cases){
  const r=await runNativeTask(item,connection,{userGuidelines,viewMode,localConfirmation,recordCall:({phase,call})=>{if(phase==='before'){if(calls>=protocol.maxBatchCalls||tokens>=protocol.maxBatchTokens)throw Error('BATCH_BUDGET');calls++;}else tokens+=call.usage?.total_tokens||0;},onEvent:event=>console.log(JSON.stringify({case:item.id,...event}))});
  await writeFile(resolve(root,item.id+'.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({case:item.id,status:r.status,error:r.error,metrics:r.metrics,batchCalls:calls,batchTokens:tokens}));
  if(r.error?.startsWith('MODEL_HTTP_')||r.error==='BATCH_BUDGET')break;
 }
 await writeFile(resolve(root,'manifest.json'),JSON.stringify({calls,tokens,finishedAt:new Date().toISOString()},null,2));
}finally{await lock.close();const {unlink}=await import('node:fs/promises');await unlink(resolve(root,'RUNNING.lock'));}
