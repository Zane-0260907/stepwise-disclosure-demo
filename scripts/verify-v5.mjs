import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { hash, evaluateLocalProgram } from '../src/research/local-program.mjs';
import { inspectCandidate, chooseConflictView, majorityCandidate } from '../src/research/conflict-view.mjs';
import { scoreFinancial } from '../src/research/financial-score.mjs';

const root = new URL('../', import.meta.url), published = new URL('evidence/validation-v5/', root);
const load = async url => JSON.parse(await readFile(url, 'utf8'));
const protocol = await load(new URL('protocol.json', published));
for (const [file, expected] of Object.entries(protocol.hashes)) assert.equal(hash(await readFile(new URL(file, root), 'utf8')), expected, `Frozen source changed: ${file}`);
const newId = process.argv.find(arg => arg.startsWith('--run-id='))?.slice(9);
if (newId && !/^[a-zA-Z0-9_-]{1,90}$/.test(newId)) throw Error('Invalid run-id');
const dir = new URL(`data/research/validation/${newId || protocol.id}/`, root);
const out = newId ? new URL('analysis/', dir) : published; await mkdir(out, { recursive: true });
const done = await load(new URL('complete.json', dir)); assert.equal(done.done, protocol.jobs);
const items = await load(new URL('fixtures/finqa-v5/cases.json', root));
const labels = await load(new URL('fixtures/finqa-v5/labels.json', root));
const old = [...await load(new URL('fixtures/finqa-v4/cases.json', root)), ...await load(new URL('fixtures/finqa-v4/development.json', root))];
const oldReports = new Set(old.map(item => item.sourceFile.split('/').slice(0, 2).join('/')));
assert.ok(items.every(item => !oldReports.has(item.sourceFile.split('/').slice(0, 2).join('/'))));
const rows = (await readFile(new URL('scores.jsonl', dir), 'utf8')).trim().split('\n').map(JSON.parse);
const expectedJobs = new Set(items.flatMap(item => protocol.methods.flatMap(method => [0, 1].map(repeat => `${item.id}/${method}/${repeat}`))));
assert.equal(rows.length, expectedJobs.size); assert.equal(new Set(rows.map(row => row.jobId)).size, rows.length);
const providers = [];
for (const file of await readdir(new URL('provider-egress/', dir))) if (file.endsWith('.json')) providers.push(await load(new URL(`provider-egress/${file}`, dir)));
const unused = new Set(providers.map(p => p.id)), failures = [];
let verifiedProviderCalls = 0, verifiedPrograms = 0;
for (const row of rows) {
  assert.ok(expectedJobs.delete(row.jobId)); assert.equal(row.jobId, `${row.caseId}/${row.method}/${row.repetition}`);
  const run = await load(new URL(`${row.runId}.json`, dir)), item = items.find(item => item.id === row.caseId);
  assert.ok(item); assert.deepEqual(run.input, item.facts); assert.equal(run.method, row.method);
  assert.equal(run.model, protocol.model);
  const score = scoreFinancial(run, labels[item.id]);
  for (const [key, value] of Object.entries(score)) assert.deepEqual(row[key], value, `${row.jobId}: score ${key}`);
  const candidates = [];
  for (const record of run.candidateRecords || []) {
    const step = run.steps.find(step => step.id === record.stepId);
    const message = step.providerResponse.message;
    let actualCandidate = null, actualError = null;
    try {
      if (message?.tool_calls?.length !== 1 || message.tool_calls[0].function.name !== 'submit_calculation') throw Error('ONE_PROGRAM_REQUIRED');
      const args = JSON.parse(message.tool_calls[0].function.arguments);
      if (!args || Object.keys(args).join() !== 'program') throw Error('INVALID_PROGRAM_ARGUMENTS');
      actualCandidate = inspectCandidate(args.program, item);
    } catch (error) { actualError = error.message; }
    assert.deepEqual(record.candidate, actualCandidate); assert.equal(record.error, actualError);
    if (record.candidate) {
      assert.equal(message.tool_calls.length, 1); assert.equal(message.tool_calls[0].function.name, 'submit_calculation');
      const program = JSON.parse(message.tool_calls[0].function.arguments).program;
      const verified = inspectCandidate(program, item); assert.deepEqual(record.candidate, verified); verifiedPrograms++;
      if (Number.isInteger(record.role)) candidates.push(verified);
    } else assert.ok(record.error, 'Invalid proposals must remain recorded');
  }
  const decision = run.disclosureDecision;
  if (decision) {
    const coverage = chooseConflictView(candidates, item.schema.map(cell => cell.id), 3);
    assert.deepEqual(decision.coverage, coverage);
    const agreed = candidates.length === 3 && new Set(candidates.map(c => c.signature)).size === 1;
    assert.equal(decision.agreed, agreed);
    const union = [...new Set(candidates.flatMap(c => c.certificate.dependencies.map(d => d.field)))].sort();
    const fields = agreed || row.method === 'schema_vote' || row.method === 'blind_review' ? [] : row.method === 'union_review' ? union : coverage.fields;
    assert.deepEqual(decision.fields, fields); assert.equal(decision.review, !agreed && row.method !== 'schema_vote');
    if (row.method === 'conflict_review') assert.ok(fields.length <= 3);
    assert.equal(row.agreement, agreed); assert.equal(row.reviewed, decision.review); assert.equal(row.selectedViewSize, fields.length);
  }
  if (run.status === 'completed' && row.method !== 'full_once') {
    assert.deepEqual(run.candidateRecords.filter(r => Number.isInteger(r.role)).map(r => r.role), [0, 1, 2]);
    const chosen = decision.review ? run.candidateRecords.find(r => r.role === 'review').candidate : majorityCandidate(candidates);
    assert.deepEqual(run.programCertificates.at(-1), chosen.certificate);
  }
  if (run.result) {
    const certificate = run.programCertificates.at(-1);
    const verified = evaluateLocalProgram(certificate.program, item.facts, Object.keys(item.facts));
    assert.deepEqual(certificate, verified); assert.equal(run.result.amount, verified.value); verifiedPrograms++;
    if (row.method === 'full_once') {
      const message = run.steps.find(s => s.providerResponse)?.providerResponse.message;
      assert.deepEqual(JSON.parse(message.tool_calls[0].function.arguments).program, certificate.program);
    }
  }
  assert.equal(run.metrics.modelCalls, run.receipts.length);
  for (const receipt of run.receipts) {
    assert.equal(hash(receipt.rawBody), receipt.sha256); assert.equal(Buffer.byteLength(receipt.rawBody), receipt.bytes);
    const body = JSON.parse(receipt.rawBody), content = JSON.parse(body.messages[1].content);
    for (const [field, value] of Object.entries(content.facts)) assert.equal(value, item.facts[field]);
    if (row.method === 'full_once') assert.deepEqual(content.facts, item.facts);
    else {
      const record = run.candidateRecords.find(r => r.stepId === receipt.stepId);
      // A provider failure may have no parsed candidate record.
      const review = content.proposals !== undefined;
      if (!review) assert.deepEqual(content.facts, {});
      else {
        assert.deepEqual(content.facts, Object.fromEntries(decision.fields.map(f => [f, item.facts[f]])));
        assert.deepEqual(content.proposals, candidates.map(c => ({ program: c.certificate.program })));
      }
      if (record) assert.equal(record.role === 'review', review);
    }
    const match = providers.find(p => unused.has(p.id) && p.receiverBodySha256 === receipt.sha256 && p.responseSha256 === receipt.responseSha256);
    assert.ok(match, `Missing distinct provider record: ${row.jobId}`);
    assert.ok(Date.parse(match.at) >= Date.parse(protocol.frozenAt));
    assert.equal(match.provider, 'deepseek'); assert.equal(match.endpoint, 'https://api.deepseek.com/chat/completions');
    assert.equal(hash(match.providerBody), match.providerBodySha256);
    assert.deepEqual(JSON.parse(match.providerBody), { ...body, thinking: { type: 'disabled' } });
    unused.delete(match.id); verifiedProviderCalls++;
  }
  if (!row.structuredSuccess) failures.push({ ...row, decision, programs: (run.candidateRecords || []).map(r => ({ role: r.role, error: r.error, program: r.candidate?.certificate.program, value: r.candidate?.certificate.value })) });
}
assert.equal(expectedJobs.size, 0); assert.equal(unused.size, 0);
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const quantile = (values, p) => { const sorted = [...values].sort((a, b) => a - b), k = (sorted.length - 1) * p; return sorted[Math.floor(k)] + (sorted[Math.ceil(k)] - sorted[Math.floor(k)]) * (k % 1); };
const summary = protocol.methods.map(method => {
  const selected = rows.filter(r => r.method === method), agreed = selected.filter(r => r.agreement), reviewed = selected.filter(r => r.reviewed);
  return { method, runs: selected.length, passed: selected.filter(r => r.structuredSuccess).length, success: mean(selected.map(r => Number(r.structuredSuccess))),
    transmittedCells: mean(selected.map(r => r.transmittedCells)), uniqueCells: mean(selected.map(r => r.uniqueTransmittedCells)), extraGoldCells: mean(selected.map(r => r.extraGoldCells)),
    modelCalls: selected.reduce((s, r) => s + r.modelCalls, 0), promptTokens: selected.reduce((s, r) => s + r.promptTokens, 0), completionTokens: selected.reduce((s, r) => s + r.completionTokens, 0),
    latencyP50: quantile(selected.map(r => r.elapsedMs), .5), latencyP95: quantile(selected.map(r => r.elapsedMs), .95),
    agreementRuns: agreed.length, agreementPassed: agreed.filter(r => r.structuredSuccess).length, reviewedRuns: reviewed.length, reviewedPassed: reviewed.filter(r => r.structuredSuccess).length,
    zeroCellRuns: selected.filter(r => r.transmittedCells === 0).length };
});
const caseRows = items.flatMap(item => protocol.methods.map(method => {
  const selected = rows.filter(r => r.caseId === item.id && r.method === method); assert.equal(selected.length, 2);
  return { caseId: item.id, report: item.sourceFile.split('/').slice(0, 2).join('/'), method,
    success: mean(selected.map(r => Number(r.structuredSuccess))), transmittedCells: mean(selected.map(r => r.transmittedCells)) };
}));
const clusters = [...new Set(caseRows.map(r => r.report))];
let seed = 20260928;
const random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
const paired = {};
for (const control of protocol.methods.filter(m => m !== 'conflict_review')) {
  const differences = items.map(item => ({ report: item.sourceFile.split('/').slice(0, 2).join('/'),
    value: caseRows.find(r => r.caseId === item.id && r.method === 'conflict_review').success - caseRows.find(r => r.caseId === item.id && r.method === control).success }));
  const samples = [];
  for (let draw = 0; draw < 4000; draw++) {
    const sampled = [];
    for (let k = 0; k < clusters.length; k++) {
      const selectedCluster = clusters[Math.floor(random() * clusters.length)];
      sampled.push(...differences.filter(d => d.report === selectedCluster).map(d => d.value));
    }
    samples.push(mean(sampled));
  }
  paired[`conflict_review_vs_${control}`] = { difference: mean(differences.map(d => d.value)), descriptiveReportCluster95: [quantile(samples, .025), quantile(samples, .975)] };
}
const result = { protocol: protocol.id, jobs: rows.length, verifiedProviderCalls, verifiedPrograms, reports: clusters.length, summary, paired, limits: protocol.limits };
for (const [file, value] of Object.entries({ 'summary.json': result, 'case-aggregates.json': caseRows, 'failures.json': failures })) await writeFile(new URL(file, out), JSON.stringify(value, null, 2) + '\n');
await writeFile(new URL('scores.jsonl', out), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
await writeFile(new URL('RESULTS.md', out), '# Frozen v5 results\n\n60 previously unused public pages, 55 company-year reports, five methods, two repeats.\n\n| Method | Correct | Cells/task | Calls | Median ms |\n|:--|--:|--:|--:|--:|\n' + summary.map(r => `| ${r.method} | ${r.passed}/${r.runs} | ${r.transmittedCells.toFixed(3)} | ${r.modelCalls} | ${r.latencyP50.toFixed(0)} |`).join('\n') + '\n\nAll failures retained. A structural conflict cover is not a semantic privacy or correctness proof. See protocol.json for the design and summary.json for paired intervals.\n');
console.log(JSON.stringify(result, null, 2));
