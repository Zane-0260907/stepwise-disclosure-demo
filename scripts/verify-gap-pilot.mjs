import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const hash=b=>createHash('sha256').update(b).digest('hex');
const name=process.argv.find(x=>x.startsWith('--run-id='))?.slice(9);
if(!/^gap-[a-z0-9-]+$/.test(name||''))throw Error('Use --run-id=gap-...');
const root=resolve('data/research/gap-runs',name),load=async p=>JSON.parse(await readFile(p,'utf8'));
const protocol=await load(join(root,'protocol.json'));
for(const [file,expected] of Object.entries(protocol.sourceHashes))assert.equal(hash(await readFile(join(root,'frozen',file.split('/').at(-1)))),expected,'Frozen source changed: '+file);
assert.equal(hash(await readFile(join(root,'frozen','inputs.json'))),protocol.inputSha256);
const {runGapAgent}=await import(pathToFileURL(join(root,'frozen','evidence-gap.mjs')));
const inputs=new Map((await load(join(root,'frozen','inputs.json'))).map(c=>[c.id,c]));
let egressDirectory=join(root,'provider-egress');
try{await readdir(egressDirectory);}catch(e){if(e.code!=='ENOENT')throw e;egressDirectory=resolve('data/research/v8-session/provider-egress');}
const transport=[];
for(const f of await readdir(egressDirectory))if(f.endsWith('.json'))transport.push(await load(join(egressDirectory,f)));
const used=new Set(),verified=[];
for(const cid of protocol.caseIds)for(const method of protocol.methods){
  let saved;try{saved=await load(join(root,`${cid}--${method}.json`));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(saved.status==='not_started')continue;
  let position=0,verificationError=null;
  const replay=await runGapAgent(inputs.get(cid),method,{url:'http://127.0.0.1/verification',token:'not-a-live-token'},{
    maxCalls:protocol.maxCalls,maxTokens:protocol.maxOutputTokens,sourceBudget:protocol.sourceBudget,
    beforeCall:()=>{if(position===saved.calls.length&&saved.error==='BATCH_BUDGET')throw Error('BATCH_BUDGET');},
    request:async(_,options)=>{
      const c=saved.calls[position++];
      try{
        assert.ok(c,'Unexpected additional request');
        assert.equal(options.body,c.requestBody,'Runtime produced different request');
        assert.equal(hash(c.requestBody),c.requestSha256);
        if(!c.transportError){
          assert.equal(hash(c.responseBody),c.responseSha256);
          const match=transport.find(t=>!used.has(t.id)&&t.receiverBodySha256===c.requestSha256&&t.responseSha256===c.responseSha256&&t.responseStatus===c.status);
          assert.ok(match,'No unused provider transport record matches this request AND response');used.add(match.id);
          assert.equal(hash(match.providerBody),match.providerBodySha256);
          const expected=JSON.parse(c.requestBody);expected.thinking={type:'disabled'};
          assert.deepEqual(JSON.parse(match.providerBody),expected);
        }
      }catch(e){verificationError=e;throw e;}
      if(c.transportError)throw Object.assign(new Error('saved transport failure'),{name:c.transportError});
      return new Response(c.responseBody,{status:c.status,headers:{'content-type':'application/json'}});
    }
  });
  if(verificationError)throw verificationError;
  assert.equal(position,saved.calls.length);assert.equal(replay.status,saved.status);
  assert.equal(replay.error,saved.error);
  assert.deepEqual(replay.actions,saved.actions);assert.deepEqual(replay.result,saved.result);assert.deepEqual(replay.events,saved.events);
  for(const key of Object.keys(saved.metrics).filter(k=>k!=='modelElapsedMs'))assert.equal(replay.metrics[key],saved.metrics[key],key);
  verified.push({caseId:cid,method,calls:position,sourceCharacters:saved.metrics.uniqueSourceCharacters});
}
const result={scope:'offline verification of saved model responses; zero new provider requests',verifiedAttempts:verified.length,
  matchedProviderRecords:used.size,modelCallsMadeByVerifier:0,verified};
if(process.argv.includes('--check'))assert.deepEqual(await load(join(root,'verification.json')),result);
else await writeFile(join(root,'verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
