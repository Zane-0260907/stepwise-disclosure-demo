import { performance } from 'node:perf_hooks';
import { ISSUE_CODES } from './catalog.mjs';

export const PII_FIELDS = ['identity', 'contact', 'account'];
export function neededFacts(item, operation = 'analyze') {
  if (operation === 'lookup_reference') return ['reference_code', 'reference_version'];
  const facts = item.facts;
  const keys = item.family === 'contract' ? ['clause'] : ['observations'];
  if (item.family === 'contract') {
    if (/合同总额/.test(facts.clause || '')) keys.push('amount');
    if (/迟延交货.*(?:计收|宽限期)/.test(facts.clause || '')) keys.push('late_days');
  } else if (/明确的学习支持筛查规则/.test(facts.observations || '')) keys.push('scores', 'homework', 'absences');
  if (facts.reference_code) keys.push('reference_code', 'reference_version');
  if (facts.reference_text) keys.push('reference_text', 'reference_citation');
  return keys;
}
export function selectFacts(facts, keys) {
  return Object.fromEntries(keys.filter((key) => facts[key] !== undefined).map((key) => [key, facts[key]]));
}
export function localAssessment(item) {
  if (!item.localCapabilities) return null;
  const f = item.facts;
  if (item.family === 'study' && f.observations?.startsWith('执行明确的学习支持筛查规则：')) {
    if (!Array.isArray(f.scores) || !f.scores.length || !f.scores.every(Number.isFinite) || !Number.isFinite(f.homework) || !Number.isFinite(f.absences)) return null;
    const avg = f.scores.reduce((a,b)=>a+b,0)/f.scores.length;
    const support = avg < 60 || f.homework < 70 || f.absences > 2;
    return { issueCodes: [support ? 'SUPPORT_NEEDED' : 'ON_TRACK'], amount: null, summary: `平均分 ${avg.toFixed(1)}；作业完成率 ${f.homework}%；缺勤 ${f.absences} 次。${support ? '满足学习支持条件。' : '当前未触发支持条件。'}`, recommendation: support ? '按未达标项目安排学习支持并复核后续记录。' : '保持当前学习安排，后续继续观察。', evidenceIds: ['observations','scores','homework','absences'], citations: [] };
  }
  if (item.family !== 'contract' || !Number.isFinite(f.late_days) || f.late_days < 0) return null;
  const s = f.clause; let amount = null, m;
  if ((m = /^迟延交货一次按合同总额 ([\d.]+)% 计收违约金。$/.exec(s)) && Number.isFinite(f.amount)) amount = f.late_days > 0 ? f.amount * Number(m[1])/100 : 0;
  else if ((m = /^迟延交货每天计收 ([\d.]+) 元违约金。$/.exec(s))) amount = f.late_days * Number(m[1]);
  else if ((m = /^迟延交货每天按合同总额 ([\d.]+)% 计收违约金，累计不超过合同总额 ([\d.]+)%。$/.exec(s)) && Number.isFinite(f.amount)) amount = Math.min(f.late_days * Number(m[1])/100, Number(m[2])/100) * f.amount;
  else if ((m = /^迟延交货享有 (\d+) 天宽限期，超出部分每天计收 ([\d.]+) 元违约金。$/.exec(s))) amount = Math.max(0, f.late_days-Number(m[1])) * Number(m[2]);
  else if ((m = /^迟延交货超过 (\d+) 天时一次计收 ([\d.]+) 元违约金。$/.exec(s))) amount = f.late_days > Number(m[1]) ? Number(m[2]) : 0;
  if (amount === null) return null;
  amount = Math.round(amount*100)/100;
  return { issueCodes: [amount > 0 ? 'PENALTY_APPLIES' : 'NO_ISSUE'], amount, summary: `依约定公式和实际迟延 ${f.late_days} 天核算，示例违约金额为 ${amount} 元。`, recommendation: '复核交货日期与条款适用条件；本结果为按输入条款计算，不判断法律效力。', evidenceIds: neededFacts(item), citations: [] };
}
export function chooseView(item, method, entryView, operation = 'analyze') {
  const needed = neededFacts(item, operation);
  if (method === 'full') return structuredClone(item.facts);
  if (method === 'pii') return Object.fromEntries(Object.entries(item.facts).filter(([key]) => !PII_FIELDS.includes(key)));
  if (method === 'entry') return { ...structuredClone(entryView), ...selectFacts(item.facts, ['reference_text','reference_citation']) };
  return selectFacts(item.facts, needed);
}
export function checkBoundary({ item, view, operation, recipient, expectedRecipient, policy, version, method, finalBody, recheck = true }) {
  const start = performance.now();
  if (recheck && (!policy.allowed || policy.version !== version)) throw new Error('POLICY_CHANGED: 规划后权限已变化，尚未发送的请求被阻止。');
  if (recipient !== expectedRecipient) throw new Error('RECIPIENT_CHANGED: 接收方与已核准执行计划不一致。');
  const necessary = neededFacts(item, operation);
  for (const key of necessary) if (view[key] === undefined || view[key] === null || view[key] === '') throw new Error(`MISSING_INPUT: 缺少操作必需信息 ${key}`);
  if (['joint','per_step'].includes(method)) {
    for (const key of Object.keys(view)) if (!necessary.includes(key)) throw new Error(`EXTRA_FIELD: ${key}`);
    for (const key of ['identity','contact','account','internal_note','unrelated_record']) {
      const value = item.facts[key];
      if (value && finalBody.includes(String(value))) throw new Error(`FORBIDDEN_VALUE: ${key} 进入最终请求`);
    }
  }
  return { checkedAt: new Date().toISOString(), policyVersion: policy.version, allowedFields: Object.keys(view), overheadMs: performance.now()-start };
}
export const REFERENCE_TOOL = {
  type: 'function', function: { name: 'lookup_reference', description: '查询任务指定的合成参考资料及确切版本。只在尚未获得对应资料时调用。', parameters: { type: 'object', properties: { code: { type:'string' }, version: { type:'string' } }, required: ['code','version'], additionalProperties: false } },
};
export function modelPayload(item, view, model) {
  return {
    model, temperature: 0, max_tokens: 650,
    tools: [REFERENCE_TOOL], tool_choice: view.reference_text ? 'none' : 'auto',
    messages: [{ role:'system', content: `你是合成研究案例的分析执行器。只分析当前任务所需事实，不使用或转发无关身份与业务信息。若事实指定reference_code和reference_version但尚无reference_text，先调用lookup_reference读取确切版本；不能猜测资料内容。资料已提供时不要重复查询。不要把逾期履约直接当成逾期付款。不要判断法律效力。学习任务中的“执行明确的学习支持筛查规则”必须按该规则计算，其他学习记录识别主要问题。仅在条款公式和必需数值明确时计算违约金额，否则amount为null。最终只返回JSON：{"issueCodes":[问题代码],"amount":数字或null,"summary":"简短中文依据","recommendation":"简短中文建议","evidenceIds":[实际使用的事实键],"citations":[实际查得的资料citation]}。可用问题代码：${ISSUE_CODES.join(', ')}。正常合同用NO_ISSUE，存在确定违约金额用PENALTY_APPLIES；学习规则判定用SUPPORT_NEEDED或ON_TRACK。自由文本学习记录使用PRACTICE_GAP、ATTENDANCE_GAP、WORKLOAD_HIGH、CONCEPT_GAP或CONSISTENCY_GAP。代码根据输入选择，不凭空补造事实。` },
      { role:'user', content: JSON.stringify({ task: item.task.zh, outputFocus: 'issueCodes只选择最主要的一项问题。建议和问题的后果不另算一个分类。', facts: view }) }],
  };
}
export function parseAssessment(message) {
  const text = message?.content?.trim()?.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed; try { parsed = JSON.parse(text); } catch { throw new Error('INVALID_OUTPUT: 模型未返回约定的结构化结果。'); }
  if (!Array.isArray(parsed.issueCodes) || !parsed.issueCodes.length || !parsed.issueCodes.every((c)=>ISSUE_CODES.includes(c))) throw new Error('INVALID_OUTPUT: 问题分类缺失或无效。');
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim() || typeof parsed.recommendation !== 'string') throw new Error('INVALID_OUTPUT: 解释或建议缺失。');
  if (parsed.amount !== null && !Number.isFinite(parsed.amount)) throw new Error('INVALID_OUTPUT: 金额格式错误。');
  if (!Array.isArray(parsed.evidenceIds) || !Array.isArray(parsed.citations)) throw new Error('INVALID_OUTPUT: 依据格式错误。');
  return parsed;
}
