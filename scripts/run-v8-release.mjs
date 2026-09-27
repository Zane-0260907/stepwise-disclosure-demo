// User-facing collector wrapper. Frozen run-v8.mjs remains unchanged.
import {readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {claimExperimentDirectory} from '../src/research/experiment-directory.mjs';
const root=new URL('../',import.meta.url),protocol=JSON.parse(await readFile(new URL('evidence/validation-v8/protocol.json',root)));
const id=process.argv.find(x=>x.startsWith('--run-id='))?.slice(9);
if(!id||!/^[a-z0-9-]+$/i.test(id))throw Error('Supply a new --run-id=my-v8-run; published IDs are reserved.');
const lease=await claimExperimentDirectory(new URL('data/research/validation/',root),id,protocol);
try{
 if(!lease.previous)await writeFile(new URL('manifest.json',lease.directory),JSON.stringify({protocol,createdAt:new Date().toISOString()},null,2)+'\n');
 const child=spawn(process.execPath,[fileURLToPath(new URL('scripts/run-v8.mjs',root)),`--run-id=${id}`],{cwd:fileURLToPath(root),stdio:'inherit',windowsHide:true});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});process.exitCode=code??1;
}finally{await lease.release();}
