import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRepairReceiver,executeRepair} from '../src/research/repair-execution.mjs';
import {freshctxBridge} from '../src/research/freshctx-bridge.mjs';
const root=new URL('../',import.meta.url),protocol=JSON.parse(await readFile(new URL('evidence/validation-v7/protocol.json',root)));
for(const [path,hash]of Object.entries(protocol.hashes))if(createHash('sha256').update(await readFile(new URL(path,root))).digest('hex')!==hash)throw Error('FROZEN_SOURCE_CHANGED:'+path);
const name=process.argv.find(x=>x.startsWith('--run-id='))?.split('=')[1]||'frozen-v7-20260927';if(!/^[a-z0-9-]+$/i.test(name))throw Error('INVALID_RUN_ID');
const dir=new URL(`data/research/validation/${name}/`,root);await mkdir(dir,{recursive:true});
const cases=JSON.parse(await readFile(new URL('fixtures/repair-v7/cases.json',root))),receiver=await createRepairReceiver(),bridge=freshctxBridge();let count=0;
try{for(const [index,item]of cases.entries()){
 const methods=protocol.methods.map((_,j)=>protocol.methods[(index+j)%protocol.methods.length]);
 for(const method of methods){const output=new URL(`${item.id}.${method}.json`,dir);try{await readFile(output);count++;continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  const run=await executeRepair(item,method,receiver,{externalGuard:bridge.check});if(run.error)throw Error(item.id+':'+run.error);
  await writeFile(output,JSON.stringify(run)+'\n');count++;
 }
 if((index+1)%24===0)console.log(JSON.stringify({cases:index+1,executions:count}));
}}finally{await receiver.close();await bridge.close();}
await writeFile(new URL('run.json',dir),JSON.stringify({protocol:protocol.id,protocolSha256:createHash('sha256').update(await readFile(new URL('evidence/validation-v7/protocol.json',root))).digest('hex'),executions:count,completedAt:new Date().toISOString()},null,2));
