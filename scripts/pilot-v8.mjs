import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {acquireModelGraph,executeModelGraph,createNumericReceiver,METHODS,CONDITIONS} from '../src/research/model-repair-v8.mjs';
import {startDeepSeekProxy} from '../src/research/deepseek-live.mjs';
const root=new URL('../',import.meta.url),dir=new URL('data/research/v8-pilot/',root);
await mkdir(dir,{recursive:true});
const load=async p=>JSON.parse(await readFile(new URL(p,root)));let proxy,connection;
if(process.argv.includes('--session'))connection=await load('data/research/v8-session/connection.json');
else{const key=process.env.DEEPSEEK_API_KEY;delete process.env.DEEPSEEK_API_KEY;proxy=await startDeepSeekProxy({key,recordDirectory:new URL('provider-egress/',dir)});connection={url:proxy.url,token:proxy.internalToken};}
const cases=await load('fixtures/model-repair-v8/development.json'),receiver=await createNumericReceiver();
try{for(const item of cases){
 const file=new URL(item.id+'.model.json',dir);let model;
 try{model=JSON.parse(await readFile(file));}catch(e){if(e.code!=='ENOENT')throw e;model=await acquireModelGraph(item,'pilot-v8-'+item.id,connection);await writeFile(file,JSON.stringify(model,null,2));}
 console.log(JSON.stringify({case:item.id,status:model.status,error:model.error,program:model.program}));
 const outputs=[];for(const condition of CONDITIONS)for(const method of METHODS)outputs.push(await executeModelGraph(item,model,condition,method,receiver));
 await writeFile(new URL(item.id+'.arms.json',dir),JSON.stringify(outputs,null,2));
 console.log(JSON.stringify({arms:outputs.length,failures:outputs.filter(x=>x.status!=='completed').map(x=>x.error)}));
}}finally{await receiver.close();await proxy?.close();}
