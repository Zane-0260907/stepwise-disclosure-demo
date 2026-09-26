import { readFile } from 'node:fs/promises';

export const METHODS = ['full', 'pii', 'entry', 'per_step', 'joint'];
export const METHOD_NAMES = {
  full: { zh: '完整上下文', en: 'Full context' }, pii: { zh: '普通脱敏', en: 'PII masking' },
  entry: { zh: '入口裁剪', en: 'Entry-only view' }, per_step: { zh: '逐次裁剪 · 固定执行域', en: 'Per-call view · fixed placement' },
  joint: { zh: '逐步执行与共享判定', en: 'Stepwise execution and disclosure' },
};
export const ISSUE_CODES = ['NO_ISSUE', 'PENALTY_APPLIES', 'UNDEFINED_TRIGGER', 'MISSING_RATE', 'MISSING_BASE', 'MISSING_CAP', 'MISSING_START', 'AMBIGUOUS_ACCEPTANCE', 'CONFLICTING_TERMS', 'MISSING_DEADLINE', 'UNDEFINED_OBLIGATION', 'SUPPORT_NEEDED', 'ON_TRACK', 'PRACTICE_GAP', 'ATTENDANCE_GAP', 'WORKLOAD_HIGH', 'CONCEPT_GAP', 'CONSISTENCY_GAP'];
export const LABELS = {
  identity: ['姓名 / 合同方', 'Identity / parties'], contact: ['联系人 / 电话', 'Contact'], account: ['内部账号', 'Internal account'],
  internal_note: ['内部备注', 'Internal note'], unrelated_record: ['无关业务记录', 'Unrelated record'],
  clause: ['待检查条款', 'Clause'], amount: ['合同金额', 'Contract amount'], late_days: ['迟延天数', 'Days late'],
  payment_terms: ['付款条件', 'Payment terms'], observations: ['学习记录', 'Study observations'], scores: ['成绩', 'Scores'],
  homework: ['作业完成率', 'Homework completion'], absences: ['缺勤次数', 'Absences'],
  reference_code: ['参考资料编号', 'Reference code'], reference_version: ['资料版本', 'Reference version'],
  reference_text: ['查询所得资料', 'Retrieved reference'], reference_citation: ['资料出处', 'Reference citation'],
};
let catalog;
export async function loadCases() {
  catalog ||= JSON.parse(await readFile(new URL('../../fixtures/research/cases.json', import.meta.url), 'utf8'));
  return structuredClone(catalog);
}
export async function getCase(id) {
  const item = (await loadCases()).find((entry) => entry.id === id);
  if (!item) throw new Error('案例不存在 / Unknown case');
  return item;
}
export function publicCase(item) {
  return { id: item.id, family: item.family, split: item.split, title: item.title, task: item.task, facts: item.facts, source: item.source };
}
