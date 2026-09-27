import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nativeTau} from '../src/research/native-tau-v10.mjs';
import {pairedReplay} from '../src/research/paired-replay-v10.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
process.env.LOGURU_LEVEL = 'ERROR';
const sha = content => createHash('sha256').update(content).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const rows = [], inputs = {};
for (const mode of ['tokenized', 'scoped']) {
  const runId = `dev-v10-matched-${mode}-02`;
  const folder = resolve('data/research/v10-runs', runId);
  const protocol = await json(resolve(folder, 'protocol.json'));
  assert.equal(protocol.localConfirmation, true);
  for (const [file, expected] of Object.entries(protocol.sourceHashes)) {
    const frozen = resolve(folder, 'frozen', file.split('/').at(-1));
    assert.equal(sha(await readFile(frozen)), expected, 'Frozen source changed: ' + file);
  }
  // The process wrapper changed after the runs to handle missing runtimes. The
  // executed native bridge itself must still match the frozen business adapter.
  assert.equal(sha(await readFile('scripts/native_tau_bridge.py')), protocol.sourceHashes['scripts/native_tau_bridge.py']);
  const {boundViews} = await import(pathToFileURL(resolve(folder, 'frozen/bound-views-v10.mjs')));
  const {localConfirmations} = await import(pathToFileURL(resolve(folder, 'frozen/local-confirmation-v10.mjs')));
  inputs[runId] = {protocolSha256: sha(await readFile(resolve(folder, 'protocol.json'))), records: {}};
  for (const cid of protocol.caseIds) {
    const bytes = await readFile(resolve(folder, cid + '.json'));
    inputs[runId].records[cid] = sha(bytes);
    const record = JSON.parse(bytes);
    const result = await pairedReplay(record, {makeViews: boundViews, makeConfirmations: localConfirmations, openBridge: () => nativeTau()});
    rows.push({runId, ...result});
    console.log(JSON.stringify({runId, caseId: cid, actions: result.actionsCompared, firstDivergence: result.firstDivergence}));
  }
}
const totals = {recordedTrajectories: rows.length, uniqueTasks: new Set(rows.map(r => r.caseId)).size,
  actionsCompared: rows.reduce((n, r) => n + r.actionsCompared, 0),
  equivalentTrajectories: rows.filter(r => r.equivalentOnRecordedTrajectory).length,
  divergentTrajectories: rows.filter(r => !r.equivalentOnRecordedTrajectory).length,
  newModelCalls: 0};
const result = {
  kind: 'post-hoc-fixed-trajectory-mechanism-ablation',
  intervention: 'Replay each saved tokenized/scoped conversation in two fresh native databases, with and without purpose/freshness guards. Hold recorded planner proposals and local customer decisions fixed; alias opaque references bijectively. Stop at the first divergent outcome.',
  limits: 'Only the observed prefixes are tested. This does not replay new user/model responses, estimate deployment prevalence, prove equivalence on all inputs, establish semantic privacy or count repeated trajectories as independent tasks.',
  inputs, totals, rows,
};
const output = resolve('evidence/development-v10/paired-replay.json');
if (process.argv.includes('--check')) assert.deepEqual(await json(output), result, 'Saved paired replay differs');
else await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({pairedReplay: 'passed', ...totals}));
