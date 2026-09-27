import test from 'node:test';
import assert from 'node:assert/strict';
import {createRepairReceiver,executeRepair} from '../src/research/repair-execution.mjs';
import {makeRepairCases,repairOracle} from '../src/research/repair-workloads.mjs';

test('real HTTP executions preserve outputs across every controlled change',async()=>{
 const receiver=await createRepairReceiver();
 try{for(const item of makeRepairCases({development:true,count:2})){
  const run=await executeRepair(item,'selective_frontier',receiver);assert.equal(run.evaluation.success,true,item.id+':'+run.error);
  assert.deepEqual(run.evaluation.expected,repairOracle(run.final,run.tasks));
  for(const receipt of run.receipts){const body=JSON.parse(receipt.rawBody);assert.deepEqual(body.view,run.decisions[receipt.decisionIndex].view);assert.ok(receipt.validAtDispatch);}
 }}finally{await receiver.close();}
});
test('payload-only guard misses capability and hidden derived dependencies',async()=>{
 const receiver=await createRepairReceiver();try{
  const cases=makeRepairCases({development:true,count:2});
  const capability=await executeRepair(cases.find(c=>c.mutation==='capability_lost'),'payload_only',receiver);assert.ok(capability.metrics.unauthorizedDispatches>0);
  const derived=await executeRepair(cases.find(c=>c.mutation==='base'&&!c.values.local),'payload_only',receiver);assert.equal(derived.evaluation.success,false);
 }finally{await receiver.close();}
});
test('selective repair preserves earlier valid work and monotone disclosure',async()=>{
 const receiver=await createRepairReceiver();try{
  const item=makeRepairCases({development:true,count:2}).find(c=>c.mutation==='limit'&&!c.values.local);
  const full=await executeRepair(item,'full_restart',receiver),selective=await executeRepair(item,'selective_frontier',receiver);
  assert.ok(selective.metrics.calls<full.metrics.calls);assert.ok(selective.evaluation.success&&full.evaluation.success);
  const sizes=selective.events.filter(e=>'historySize'in e).map(e=>e.historySize);assert.deepEqual(sizes,[...sizes].sort((a,b)=>a-b));
 }finally{await receiver.close();}
});
