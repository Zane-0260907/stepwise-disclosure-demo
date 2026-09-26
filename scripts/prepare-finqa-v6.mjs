import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hash } from '../src/research/local-program.mjs';
import { buildTableView } from '../src/research/table-view.mjs';
import { convert } from './finqa-conversion.mjs';
const root = new URL('../', import.meta.url), output = new URL('fixtures/finqa-v6/', root);
try { await readFile(new URL('evidence/validation-v6/protocol.json', root)); throw Error('V6_ALREADY_FROZEN'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const load = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const prior = [...await load('fixtures/finqa-v4/cases.json'), ...await load('fixtures/finqa-v4/development.json'), ...await load('fixtures/finqa-v5/cases.json')];
const report = item => item.sourceFile.split('/').slice(0, 2).join('/');
const excluded = new Set(prior.map(report));
const rawTest = await load('data/research/finqa-source/test.json'), rawDev = await load('data/research/finqa-source/dev.json');
function corrected(source) {
  const parsed = convert(source); if (!parsed) return null;
  const view = buildTableView(source.table_ori || source.table, parsed.item.facts);
  if (parsed.label.goldCells.some(id => !(id in view.facts))) return null;
  return { item: { ...parsed.item, originalTable: source.table_ori || source.table, legacySchema: parsed.item.schema, legacyFacts: parsed.item.facts, ...view }, label: parsed.label };
}
const eligible = rawTest.map(corrected).filter(Boolean).filter(row => !excluded.has(report(row.item)));
eligible.sort((a, b) => hash('stepwise-v6-20260927/' + a.item.sourceId).localeCompare(hash('stepwise-v6-20260927/' + b.item.sourceId)));
const seen = new Set(), cases = [], labels = {};
for (const row of eligible) {
  if (seen.has(row.item.sourceFile)) continue;
  seen.add(row.item.sourceFile); cases.push({ ...row.item, split: 'test' }); labels[row.item.id] = row.label;
  if (cases.length === 60) break;
}
if (cases.length !== 60) throw Error(`Need 60 new pages; found ${cases.length}`);
const developmentIds = new Set([
  'finqa-4a8c8ca38cc4', 'finqa-47593c3344df', 'finqa-b5d77b96451c', 'finqa-d4800c218dd1', 'finqa-f14077426905', 'finqa-f260b7d116d2',
  ...(await load('fixtures/finqa-v4/development.json')).map(item => item.id)
]);
const development = [...rawDev, ...rawTest].map(corrected).filter(Boolean).filter(row => developmentIds.has(row.item.id)).map(row => {
  labels[row.item.id] = row.label; return { ...row.item, split: 'development' };
});
const provenance = { source: 'https://github.com/czyssrs/FinQA', commit: '0f16e2867befa6840783e58be38c9efb9229d742',
  seed: 'stepwise-v6-20260927', cases: cases.length, reports: new Set(cases.map(report)).size, companies: new Set(cases.map(c => c.sourceFile.split('/')[0])).size,
  eligible: eligible.length, excludedReports: [...excluded].sort(),
  selection: 'Same explicit table-only compatibility filter. Exclude every report used in v4 or v5; fixed SHA order; one question per source page. Gold numeric operands must remain business cells after header classification.',
  correction: 'Previous adapters hid some multirow year headers as numeric business cells and guessed incomplete column names. New inputs preserve the original header grid, explicitly promote leading unit/year rows, and do not invent merged spans. All methods receive the same corrected structure.',
  development: 'Six already observed v5 discrepancies and the six v4 development inputs; no v6 test output consulted.',
  limitation: 'Restricted public subset; gold annotations may be noisy and prior model-training exposure is unknown. No result-dependent exclusion or relabeling.' };
await mkdir(output, { recursive: true });
for (const [file, value] of Object.entries({ 'cases.json': cases, 'development.json': development, 'labels.json': labels, 'provenance.json': provenance })) await writeFile(new URL(file, output), JSON.stringify(value, null, 2) + '\n', { flag: process.argv.includes('--refresh-before-freeze') ? 'w' : 'wx' });
await writeFile(new URL('LICENSE.FinQA', output), await readFile(new URL('fixtures/finqa-v4/LICENSE.FinQA', root)));
console.log(JSON.stringify({ cases: cases.length, reports: provenance.reports, companies: provenance.companies, eligible: eligible.length, development: development.length }));
