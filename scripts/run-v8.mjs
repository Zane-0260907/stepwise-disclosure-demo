import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {acquireModelGraph,executeModelGraph,createNumericReceiver} from '../src/research/model-repair-v8.mjs';
import {startDeepSeekProxy} from '../src/research/deepseek-live.mjs';
import {hash} from '../src/research/local-program.mjs';
const root=new URL('../',import.meta.url),load=async p=>JSON.parse(await readFile(new URL(p,root)));
const protocol=await load('evidence/validation-v8/protocol.json');
for(const [p,h]of Object.entries(protocol.hashes))if(hash(await readFile(new URL(p,root),'utf8'))!==h)throw Error('FROZEN_SOURCE_CHANGED:'+p);
const name=process.argv.find(a=>a.startsWith('--run-id='))?.slice(9)||'frozen-v8-20260927';if(!/^[a-z0-9-]+$/i.test(name))throw Error('INVALID_RUN_ID');
const dir=new URL(`data/research/validation/${name}/`,root);await mkdir(dir,{recursive:true});
const manifest={protocol:protocol.id,protocolSha256:hash(JSON.stringify(protocol))};
try{const prior=JSON.parse(await readFile(new URL('run.json',dir)));if(prior.protocolSha256!==manifest.protocolSha256)throw Error('RESUME_PROTOCOL_MISMATCH');}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(new URL('run.json',dir),JSON.stringify(manifest,null,2));}
const providerDir=process.argv.includes('--session')?new URL('data/research/v8-session/provider-egress/',root):new URL('provider-egress/',dir);
let proxy,connection;
if(process.argv.includes('--session'))connection=await load('data/research/v8-session/connection.json');
else{const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw Error('Set DEEPSEEK_API_KEY for new paid calls, or use the public frozen archive for offline verification.');proxy=await startDeepSeekProxy({key,recordDirectory:providerDir});connection={url:proxy.url,token:proxy.internalToken};}
const receiver=await createNumericReceiver(),cases=await load('fixtures/model-repair-v8/cases.json');let completed=0;
try{for(const [ci,item]of cases.entries())for(let repeat=0;repeat<protocol.repeats;repeat++){
 const id=`${name}-${item.id}-${repeat}`,modelPath=new URL(id+'.model.json',dir);let model;
 try{model=JSON.parse(await readFile(modelPath));}catch(e){if(e.code!=='ENOENT')throw e;
  model=await acquireModelGraph(item,id,connection);
  const candidates=await Promise.all((await readdir(providerDir)).filter(f=>f.endsWith('.json')).map(async f=>JSON.parse(await readFile(new URL(f,providerDir)))));
  model.providerRecords=model.calls.map(c=>candidates.find(r=>r.receiverBodySha256===c.requestSha256&&r.responseSha256===c.responseSha256)).filter(Boolean);
  await writeFile(modelPath,JSON.stringify(model,null,2)+'\n');
 }
 const methods=protocol.methods.map((_,j)=>protocol.methods[(ci+repeat+j)%protocol.methods.length]);
 for(const condition of protocol.conditions)for(const method of methods){
  const file=new URL(`${id}.${condition}.${method}.json`,dir);try{await readFile(file);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  const output=await executeModelGraph(item,model,condition,method,receiver);await writeFile(file,JSON.stringify(output,null,2)+'\n');
 }
 completed++;console.log(JSON.stringify({graphs:completed,total:cases.length*protocol.repeats,case:item.id,modelStatus:model.status,nodes:model.program?.length,error:model.error}));
}}finally{await receiver.close();await proxy?.close();}
await writeFile(new URL('run.json',dir),JSON.stringify({...manifest,graphs:completed,arms:completed*protocol.conditions.length*protocol.methods.length,completedAt:new Date().toISOString()},null,2)+'\n');
