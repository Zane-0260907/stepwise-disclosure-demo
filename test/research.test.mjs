import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getCase, loadCases } from '../src/research/catalog.mjs';
import { createRun, executeRun } from '../src/research/engine.mjs';
import { localAssessment } from '../src/research/policy.mjs';
import { evaluateRun } from '../src/research/evaluate.mjs';

const references=JSON.parse(await readFile(new URL('../fixtures/research/references.json',import.meta.url),'utf8'));
function fixtureTransport(source){
  return {testing:true,async send(run,step,body,recipient){
    const raw=JSON.stringify(body);const receipt={id:randomUUID(),runId:run.id,stepId:step.id,recipient,receivedAt:new Date().toISOString(),rawBody:raw,bytes:Buffer.byteLength(raw),sha256:createHash('sha256').update(raw).digest('hex'),testOnly:true};
    if(recipient==='reference-service')return {receipt,status:200,response:references.find(r=>r.code===body.code&&r.version===body.version)};
    const f=JSON.parse(body.messages[1].content).facts;
    const message=f.reference_code&&!f.reference_text
      ?{tool_calls:[{id:'fixture-call',type:'function',function:{name:'lookup_reference',arguments:JSON.stringify({code:f.reference_code,version:f.reference_version})}}]}
      :{content:JSON.stringify(localAssessment({...source,localCapabilities:true})||{issueCodes:['UNDEFINED_TRIGGER'],amount:null,summary:'条款未明确履约的具体义务。',recommendation:'明确义务范围。',evidenceIds:[f.reference_text?'reference_text':'clause'],citations:f.reference_citation?[f.reference_citation]:[]})};
    return {receipt,status:200,response:{id:'fixture-response',choices:[{message}],usage:{prompt_tokens:10,completion_tokens:10}}};
  }};
}
test('local supported inputs produce actual results with zero transport calls',async()=>{
  for(const item of (await loadCases()).filter(c=>c.split==='evaluation'&&c.stratum==='local')){
    const run=createRun(item);await executeRun(run,item,{send(){throw new Error('local execution contacted remote');}});
    assert.equal(run.status,'completed');assert.equal(run.receipts.length,0);assert.equal((await evaluateRun(run)).structuredTaskSuccess,true,item.id);
  }
});
test('actual model tool message creates a new step with recipient-specific inputs',async()=>{
  const item=await getCase('contract-21');const run=createRun(item);await executeRun(run,item,fixtureTransport(item));
  assert.equal(run.status,'completed',run.error);assert.equal(run.receipts.length,3);
  assert.deepEqual(JSON.parse(run.receipts[1].rawBody),{code:'C01',version:'2026.1'});
  assert.ok(run.steps.find(s=>s.operation==='lookup_reference').trigger.toolCallId);
  assert.match(run.report,/合成采购方21/);assert.equal((await evaluateRun(run)).structuredTaskSuccess,true);
  for(const receipt of run.receipts)assert.equal(receipt.rawBody.includes(item.facts.identity),false);
});
test('entry view retains returned tool results while not re-projecting per recipient',async()=>{
  const item=await getCase('contract-21');const run=createRun(item,{method:'entry'});await executeRun(run,item,fixtureTransport(item));
  assert.equal(run.status,'completed',run.error);assert.ok(JSON.parse(run.receipts[1].rawBody).context.clause);
  assert.ok((await evaluateRun(run)).unnecessaryFactTransmissions>0);
});
test('post-plan revocation blocks before receiver; disabling recheck demonstrates the distinction',async()=>{
  const item=await getCase('contract-21');
  const blocked=createRun(item,{condition:'revoke_after_plan'});await executeRun(blocked,item,fixtureTransport(item));
  assert.equal(blocked.status,'blocked');assert.equal(blocked.receipts.length,0);
  assert.ok(blocked.events.findIndex(e=>e.type==='policy.changed')>blocked.events.findIndex(e=>e.type==='view.prepared'));
  const ablated=createRun(item,{condition:'revoke_after_plan'});await executeRun(ablated,item,fixtureTransport(item),{recheck:false});
  assert.equal(ablated.status,'completed');assert.ok(ablated.receipts.length>0);
});
test('final serialized request is checked for identity injected after view construction',async()=>{
  const item=await getCase('contract-21');const run=createRun(item);
  await executeRun(run,item,fixtureTransport(item),{hook:async(stage,{payload})=>{payload.messages[1].content+=item.facts.identity;}});
  assert.equal(run.status,'blocked');assert.equal(run.receipts.length,0);
});
export {fixtureTransport};
