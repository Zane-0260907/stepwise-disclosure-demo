import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ADAPTIVE_METHODS, PROPOSAL_INSTRUCTIONS } from '../src/research/adaptive-financial.mjs';
const root = new URL('../', import.meta.url), out = new URL('evidence/validation-v5/', root);
const old = JSON.parse(await readFile(new URL('evidence/validation-v4/finqa/protocol.json', root), 'utf8'));
const files = [...new Set([...Object.keys(old.hashes), 'src/research/conflict-view.mjs', 'src/research/adaptive-financial.mjs',
  'src/research/experiment-directory.mjs', 'fixtures/finqa-v5/cases.json', 'fixtures/finqa-v5/development.json',
  'fixtures/finqa-v5/labels.json', 'fixtures/finqa-v5/provenance.json', 'scripts/finqa-conversion.mjs',
  'scripts/prepare-finqa-v5.mjs', 'scripts/run-v5.mjs'])];
const hashes = {};
for (const file of files) hashes[file] = createHash('sha256').update(await readFile(new URL(file, root))).digest('hex');
const protocol = { id: 'prospective-v5-20260927', frozenAt: new Date().toISOString(), model: 'deepseek-flash', temperature: 0,
  methods: ADAPTIVE_METHODS, cases: 60, reports: 55, companies: 40, repetitions: 2, jobs: 600, concurrency: 4,
  maxTokens: 900, proposals: 3, maxExtraNumericFields: 3, proposalInstructions: PROPOSAL_INSTRUCTIONS,
  primary: 'Numerical correctness against original FinQA exe_ans; absolute tolerance 0.00005. All planned tasks, including failures, in the denominator.',
  controls: 'full_once uses the unchanged v4 all-values single-call planner. Four other methods use the same three schema-only proposals. schema_vote stops at a structural vote; blind_review adds a value-free review on disagreement; union_review reveals the union of candidate dependencies; conflict_review reveals a minimum-cardinality cover of syntactic dependency/operator conflicts, at most three fields. Reviews share the same prompt and may propose a new program.',
  decision: 'Require all three valid proposals to have the same normalized expression signature to skip review. Agreement is not semantic correctness. Same numerical outputs with different signatures are still a disagreement.',
  development: 'Six previously exposed v4 development cases used for an interface smoke test (30 tasks); tests exercise actual disagreement, invalid proposals and revocation. No v5 held-out model results observed before freeze.',
  sampling: 'Same table-only compatibility filter as v4. Exclude all company-year reports used by v4 test or development; fixed SHA256 ordering; one question per page. Sixty new pages from 55 reports. No model-dependent selection.',
  secondary: ['raw cell transmissions and unique cells', 'extra cells versus gold-program operands', 'agreement and review subgroups', 'calls', 'tokens', 'core wall time excluding UI pacing'],
  statistics: 'Average repeats within each case; paired case-weighted report-cluster bootstrap, 4000 draws, seed 20260928. Report absolute percentage-point differences. No population, equivalence or non-inferiority claim.',
  failures: 'Retain wrong answers and parse/provider/program errors; resume missing job IDs only. No best-of-run selection, relabeling or post-outcome tuning of frozen code.',
  limits: ['One provider/model; a restricted public table subset, not a full benchmark.', 'Previous model-training exposure unknown.', 'A minimum syntactic conflict cover is not a semantically minimal sufficient view or an optimal privacy policy.', 'Question/schema and candidate programs remain visible; no semantic privacy guarantee.', 'No completed human explanation-quality evaluation.'], hashes };
await mkdir(out, { recursive: true });
await writeFile(new URL('protocol.json', out), JSON.stringify(protocol, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ frozenAt: protocol.frozenAt, jobs: protocol.jobs, hashedFiles: files.length }));
