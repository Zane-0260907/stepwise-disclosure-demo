import { readFile } from 'node:fs/promises';
import { hash } from './local-program.mjs';
export async function correctedCases() {
  const rows = JSON.parse(await readFile(new URL('../../fixtures/finqa-v6/development.json', import.meta.url), 'utf8'));
  return rows.filter(item => item.id === 'finqa-47593c3344df').map(item => ({ ...item, requiresLive: true,
    correctedTable: true, source: `${item.id}.pdf`, datasetSource: item.source,
    title: { zh: '公开财务表格 · 核对结构与本地计算', en: 'Public table · structure and local calculation' },
    task: { zh: '依据原始财务表格回答营运资金变化问题，保留年份与列位置，核对本地计算和实际外发内容。', en: item.question } }));
}
export async function readCorrectedCase(id) {
  const item = (await correctedCases()).find(c => c.id === id); if (!item) throw Error('Unknown corrected table case');
  const source = await readFile(new URL('../../fixtures/finqa-v6/development.json', import.meta.url), 'utf8');
  return { ...item, document: { file: item.source, sourceArtifact: 'fixtures/finqa-v6/development.json', sha256: hash(source), bytes: Buffer.byteLength(source), pages: 1 } };
}
