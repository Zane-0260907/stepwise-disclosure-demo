import test from 'node:test';
import assert from 'node:assert/strict';
import {requirementController, requestDigest} from '../src/research/requirement-controller.mjs';

export function fixture({local = false, derived = true, authorize = () => true, transport} = {}) {
  const state = {values: {amount: 120, limit: 100}, versions: {amount: 1, limit: 1}, local, derived};
  const contract = {id: 'limit-check', required: () => ['exceeds-limit'],
    validate: x => typeof x === 'object' && (typeof x.exceeds === 'boolean' || (Number.isFinite(x.amount) && Number.isFinite(x.limit))),
    validateResult: x => typeof x?.exceeds === 'boolean', options: [
      {id: 'local-completion', kind: 'local', covers: ['exceeds-limit'], dependencies: () => ['amount', 'limit'], available: s => s.local, evaluate: v => ({exceeds: v.amount > v.limit})},
      {id: 'derived-predicate', kind: 'remote', covers: ['exceeds-limit'], dependencies: () => ['amount', 'limit'], available: s => s.derived, evaluate: v => ({exceeds: v.amount > v.limit})},
      {id: 'raw-operands', kind: 'remote', covers: ['exceeds-limit'], dependencies: () => ['amount', 'limit'], available: () => true, evaluate: v => ({amount: v.amount, limit: v.limit})},
    ]};
  const calls = [];
  const ctl = requirementController({contracts: [contract], snapshot: () => state, authorize, transport: transport || (async ({body}) => {
    calls.push(body); const {input} = JSON.parse(body);
    return {requestSha256: requestDigest(body), result: {exceeds: input.exceeds ?? input.amount > input.limit}};
  })});
  return {ctl, state, calls};
}

test('local completion and derived/raw representations preserve a structural result', async () => {
  for (const [local, derived, expected, count] of [[true,true,'local-completion',0],[false,true,'derived-predicate',1],[false,false,'raw-operands',2]]) {
    const {ctl, calls} = fixture({local, derived}); const t = ctl.inspect('limit-check','service');
    assert.equal(t.representation, expected); assert.deepEqual(await ctl.execute(t),{exceeds:true});
    assert.equal(ctl.history.length,count); assert.equal(calls.length,local?0:1);
    assert.equal(ctl.events[0].alternatives.length,1+Number(local)+Number(derived));
  }
});
test('a model request cannot add an unregistered information requirement', () => {
  const {ctl} = fixture(); assert.throws(() => ctl.inspect('limit-check','service',['customer-name']), /UNVERIFIED/);
  assert.throws(() => ctl.inspect('invented','service'), /UNKNOWN_CONTRACT/); assert.equal(ctl.history.length,0);
});
test('state change, including capability change, blocks the old ticket before sending', async () => {
  for (const mutation of [s => s.versions.amount++, s => s.derived=false, s => s.values.amount=1]) {
    const {ctl,state,calls}=fixture(); const t=ctl.inspect('limit-check','service'); mutation(state);
    await assert.rejects(ctl.execute(t),/STATE_CHANGED/); assert.equal(calls.length,0); assert.equal(ctl.history.length,0);
    assert.equal(ctl.inspect('limit-check','service').status,'ready');
  }
});
test('new recipient and new source version count as new disclosures', async () => {
  const {ctl,state}=fixture();
  await ctl.execute(ctl.inspect('limit-check','a')); await ctl.execute(ctl.inspect('limit-check','a')); assert.equal(ctl.history.length,1);
  await ctl.execute(ctl.inspect('limit-check','b')); assert.equal(ctl.history.length,2);
  state.versions.amount++; await ctl.execute(ctl.inspect('limit-check','a')); assert.equal(ctl.history.length,3);
});
test('uncertain send consumes ticket and keeps the cumulative ledger', async () => {
  const {ctl}=fixture({transport:async()=>{throw Error('TIMEOUT');}}); const t=ctl.inspect('limit-check','a');
  await assert.rejects(ctl.execute(t),/TIMEOUT/); assert.equal(ctl.history.length,1);
  await assert.rejects(ctl.execute(t),/CONSUMED/); assert.equal(ctl.history.length,1);
});
test('wrong receipt or invalid result never becomes a checked completion', async () => {
  for (const transport of [async()=>({requestSha256:'wrong',result:{exceeds:true}}),async({body})=>({requestSha256:requestDigest(body),result:{text:'fine'}})]) {
    const {ctl}=fixture({transport}); await assert.rejects(ctl.execute(ctl.inspect('limit-check','a')),/RECEIPT_MISMATCH|RESULT_CONTRACT_FAILED/);
    assert.equal(ctl.history.length,1); assert.equal(ctl.events.at(-1).type,'transmission.uncertain');
  }
});
test('authorization is checked at selection and again before transmission', async () => {
  let allow=true; const {ctl,calls}=fixture({authorize:()=>allow}); const t=ctl.inspect('limit-check','a'); allow=false;
  await assert.rejects(ctl.execute(t),/AUTHORIZATION_CHANGED/); assert.equal(calls.length,0);
  assert.equal(ctl.inspect('limit-check','a').status,'blocked');
});
test('forged tickets cannot choose the recipient or replace payload', async () => {
  const {ctl,calls}=fixture(); const ticket=ctl.inspect('limit-check','a');
  await assert.rejects(ctl.execute({...ticket,recipient:'b'}),/INVALID_OR_CONSUMED/); assert.equal(calls.length,0);
});
test('local completion must satisfy the output contract, not merely an input representation', () => {
  const ctl=requirementController({snapshot:()=>({values:{},versions:{}}),authorize:()=>true,
    transport:async()=>{throw Error('MUST_NOT_SEND');},contracts:[{id:'invalid-local-result',required:()=>['answer'],
      validate:()=>true,validateResult:x=>typeof x?.answer==='boolean',options:[{
        id:'bad-local',kind:'local',covers:['answer'],dependencies:()=>[],available:()=>true,evaluate:()=>({description:'still incomplete'}),
      }]}]});
  assert.throws(()=>ctl.inspect('invalid-local-result','service'),/LOCAL_RESULT_CONTRACT_FAILED/);
  assert.equal(ctl.history.length,0);
});
