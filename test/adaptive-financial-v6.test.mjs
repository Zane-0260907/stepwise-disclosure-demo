import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRun } from '../src/research/engine.mjs';
import { executeAdaptiveFinancial } from '../src/research/adaptive-financial-v6.mjs';
import { hash } from '../src/research/local-program.mjs';

import { buildTableView } from '../src/research/table-view.mjs';
const originalTable=[['','2020','2019','2018'],['working capital','12','3','4']];
const legacyFacts={r1c1:12,r1c2:3,r1c3:4};
const item = { id: 'test-table', family: 'finance', sourceId: 'test/page', source: 'test', question: 'What is a divided by b?',
  originalTable,legacyFacts,...buildTableView(originalTable,legacyFacts), title: { en: 'Test' }, task: { en: 'Test' } };
const program = denominator => [{ op: 'divide', args: [{ field: 'r1c1' }, { field: denominator }] }];
function fake(programs) {
  const inputs = [];
  return { inputs, testing: true, async send(run, step, payload, recipient) {
    const index = inputs.length; inputs.push(structuredClone(payload));
    const response = { choices: [{ message: { tool_calls: [{ id: `call-${index}`, function: { name: 'submit_calculation', arguments: JSON.stringify({ program: programs[index] }) } }] } }], usage: {} };
    const rawBody = JSON.stringify(payload);
    return { status: 200, response, receipt: { id: randomUUID(), runId: run.id, stepId: step.id, recipient, rawBody,
      sha256: hash(rawBody), bytes: Buffer.byteLength(rawBody), receivedAt: new Date().toISOString(), responseSha256: hash(JSON.stringify(response)) } };
  } };
}
test('agreement executes locally without sending cell values or computed answers', async () => {
  const transport = fake([program('r1c2'), program('r1c2'), program('r1c2')]);
  const run = createRun(item, { model: 'deepseek-flash' }); run.method = 'conflict_review';
  await executeAdaptiveFinancial(run, item, transport);
  assert.equal(run.status, 'completed'); assert.equal(run.result.amount, 4); assert.equal(run.metrics.modelCalls, 3);
  assert.equal(run.disclosureDecision.agreed, true);
  assert.ok(transport.inputs.every(p => Object.keys(JSON.parse(p.messages[1].content).facts).length === 0));
});
test('conflict view is authorized, bounded and separate from all locally read dependencies', async () => {
  const transport = fake([program('r1c2'), program('r1c3'), program('r1c2'), program('r1c2')]);
  const run = createRun(item, { model: 'deepseek-flash' }); run.method = 'conflict_review';
  await executeAdaptiveFinancial(run, item, transport);
  assert.equal(run.status, 'completed'); assert.equal(run.metrics.modelCalls, 4);
  const body = JSON.parse(transport.inputs.at(-1).messages[1].content);
  assert.deepEqual(body.facts, { r1c2: 3 });
  assert.deepEqual(Object.keys(body.proposals[0]), ['program']);
  assert.deepEqual(run.programCertificates[0].dependencies.map(d => d.field), ['r1c1', 'r1c2']);
});
test('revocation after planning blocks before transport and invalid review is not rescued by a prior answer', async () => {
  const blockedTransport = fake([program('r1c2')]);
  const blocked = createRun(item, { condition: 'revoke_after_plan' }); blocked.method = 'conflict_review';
  await executeAdaptiveFinancial(blocked, item, blockedTransport);
  assert.equal(blocked.status, 'blocked'); assert.equal(blockedTransport.inputs.length, 0);
  const invalidTransport = fake([program('r1c2'), program('r1c3'), program('r1c2'), [{ op: 'exec', args: [] }]]);
  const invalid = createRun(item); invalid.method = 'conflict_review';
  await executeAdaptiveFinancial(invalid, item, invalidTransport);
  assert.equal(invalid.status, 'failed'); assert.equal(invalid.result, null);
});

test('v6 rejects cached values inconsistent with the original table before any call',async()=>{
 const item2=structuredClone(item);item2.facts.r1c1=999;const transport=fake([]);const run=createRun(item2);run.method='local_once';
 await assert.rejects(()=>executeAdaptiveFinancial(run,item2,transport),/CACHED_SCHEMA_MISMATCH/);assert.equal(transport.inputs.length,0);
});
