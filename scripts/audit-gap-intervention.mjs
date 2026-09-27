import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const name=process.argv.find(x=>x.startsWith('--run-id='))?.slice(9);
if(!/^gap-[a-z0-9-]+$/.test(name||''))throw Error('Use --run-id=gap-...');
const root=resolve('data/research/gap-runs',name),load=async p=>JSON.parse(await readFile(p,'utf8'));
const protocol=await load(join(root,'protocol.json'));
const sha=x=>createHash('sha256').update(x).digest('hex');
assert.equal(sha(await readFile(join(root,'frozen','evidence-gap.mjs'))),protocol.sourceHashes['src/research/evidence-gap.mjs']);
const {runGapAgent}=await import(pathToFileURL(join(root,'frozen','evidence-gap.mjs')));
const inputs=new Map((await load(join(root,'frozen','inputs.json'))).map(x=>[x.id,x]));
const rows=[];
for(const cid of protocol.caseIds)for(const from of ['on_demand','gap_repair']){
  let saved;try{saved=await load(join(root,`${cid}--${from}.json`));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(saved.status!=='completed')continue;
  const to=from==='on_demand'?'gap_repair':'on_demand';
  let position=0,divergence=null;
  const counter=await runGapAgent(inputs.get(cid),to,{url:'http://127.0.0.1/offline-only',token:'none'},{
    maxCalls:protocol.maxCalls,maxTokens:protocol.maxOutputTokens,sourceBudget:protocol.sourceBudget,
    request:async(_,opts)=>{
      const expected=saved.calls[position];
      if(!expected||opts.body!==expected.requestBody){
        divergence={turn:position,reason:expected?'request_changed':'additional_request',
          originalRequestSha256:expected?.requestSha256||null,counterfactualRequestSha256:sha(opts.body)};
        // Do not feed the old response to a changed observation. The offline
        // intervention stops here; a fresh model continuation would be needed.
        throw Error('STOP_BEFORE_DIFFERENT_MODEL_OBSERVATION');
      }
      position++;return new Response(expected.responseBody,{status:expected.status,headers:{'content-type':'application/json'}});
    }});
  const identicalTerminal=JSON.stringify(counter.result)===JSON.stringify(saved.result)&&counter.status===saved.status;
  rows.push({caseId:cid,from,to,replayedIdenticalRequests:position,
    originalAutomaticRepairs:saved.metrics.automaticRepairs,
    interventionChangedObservedExecution:Boolean(divergence)||!identicalTerminal,
    divergence,identicalTerminal:divergence?null:identicalTerminal,
    originalSourceCharacters:saved.metrics.uniqueSourceCharacters,
    counterfactualSourceCharactersBeforeStop:counter.metrics.uniqueSourceCharacters});
}
const report={kind:'post-hoc same-prefix controller intervention; not new model trials',runId:name,
  independentSourceTasks:new Set(rows.map(r=>r.caseId)).size,trajectories:rows.length,
  changedTrajectories:rows.filter(r=>r.interventionChangedObservedExecution).length,
  newModelCalls:0,rows,
  limits:'Identical executions demonstrate no effect on these observed trajectories only. Divergent trajectories stop before reusing an invalid downstream model response. This is not a population effect or privacy proof.'};
if(process.argv.includes('--check'))assert.deepEqual(await load(join(root,'intervention.json')),report);
else await writeFile(join(root,'intervention.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
