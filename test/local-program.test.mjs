import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLocalProgram,bindDerivedResult} from '../src/research/local-program.mjs';
import {createSealedRequestGate} from '../src/research/sealed-request-v4.mjs';
const program=[{op:'multiply',args:[{field:'days'},{constant:230}]}];
const context=()=>({program,facts:{days:5,amount:61000,identity:'private'},allowedFields:['days','amount'],runId:'run',stepId:'step',recipient:'cloud-model',purpose:'penalty',policy:{allowed:true,allowDerived:true,version:1}});

test('local computation releases a result while recording only its actual reads',()=>{
  const c=context(),t=bindDerivedResult(c);assert.equal(t.audit.value,1150);
  assert.deepEqual(t.audit.dependencies.map(d=>d.field),['days']);
  c.facts.amount=999;t.audit.dependencies[0].sha256='forged';t.audit.value=0;
  assert.equal(t.consume(c).value,1150);assert.throws(()=>t.consume(c),/REPLAY/);
});
test('source, policy, recipient, purpose and run changes invalidate derived releases',()=>{
  for(const mutate of [c=>c.facts.days++,c=>c.policy.version++,c=>c.policy.allowDerived=false,c=>c.recipient='other',c=>c.purpose='other',c=>c.runId='other']) {
    const c=context(),t=bindDerivedResult(c);mutate(c);assert.throws(()=>t.consume(c),/LOCAL_PROGRAM_/);
  }
});
test('the interpreter rejects code injection, unauthorized reads, cycles and unused work',()=>{
  const bad=[
    [{op:'constructor',args:[{field:'days'},{constant:1}]}],
    [{op:'add',args:[{field:'identity'},{constant:1}]}],
    [{op:'add',args:[{step:0},{constant:1}]}],
    [{op:'divide',args:[{field:'days'},{constant:0}]}],
    [...program,{op:'add',args:[{field:'amount'},{constant:0}]}],
    [{op:'add',args:[{field:'days',constant:0},{constant:1}]}]
  ];
  for(const p of bad)assert.throws(()=>evaluateLocalProgram(p,context().facts,['days','amount']),/LOCAL_PROGRAM_/);
});
test('multiple steps track transitive dependencies without reading unused source fields',()=>{
  const p=[{op:'subtract',args:[{field:'days'},{constant:2}]},{op:'max',args:[{step:0},{constant:0}]},{op:'multiply',args:[{step:1},{constant:230}]}];
  assert.equal(evaluateLocalProgram(p,context().facts,['days']).value,690);
});
test('editing visible request metadata cannot bypass the private source binding',async()=>{
  let sent=false;
  const gate=createSealedRequestGate({send:async()=>{sent=true;throw Error('should not send');}});
  const item={facts:{days:5}},run={id:'run',method:'v4',policy:{allowed:true,version:1},metrics:{controlMs:[]},events:[]};
  const step={id:'s',operation:'analyze',recipient:'cloud-model',plannedPolicyVersion:1,checks:[]};
  const payload={messages:[{role:'system',content:'test'},{role:'user',content:JSON.stringify({facts:item.facts})}]};
  gate.prepare({run,step,item,view:item.facts,payload});
  item.facts.days=6;step.requestPlan.dependencies.length=0;
  await assert.rejects(()=>gate.transport.send(run,step,payload,'cloud-model'),/SOURCE_CHANGED/);assert.equal(sent,false);
});
