import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hash } from '../src/research/local-program.mjs';
import { convert } from './finqa-conversion.mjs';

const root = new URL('../', import.meta.url), output = new URL('fixtures/finqa-v5/', root);
const load = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const oldCases = await load('fixtures/finqa-v4/cases.json');
const oldDev = await load('fixtures/finqa-v4/development.json');
const report = item => item.sourceFile.split('/').slice(0, 2).join('/');
const excludedReports = new Set([...oldCases, ...oldDev].map(report));
const raw = await load('data/research/finqa-source/test.json');
const eligible = raw.map(convert).filter(Boolean).filter(row => !excludedReports.has(report(row.item)));
eligible.sort((a, b) => hash('stepwise-v5-20260927/' + a.item.sourceId).localeCompare(hash('stepwise-v5-20260927/' + b.item.sourceId)));
const seen = new Set(), cases = [], labels = {};
for (const row of eligible) {
  if (seen.has(row.item.sourceFile)) continue;
  seen.add(row.item.sourceFile); cases.push({ ...row.item, split: 'test' }); labels[row.item.id] = row.label;
  if (cases.length === 60) break;
}
if (cases.length !== 60) throw Error(`Need 60 eligible unseen pages; found ${cases.length}`);
const oldLabels = await load('fixtures/finqa-v4/labels.json');
// Previously exposed inputs are development only. No v5 held-out outcome is consulted.
const development = [...oldDev, ...oldCases.slice(0, 6)].map(c => ({ ...c, split: 'development' }));
for (const item of development) labels[item.id] = oldLabels[item.id];
const provenance = { source: 'https://github.com/czyssrs/FinQA', commit: '0f16e2867befa6840783e58be38c9efb9229d742',
  seed: 'stepwise-v5-20260927', excludedReports: [...excludedReports].sort(), eligible: eligible.length,
  cases: cases.length, reports: new Set(cases.map(report)).size, companies: new Set(cases.map(c => c.sourceFile.split('/')[0])).size,
  selection: 'Same declared v4 table-only compatibility filter; exclude every company-year report used in v4 test/development; fixed SHA ordering; one question per page. Original labels are used for eligibility and scoring only.',
  limitation: 'Restricted public subset; prior model-training exposure is unknown. Development consists only of previously exposed v4 inputs.' };
await mkdir(output, { recursive: true });
for (const [file, value] of Object.entries({ 'cases.json': cases, 'development.json': development, 'labels.json': labels, 'provenance.json': provenance })) {
  await writeFile(new URL(file, output), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
await writeFile(new URL('LICENSE.FinQA', output), await readFile(new URL('fixtures/finqa-v4/LICENSE.FinQA', root)));
console.log(JSON.stringify({ cases: cases.length, reports: provenance.reports, companies: provenance.companies, eligible: eligible.length, development: development.length }));
