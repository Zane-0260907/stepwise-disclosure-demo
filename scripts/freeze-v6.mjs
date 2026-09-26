import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ADAPTIVE_METHODS, PROPOSAL_INSTRUCTIONS } from '../src/research/adaptive-financial-v6.mjs';
import { buildTableView } from '../src/research/table-view.mjs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url), out = new URL('evidence/validation-v6/', root);
const old = JSON.parse(await readFile(new URL('evidence/validation-v5/protocol.json', root), 'utf8'));
const items = JSON.parse(await readFile(new URL('fixtures/finqa-v6/cases.json', root), 'utf8'));
for (const item of items) {
  const projected = buildTableView(item.originalTable, item.legacyFacts);
  for (const field of ['facts', 'schema', 'tableStructure', 'headerRows', 'classification']) assert.deepEqual(item[field], projected[field]);
}
const files = [...new Set([...Object.keys(old.hashes), 'src/research/table-view.mjs', 'src/research/financial-execution-v6.mjs',
  'src/research/adaptive-financial-v6.mjs', 'fixtures/finqa-v6/cases.json', 'fixtures/finqa-v6/development.json',
  'fixtures/finqa-v6/labels.json', 'fixtures/finqa-v6/provenance.json', 'scripts/prepare-finqa-v6.mjs', 'scripts/run-v6.mjs'])];
const hashes = {};
for (const file of files) hashes[file] = createHash('sha256').update(await readFile(new URL(file, root))).digest('hex');
const protocol = { id: 'prospective-v6-20260927', frozenAt: new Date().toISOString(), model: 'deepseek-flash', temperature: 0,
  methods: ADAPTIVE_METHODS, cases: 60, reports: 57, companies: 38, repetitions: 2, jobs: 600, concurrency: 4,
  maxTokens: 900, proposals: 3, maxExtraNumericFields: 3, proposalInstructions: PROPOSAL_INSTRUCTIONS,
  primary: 'Numerical correctness against original FinQA exe_ans; absolute tolerance 0.00005. All planned tasks including failures in denominator.',
  controls: 'All five methods share corrected table structure, business-cell schema, authorization, interpreter, model and token limit. full_once sends every business value; local_once sends no business values in one call; requested_cells allows model-requested values; blind_review uses three value-free proposals and value-free review on disagreement; conflict_review uses identical proposals and review but discloses at most three fields chosen by a minimum syntactic conflict cover.',
  correction: 'The frozen v4/v5 adapter incorrectly classified some year headers as business values and omitted their column roles. V6 preserves exact row/column positions and year/unit headers. This is a correctness repair, not a novel algorithm. Historical results are retained with this limitation. No outcome-based relabeling.',
  decision: 'All three valid normalized program signatures must agree to skip review. Structural agreement does not establish correctness. The conflict cover is minimal only for the defined finite syntactic obligations.',
  development: 'Twelve previously exposed examples (six v4 development and six v5 diagnostic failures) used to check the repaired adapter. No v6 held-out model outcome observed before freeze.',
  sampling: 'Same table-only compatibility filter; exclude every company-year report in v4 test/development and v5 test. Fixed SHA256 ordering, one question per page. Remove items only when original gold operands cannot be resolved to business cells after role classification. 60 pages, 57 reports, 38 companies; not the full FinQA benchmark.',
  timing: 'Core wall time includes runtime schema reconstruction, model calls, checks and local computation; excludes UI pacing. Schema time also recorded separately. Four concurrent jobs on the recorded host.',
  secondary: ['business-cell transmissions and unique cells', 'extra cells against original gold-program dependencies', 'agreement and review subgroups', 'calls and tokens', 'core wall time'],
  statistics: 'Average two repeats within each case; paired case-weighted report-cluster bootstrap, 4000 draws, seed 20260928. Descriptive 95% intervals; no population or non-inferiority claim.',
  failures: 'Retain wrong answers, parse/provider/program failures and possible original annotation inconsistencies. Resume missing job IDs only; no best-of-run selection or post-outcome changes to frozen code.',
  limits: ['Single provider/model and a restricted public subset; training exposure unknown.', 'Zero business cells does not mean zero information: questions, table labels, years, units and proposed programs are visible.', 'A minimum syntactic cover is neither a semantically sufficient view nor a privacy-optimal policy.', 'No completed human explanation-quality evaluation.', 'Deterministic adapter handles documented table patterns, not arbitrary PDF table extraction.'], hashes };
await mkdir(out, { recursive: true });
await writeFile(new URL('protocol.json', out), JSON.stringify(protocol, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ frozenAt: protocol.frozenAt, jobs: protocol.jobs, hashedFiles: files.length }));
