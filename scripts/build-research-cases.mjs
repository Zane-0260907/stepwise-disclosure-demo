import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = fileURLToPath(new URL('../fixtures/research/', import.meta.url));
await mkdir(out, { recursive: true });
const cases = [], truth = {}, references = [];
const contractAmbiguities = [
 ['逾期履约按合同额 10% 支付违约金，但未说明履约指交货、验收还是付款。', 'UNDEFINED_TRIGGER'],
 ['迟延交货时按合同额的一定比例支付违约金，比例尚未约定。', 'MISSING_RATE'],
 ['迟延交货时支付 5% 违约金，但没有约定计算基数。', 'MISSING_BASE'],
 ['迟延交货每天按合同额 3% 支付违约金，条款未设累计上限。', 'MISSING_CAP'],
 ['交货迟延每天支付 200 元，但从哪个日期开始计算尚未确定。', 'MISSING_START'],
 ['验收通过后付款，但验收标准和验收责任人尚未约定。', 'AMBIGUOUS_ACCEPTANCE'],
 ['正文约定验收后 30 天付款，附件约定验收后 60 天付款，未约定优先顺序。', 'CONFLICTING_TERMS'],
 ['供应商应尽快交货，合同未填写约定交货日。', 'MISSING_DEADLINE'],
 ['供应商应承担相关责任，但条款没有列明责任范围和具体义务。', 'UNDEFINED_OBLIGATION'],
 ['采购方付款后安排交货，但条款没有规定从付款到交货的期限。', 'MISSING_DEADLINE'],
];
const schoolObservations = [
 ['课堂测验掌握基础概念，但课后练习经常未完成，近两周仅完成三分之一。', 'PRACTICE_GAP'],
 ['作业与测验表现正常，近期连续缺席三次课程，缺课造成学习进度落后。', 'ATTENDANCE_GAP'],
 ['同时承担五门课程项目，提交时间集中，本人反馈无法安排时间。', 'WORKLOAD_HIGH'],
 ['练习都按时完成，但持续混淆导数与积分的基本概念。', 'CONCEPT_GAP'],
 ['同一难度测验分数在 90 和 45 之间交替，学习时间缺少规律。', 'CONSISTENCY_GAP'],
 ['能口述解题思路，但缺少独立动手训练，练习提交频繁空白。', 'PRACTICE_GAP'],
 ['基础作业正确，因多次缺课未学到新增章节内容。', 'ATTENDANCE_GAP'],
 ['阅读和作业量同时上升，计划超过每天可用时间，任务积压。', 'WORKLOAD_HIGH'],
 ['投入时间充足，但不能区分充分条件与必要条件，错题集中在概念辨析。', 'CONCEPT_GAP'],
 ['短期突击后停学多日，阶段表现波动很大，缺少持续复习。', 'CONSISTENCY_GAP'],
];
for (const family of ['contract', 'study']) {
  for (let n = 0; n < 30; n++) {
    const stratum = n < 10 ? 'local' : n < 20 ? 'cloud' : 'tool';
    const id = `${family}-${String(n + 1).padStart(2, '0')}`;
    const facts = {
      identity: family === 'contract' ? `合成采购方${n + 1} / 合成供应方${n + 1}` : `合成学生${n + 1}`,
      contact: `模拟联系人${n + 1}；电话 1390000${String(n + 1).padStart(4, '0')}`,
      account: `LOCAL-${family.toUpperCase()}-${String(n + 1).padStart(4, '0')}`,
      internal_note: `仅限内部：${family === 'contract' ? '下一季度谈判底价与利润目标' : '内部人员安排与联络备注'}-${n + 1}`,
      unrelated_record: `其他项目记录：${family === 'contract' ? '办公用品采购预算' : '其他班级活动预算'}-${n + 1}`,
    };
    let expectedCodes, expectedAmount = null, necessary;
    if (family === 'contract') {
      facts.payment_terms = n % 2 ? '验收通过后 30 天付款' : '交货验收后 15 天付款';
      if (stratum === 'local') {
        const type = Math.floor(n / 2), late = n % 2 ? 0 : 5;
        facts.amount = 100000 + n * 8000; facts.late_days = late;
        const rows = [
          ['迟延交货一次按合同总额 2% 计收违约金。', late > 0 ? facts.amount * .02 : 0],
          ['迟延交货每天计收 200 元违约金。', late * 200],
          ['迟延交货每天按合同总额 0.1% 计收违约金，累计不超过合同总额 0.3%。', Math.min(late * .001, .003) * facts.amount],
          ['迟延交货享有 3 天宽限期，超出部分每天计收 300 元违约金。', Math.max(0, late - 3) * 300],
          ['迟延交货超过 2 天时一次计收 1000 元违约金。', late > 2 ? 1000 : 0],
        ];
        facts.clause = rows[type][0]; expectedAmount = Math.round(rows[type][1] * 100) / 100;
        expectedCodes = [expectedAmount > 0 ? 'PENALTY_APPLIES' : 'NO_ISSUE'];
        necessary = ['clause', 'late_days', ...(type === 0 || type === 2 ? ['amount'] : [])];
      } else {
        const index = n % 10;
        const [clause, code] = contractAmbiguities[index];
        if (stratum === 'cloud') facts.clause = clause;
        else {
          facts.reference_code = `C${String(index + 1).padStart(2, '0')}`;
          facts.reference_version = index % 2 ? '2026.2' : '2026.1';
          facts.clause = `本合同违约与付款责任采用示例条款 ${facts.reference_code}（版本 ${facts.reference_version}），请查阅该条款后指出其中需要复核的缺口。`;
          references.push({ code: facts.reference_code, version: facts.reference_version, text: clause, citation: `synthetic-reference://${facts.reference_code}/${facts.reference_version}`, title: `采购示例条款 ${facts.reference_code}` });
        }
        expectedCodes = [code]; necessary = ['clause', ...(stratum === 'tool' ? ['reference_code', 'reference_version'] : [])];
      }
    } else {
      if (stratum === 'local') {
        const rows = [
          [[42, 49, 53], 95, 0], [[82, 85, 90], 95, 0], [[75, 80, 83], 40, 0], [[70, 73, 78], 90, 0],
          [[85, 88, 89], 90, 4], [[65, 70, 75], 85, 1], [[50, 53, 57], 45, 4], [[60, 60, 60], 70, 2],
          [[88, 91, 94], 60, 3], [[62, 66, 71], 75, 1],
        ];
        [facts.scores, facts.homework, facts.absences] = rows[n];
        facts.observations = '执行明确的学习支持筛查规则：平均分低于60，或作业完成率低于70%，或缺勤超过2次时，标记需要支持；否则标记正常。';
        expectedCodes = [(facts.scores.reduce((a,b)=>a+b,0)/3 < 60 || facts.homework < 70 || facts.absences > 2) ? 'SUPPORT_NEEDED' : 'ON_TRACK'];
        necessary = ['observations', 'scores', 'homework', 'absences'];
      } else {
        const [observation, code] = schoolObservations[n % 10];
        facts.observations = observation;
        expectedCodes = [code]; necessary = ['observations'];
        if (stratum === 'tool') {
          facts.reference_code = `S${String(n % 10 + 1).padStart(2, '0')}`;
          facts.reference_version = n % 2 ? '2026.2' : '2026.1';
          references.push({ code: facts.reference_code, version: facts.reference_version, text: `针对以下学习记录：${observation} 本版建议：先安排一次基础诊断，再按具体薄弱点分配短时练习，每周复核进度。`, citation: `synthetic-reference://${facts.reference_code}/${facts.reference_version}`, title: `学习资源 ${facts.reference_code}` });
          necessary.push('reference_code', 'reference_version');
        }
      }
    }
    const title = family === 'contract'
      ? { zh: `${stratum === 'local' ? '标准条款核算' : stratum === 'cloud' ? '合同条款复核' : '查阅条款资料'} · ${n + 1}`, en: `Contract ${stratum} case ${n + 1}` }
      : { zh: `学习分析 · ${n + 1}`, en: `Study ${stratum} case ${n + 1}` };
    const task = family === 'contract'
      ? { zh: '检查合同条款，核算能够确定的违约金额，指出需要复核的问题；遇到引用条款先查阅对应版本，再生成风险提示。', en: 'Review the contract, calculate a penalty only when defined, check cited references, and report issues requiring review.' }
      : { zh: '根据学习记录识别需要支持的方面并给出建议；如果指定了学习资源，先查询指定版本，再在本地生成针对该学生的建议。', en: 'Identify learning support needs, consult any specified resource version, and produce a local student report.' };
    cases.push({ id, family, stratum, split: 'evaluation', title, task, facts, source: `${id}.pdf`, localCapabilities: true });
    truth[id] = { expectedCodes, acceptableCodeSets: expectedCodes[0]==='UNDEFINED_TRIGGER' ? [['UNDEFINED_TRIGGER'],['UNDEFINED_OBLIGATION']] : [expectedCodes], expectedAmount, analysisNecessary: necessary, requiredReference: stratum === 'tool' ? `${facts.reference_code}/${facts.reference_version}` : null, expectedLocal: stratum === 'local', labelsBy: '预先人工可核对的规则与语义标签；自由文本人工质量复核尚未完成' };
  }
}
// Development uses separate inputs and is never included in the held-out evaluation.
for (const family of ['contract', 'study']) for (const [j, index] of [0, 2, 10, 13, 20, 24].entries()) {
  const original = cases.find((c) => c.id === `${family}-${String(index + 1).padStart(2, '0')}`);
  const dev = structuredClone(original); dev.id = `dev-${family}-${j+1}`; dev.split = 'development'; dev.source = `${dev.id}.pdf`;
  dev.facts.identity = `开发样本 ${family} ${j+1}`;
  if (dev.facts.amount) dev.facts.amount += 17000;
  if(family==='contract' && j===2)dev.facts.clause='合同写明迟延履约应付违约金，但是“履约”没有具体指向交付、验收还是支付价款。';
  if(family==='contract' && j===3)dev.facts.clause='每日应按合同额收取3%的交货迟延违约金，但没有任何累计限额。';
  if(family==='study' && j===2)dev.facts.observations='能讲清概念却不做巩固题，本周练习本大部分留白。';
  if(family==='study' && j===3)dev.facts.observations='持续投入学习时间，却把函数的导数和积分含义弄反，需要补足概念理解。';
  cases.push(dev);
  const label = structuredClone(truth[original.id]);
  if (j === 0 && family === 'contract') label.expectedAmount = dev.facts.amount * .02;
  truth[dev.id] = label;
}
const text = JSON.stringify(cases, null, 2) + '\n';
await writeFile(path.join(out, 'cases.json'), text);
await writeFile(path.join(out, 'ground-truth.json'), JSON.stringify(truth, null, 2) + '\n');
await writeFile(path.join(out, 'references.json'), JSON.stringify(references, null, 2) + '\n');
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({ version: '1.0', evaluationCases: 60, developmentCases: 12, caseSha256: createHash('sha256').update(text).digest('hex'), synthetic: true, provenance: 'Controlled synthetic workloads; labels are evaluation-only. Development and evaluation share operation families; no claim of unseen-template generalization.', humanTextReview: 'pending' }, null, 2));
console.log('Created 60 evaluation cases, 12 development cases, and 20 versioned reference records.');
