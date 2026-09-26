import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { platform, arch, cpus } from 'node:os';
import { createRun } from '../src/research/engine.mjs';
import { executeAdaptiveFinancial, ADAPTIVE_METHODS } from '../src/research/adaptive-financial-v6.mjs';
import { scoreFinancial } from '../src/research/financial-score.mjs';
import { createTransport } from '../src/research/transport.mjs';
import { startDeepSeekProxy } from '../src/research/deepseek-live.mjs';
import { claimExperimentDirectory } from '../src/research/experiment-directory.mjs';

const root = new URL('../', import.meta.url), pilot = process.argv.includes('--pilot');
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const protocol = pilot ? { id: 'development-v6', model: 'deepseek-flash', methods: ADAPTIVE_METHODS, repetitions: 1, concurrency: 4, hashes: {} }
  : await read('evidence/validation-v6/protocol.json');
const verify = async () => {
  for (const [file, expected] of Object.entries(protocol.hashes)) {
    if (createHash('sha256').update(await readFile(new URL(file, root))).digest('hex') !== expected) throw Error(`PROTOCOL_CHANGED: ${file}`);
  }
};
await verify();
const key = process.env.DEEPSEEK_API_KEY?.trim(); delete process.env.DEEPSEEK_API_KEY;
if (!key) throw Error('DEEPSEEK_API_KEY is required for new calls. Saved-record verification requires no key.');
let cases = await read(`fixtures/finqa-v6/${pilot ? 'development' : 'cases'}.json`);
if (pilot) cases = cases;
const labels = await read('fixtures/finqa-v6/labels.json');
const recordId = process.argv.find(arg => arg.startsWith('--run-id='))?.slice(9) || `${pilot ? 'dev' : 'new'}-v6-${Date.now()}`;
const claim = await claimExperimentDirectory(new URL('data/research/validation/', root), recordId, protocol);
let proxy, transport;
try {
  const dir = claim.directory;
  proxy = await startDeepSeekProxy({ key, recordDirectory: new URL('provider-egress/', dir) });
  process.env.DASHSCOPE_API_KEY = proxy.internalToken; process.env.DEMO_MODEL_URL = proxy.url;
  transport = await createTransport();
  let previous = [];
  try { previous = (await readFile(new URL('scores.jsonl', dir), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const completed = new Set(previous.map(row => row.jobId)), jobs = [], allJobs = new Set();
  if (completed.size !== previous.length) throw Error('DUPLICATE_JOB');
  for (let repeat = 0; repeat < protocol.repetitions; repeat++) for (let i = 0; i < cases.length; i++) for (let j = 0; j < protocol.methods.length; j++) {
    const method = protocol.methods[(j + i + repeat) % protocol.methods.length], item = cases[i];
    const jobId = `${item.id}/${method}/${repeat}`; allJobs.add(jobId);
    if (!completed.has(jobId)) jobs.push({ item, method, repeat, jobId });
  }
  if (previous.some(row => !allJobs.has(row.jobId))) throw Error('RESUME_JOB_MISMATCH');
  await writeFile(new URL('manifest.json', dir), JSON.stringify({ protocol, recordId, startedAt: claim.previous?.startedAt || new Date().toISOString(),
    resumedAt: claim.previous ? new Date().toISOString() : null, environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
    previous: previous.length, pending: jobs.length }, null, 2));
  let index = 0, done = previous.length, stop = false;
  console.log(JSON.stringify({ recordId, tasks: allJobs.size, pending: jobs.length, pilot }));
  await Promise.all(Array.from({ length: protocol.concurrency }, async () => {
    while (index < jobs.length && !stop) {
      const { item, method, repeat, jobId } = jobs[index++];
      const run = createRun(item, { model: protocol.model }); run.method = method;
      await executeAdaptiveFinancial(run, item, transport);
      const score = { ...scoreFinancial(run, labels[item.id]), jobId, repetition: repeat,
        agreement: run.disclosureDecision?.agreed ?? null, reviewed: run.disclosureDecision?.review ?? false,
        selectedViewSize: run.disclosureDecision?.fields.length ?? Object.keys(item.facts).length };
      await writeFile(new URL(`${run.id}.json`, dir), JSON.stringify(run));
      await appendFile(new URL('scores.jsonl', dir), JSON.stringify(score) + '\n'); done++;
      if (pilot || done % 20 === 0 || done === allJobs.size) console.log(JSON.stringify({ done, total: allJobs.size, method, passed: score.structuredSuccess, error: score.error }));
      if (/MODEL_HTTP_(401|402|403)|Arrearage|Insufficient Balance/.test(run.error || '')) stop = true;
    }
  }));
  await verify();
  await writeFile(new URL(done === allJobs.size ? 'complete.json' : 'interrupted.json', dir), JSON.stringify({ done, total: allJobs.size, finishedAt: new Date().toISOString(), providerStopped: stop }, null, 2));
  if (done !== allJobs.size) process.exitCode = 2;
} finally { transport?.close(); await proxy?.close(); await claim.release(); }
