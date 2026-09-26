import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { getCase } from '../src/research/catalog.mjs';
import { createRun } from '../src/research/engine.mjs';
import { executeAdaptiveRun,validateFactRequest } from '../src/research/adaptive-execution.mjs';
function fixture(requestFields=['late_days']){
 return {testing:true,async send(run,step,payload,recipient){
  const rawBody=JSON.stringify(payload),facts=JSON.parse(payload.messages[1].content).facts;
  const message=facts.late_days===undefined?{tool_calls:[{id:'fact-call',type:'function',function:{name:'request_task_facts',arguments:JSON.stringify({fields:requestFields,reason:'Need the delay to calculate the charge.'})}}]}:
   {content:JSON.stringify({issueCodes:['PENALTY_APPLIES'],amount:facts.late_days*175,summary:'Use the supplied day count and daily rate.',recommendation:'Check the recorded delivery date.',evidenceIds:['clause','late_days'],citations:[]})};
  return {status:200,response:{id:'deterministic-facts-fixture',choices:[{message}]},receipt:{id:randomUUID(),runId:run.id,stepId:step.id,recipient,rawBody,bytes:Buffer.byteLength(rawBody),sha256:createHash('sha256').update(rawBody).digest('hex')}};
 }};
}
test('a missing input is requested, authorized locally, then sent on a new checked step',async()=>{
 const item=await getCase('contract-03');item.facts.clause='每晚交一天，支付175元。';item.facts.late_days=4;
 const run=createRun(item,{model:'fixture'});await executeAdaptiveRun(run,item,fixture());
 assert.equal(run.status,'completed',run.error);assert.equal(run.result.amount,700);assert.equal(run.receipts.length,2);
 assert.equal(JSON.parse(JSON.parse(run.receipts[0].rawBody).messages[1].content).facts.late_days,undefined);
 assert.equal(JSON.parse(JSON.parse(run.receipts[1].rawBody).messages[1].content).facts.late_days,4);
 assert.ok(run.steps.find(s=>s.operation==='supply_facts'&&s.introducedAtRuntime));
 assert.ok(run.steps.filter(s=>s.requestPlan).every(s=>s.requestPlan.receiptVerified));
});
test('model-generated fact request cannot authorize identity disclosure',async()=>{
 const item=await getCase('contract-03');item.facts.clause='每晚交一天，支付175元。';
 const run=createRun(item,{model:'fixture'});await executeAdaptiveRun(run,item,fixture(['identity']));
 assert.equal(run.status,'blocked');assert.equal(run.receipts.length,1);
 assert.ok(!run.receipts[0].rawBody.includes(item.facts.identity));
});
test('additional facts still require current policy at the next send',async()=>{
 const item=await getCase('contract-03');item.facts.clause='每晚交一天，支付175元。';
 const run=createRun(item,{model:'fixture'});await executeAdaptiveRun(run,item,fixture(),{hook:async(stage,{run})=>{if(run.factRequests.length)run.policy={allowed:false,version:2};}});
 assert.equal(run.status,'blocked');assert.equal(run.receipts.length,1);
});
test('unknown, duplicate, missing and already disclosed fields are refused',async()=>{
 const item=await getCase('contract-03');
 for(const fields of [['identity'],['late_days','late_days'],['scores'],['amount']])assert.throws(()=>validateFactRequest({fields,reason:'test'},item,{amount:10}),/UNAUTHORIZED/);
});
