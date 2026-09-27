import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {boundViews} from '../src/research/bound-views-v10.mjs';
import {localConfirmations} from '../src/research/local-confirmation-v10.mjs';
import {pairedReplay} from '../src/research/paired-replay-v10.mjs';

const initial = {users: {u: {user_id: 'u', address1: '10 Local Street', email: 'local@example.test'}}};
const hash = db => createHash('sha256').update(JSON.stringify(db)).digest('hex');
function bridge() {
  let db = structuredClone(initial);
  return {async call(message) {
    const {command, name, arguments: args} = message;
    if (command === 'init') { db = structuredClone(initial); return {dbHash: hash(db), mutatingTools: ['modify_user_address'], tools: ['get_user_details', 'modify_user_address', 'transfer_to_human_agents'].map(name => ({function: {name}}))}; }
    if (command === 'snapshot') return {db: structuredClone(db), dbHash: hash(db)};
    if (command === 'validate') return {valid: true};
    if (command !== 'call') throw Error('Unknown test operation');
    const dbBefore = hash(db);
    if (name === 'modify_user_address') db.users.u.address1 = args.address1;
    const result = name === 'transfer_to_human_agents' ? {summary: args.summary} : structuredClone(db.users.u);
    return {result, dbBefore, dbAfter: hash(db), errorType: null, mutatesState: name === 'modify_user_address'};
  }, async close() {}};
}

async function trace(kind) {
  const native = bridge(), views = boundViews({mode: 'tokenized'});
  const info = await native.call({command: 'init'});
  const record = {caseId: 'unit-fixture', domain: 'retail', method: 'native-tokenized-local-confirmation', initialDbHash: info.dbHash, actions: [], localPanels: []};
  async function action(name, args, approved = true) {
    const snapshot = await native.call({command: 'snapshot'});
    const raw = views.bind(name, args, snapshot.db);
    const proposed = name === 'modify_user_address';
    const confirmationId = proposed ? 'confirmation-' + record.actions.length : null;
    if (proposed) record.localPanels.push({id: confirmationId, name, arguments: structuredClone(raw), approved});
    const nativeExecuted = !proposed || approved;
    const result = nativeExecuted ? await native.call({command: 'call', name, arguments: raw}) : {result: {error: 'LOCAL_USER_DECLINED'}, dbBefore: snapshot.dbHash, dbAfter: snapshot.dbHash, errorType: 'AdapterValidationError', mutatesState: false};
    const observation = views.project(result.result, {sourceRoot: views.sourceRoot(name, raw, result.result, 'retail')});
    record.actions.push({name, exposedName: proposed ? 'propose_' + name : name, plannerArguments: structuredClone(args), arguments: raw, nativeExecuted, confirmationId, toolCallId: 'call-' + record.actions.length, observation, ...result});
    return observation;
  }
  const user = await action('get_user_details', {user_id: 'u'});
  if (kind === 'purpose') await action('transfer_to_human_agents', {summary: user.email});
  else if (kind === 'stale') {
    await action('modify_user_address', {user_id: 'u', address1: 'New Local Street'});
    await action('modify_user_address', {user_id: 'u', address1: user.address1});
  }
  else await action('modify_user_address', {user_id: 'u', address1: user.address1}, kind !== 'decline');
  await action('get_user_details', {user_id: 'u'});
  record.finalDbHash = (await native.call({command: 'snapshot'})).dbHash;
  return record;
}
const options = {makeViews: boundViews, makeConfirmations: localConfirmations, openBridge: bridge};

test('paired replay equates different random token names and fixed valid confirmations', async () => {
  const result = await pairedReplay(await trace('valid'), options);
  assert.equal(result.equivalentOnRecordedTrajectory, true);
  assert.equal(result.actionsCompared, 3);
  assert.equal(result.finalStates.scoped, result.finalStates.tokenized);
});

test('paired replay detects a real guard effect and stops before invalid downstream fixed decisions', async () => {
  const result = await pairedReplay(await trace('purpose'), options);
  assert.equal(result.firstDivergence, 1);
  assert.equal(result.actionsCompared, 2);
  assert.equal(result.steps[1].arms.scoped.bindingGuardRefusal, 'REFERENCE_PURPOSE_MISMATCH');
  assert.equal(result.steps[1].arms.scoped.nativeExecuted, false);
  assert.equal(result.steps[1].arms.tokenized.nativeExecuted, true);
});

test('paired replay keeps customer refusal in both arms rather than crediting it to reference guards', async () => {
  const result = await pairedReplay(await trace('decline'), options);
  assert.equal(result.equivalentOnRecordedTrajectory, true);
  assert.equal(result.steps[1].arms.scoped.nativeExecuted, false);
  assert.equal(result.steps[1].arms.tokenized.nativeExecuted, false);
  assert.equal(result.steps[1].arms.scoped.bindingGuardRefusal, null);
});

test('paired replay detects stale-source guard effects and has stable evidence across fresh token names', async () => {
  const record = await trace('stale');
  const result = await pairedReplay(record, options);
  assert.equal(result.firstDivergence, 2);
  assert.equal(result.steps[2].arms.scoped.bindingGuardRefusal, 'STALE_OR_UNBOUND_REFERENCE');
  assert.notEqual(result.finalStates.scoped, result.finalStates.tokenized);
  assert.deepEqual(await pairedReplay(record, options), result);
});

test('paired replay fails on corrupted raw arguments or customer offers instead of silently reproducing them', async () => {
  const record = await trace('valid');
  record.actions[0].arguments.user_id = 'changed';
  await assert.rejects(pairedReplay(record, options), /Original arm no longer reproduces/);
  const other = await trace('valid');
  other.localPanels[0].arguments.address1 = 'A different offer';
  await assert.rejects(pairedReplay(other, options), {name: 'AssertionError'});
});
