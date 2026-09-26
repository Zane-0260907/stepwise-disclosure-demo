import { performance } from 'node:perf_hooks';
import { addEvent, acceptReceipt } from './engine.mjs';
import { createSealedRequestGate } from './sealed-request-v4.mjs';
import { financialPayload, executeFinancialRun } from './financial-execution-v6.mjs';
import { inspectCandidate, chooseConflictView, majorityCandidate } from './conflict-view.mjs';
import { buildTableView } from './table-view.mjs';

export const ADAPTIVE_METHODS = ['full_once', 'local_once', 'requested_cells', 'blind_review', 'conflict_review'];
export const PROPOSAL_INSTRUCTIONS = [
  'Derive the arithmetic from the question. Identify the requested quantity, its operands and their units before submitting the program.',
  'Solve independently by tracing each requested year, row and column. Check numerator versus denominator and old versus new before submitting the program.',
  'Solve independently by auditing the arithmetic direction and units. Check sums, changes and ratios; do not substitute an absolute difference for a ratio.'
];
const label = (zh, en) => ({ zh, en });

export async function executeAdaptiveFinancial(run, source, transport, { notify = () => {}, hook = async () => {} } = {}) {
  const method = run.method;
  if (!ADAPTIVE_METHODS.includes(method)) throw Error('Unknown adaptive method');
  const structuralStart = performance.now();
  const projected = buildTableView(source.originalTable, source.legacyFacts);
  if (JSON.stringify(projected.facts) !== JSON.stringify(source.facts) || JSON.stringify(projected.schema) !== JSON.stringify(source.schema)) throw Error('CACHED_SCHEMA_MISMATCH');
  source = { ...source, ...projected };
  const schemaStep = { id: `step-${run.steps.length + 1}`, operation: 'normalize_schema',
    title: label('核对表结构与数值角色','Verify table structure and numeric roles'),
    reason: label('保留原始列位置、年份和单位；业务数值仍在本地。','Preserve source column positions, years and units; business values remain local.'),
    location: 'local', status: 'running', startedAt: new Date().toISOString(), input: {}, retained: Object.keys(source.facts), checks: [], receipts: [], output: null };
  run.steps.push(schemaStep); addEvent(run, 'step.started', { stepId: schemaStep.id }, notify);
  schemaStep.output = { headerRows: projected.headerRows, promotedNumericHeaders: projected.classification.promotedNumericHeaders,
    businessCells: projected.schema.length }; schemaStep.status = 'completed'; schemaStep.finishedAt = new Date().toISOString();
  run.metrics.schemaMs = performance.now() - structuralStart; addEvent(run, 'step.completed', { stepId: schemaStep.id }, notify);
  if (['full_once', 'local_once', 'requested_cells'].includes(method)) {
    await executeFinancialRun(run, source, transport, { notify, hook, mode: {full_once:'eager_allowed',local_once:'local_program',requested_cells:'requested_cells'}[method] });
    run.evaluationMethod = method; run.protocol = 'research-v6-corrected-view';
    run.metrics.elapsedMs += run.metrics.schemaMs;
    return run;
  }
  const start = performance.now(), item = structuredClone(source);
  const gate = createSealedRequestGate(transport, notify);
  run.protocol = 'research-v6-corrected-view'; run.evaluationMethod = method;
  run.programCertificates = []; run.candidateRecords = []; run.disclosureDecision = null;
  let current;
  const begin = (operation, title, reason, location) => {
    const step = { id: `step-${run.steps.length + 1}`, operation, title, reason, location, status: 'running',
      startedAt: new Date().toISOString(), parentStepId: current?.id || null, input: {}, retained: [], checks: [], receipts: [], output: null };
    run.steps.push(step); current = step; addEvent(run, 'step.started', { stepId: step.id, title }, notify); return step;
  };
  const finish = (step, output) => {
    step.output = output; step.status = 'completed'; step.finishedAt = new Date().toISOString();
    addEvent(run, 'step.completed', { stepId: step.id }, notify);
  };
  const cloud = async (role, facts, candidates = []) => {
    const review = role === 'review';
    const step = begin('analyze', review ? label('依据补充视图复核计算','Review with the selected view') :
      label(`提出计算方案 ${role + 1}`, `Propose calculation ${role + 1}`),
      review ? label('仅发送获准补充字段和方案，不发送本地计算结果。','Send only the approved fields and programs; local results remain private.') :
        label('模型读取问题和表结构，原始数值留在本地。','Read the question and schema; retain raw values locally.'), 'cloud');
    if (review) step.introducedAtRuntime = true;
    const body = financialPayload(item, facts, run.model, 'local_program', 0);
    const content = JSON.parse(body.messages[1].content);
    content.planningInstruction = review ?
      'The proposed programs disagree or include an invalid proposal. Resolve the original question independently; all proposals can be wrong. Return one complete program, possibly different from every proposal. Supplied numeric facts are a limited authorized view; unprovided numbers are still available to the local interpreter. Do not ask for the whole table.' : PROPOSAL_INSTRUCTIONS[role];
    if (review) content.proposals = candidates.map(c => ({ program: c.certificate.program }));
    body.messages[1].content = JSON.stringify(content);
    step.input = structuredClone(facts); step.retained = Object.keys(item.facts).filter(f => !(f in facts));
    step.recipient = 'cloud-model'; step.plannedPolicyVersion = run.policy.version;
    gate.prepare({ run, step, item, view: facts, payload: body });
    if (run.condition === 'revoke_after_plan' && run.metrics.modelCalls === 0) run.policy = { allowed: false, version: run.policy.version + 1 };
    await hook('beforeSend', { run, step, item, view: facts, payload: body });
    addEvent(run, 'view.prepared', { stepId: step.id, keys: Object.keys(facts) }, notify);
    const envelope = await gate.transport.send(run, step, body, 'cloud-model');
    acceptReceipt(run, step, envelope.receipt, notify); run.metrics.modelCalls++;
    if (envelope.status !== 200) throw Error(`MODEL_HTTP_${envelope.status}: ${JSON.stringify(envelope.response?.error || {})}`);
    const response = envelope.response, message = response.choices?.[0]?.message;
    run.metrics.promptTokens += response.usage?.prompt_tokens || 0;
    run.metrics.completionTokens += response.usage?.completion_tokens || 0;
    step.providerResponse = { id: response.id, model: response.model, usage: response.usage, message };
    let candidate = null, error = null;
    try {
      if (message?.tool_calls?.length !== 1 || message.tool_calls[0].function.name !== 'submit_calculation') throw Error('ONE_PROGRAM_REQUIRED');
      const args = JSON.parse(message.tool_calls[0].function.arguments);
      if (!args || Object.keys(args).join() !== 'program') throw Error('INVALID_PROGRAM_ARGUMENTS');
      candidate = inspectCandidate(args.program, item);
    } catch (failure) { error = failure.message; }
    const record = { stepId: step.id, role, candidate, error };
    run.candidateRecords.push(record); finish(step, { proposedTool: message?.tool_calls?.[0] || null, validProgram: Boolean(candidate), error });
    return candidate;
  };
  try {
    addEvent(run, 'task.started', { caseId: item.id }, notify);
    const read = begin('read', label('读取本地表格','Read the local table'), label('原始数值及来源留在本地。','Keep source values and provenance locally.'), 'local');
    read.input = structuredClone(item.facts); finish(read, { question: item.question, cells: item.schema.length, source: item.source });
    const candidates = [];
    for (let index = 0; index < PROPOSAL_INSTRUCTIONS.length; index++) {
      const candidate = await cloud(index, {}); if (candidate) candidates.push(candidate);
    }
    if (!candidates.length) throw Error('NO_VALID_CANDIDATE');
    const unique = new Set(candidates.map(c => c.signature));
    const agreed = candidates.length === 3 && unique.size === 1;
    const decision = begin('choose_view', label('本地检查分歧并选择补充视图','Check disagreement and choose the next view'),
      label('比较计算结构和字段依赖；数值碰巧相等不视为方案一致。','Compare expressions and dependencies; coincidentally equal answers do not count as agreement.'), 'local');
    const coverage = chooseConflictView(candidates, item.schema.map(c => c.id), 3);
    const fields = agreed || method === 'blind_review' ? [] : coverage.fields;
    const shouldReview = !agreed;
    run.disclosureDecision = { agreed, validCandidates: candidates.length, distinctPrograms: unique.size, fields,
      review: shouldReview, coverage, method, reason: agreed ? 'structural-agreement' : 'review-disagreement' };
    decision.input = { signatures: candidates.map(c => c.signature), dependencies: candidates.map(c => c.certificate.dependencies.map(d => d.field)) };
    decision.retained = Object.keys(item.facts); finish(decision, run.disclosureDecision);
    if (shouldReview && method === 'conflict_review' && !coverage.covered) throw Error('DISCLOSURE_BUDGET_INSUFFICIENT');
    let selected = majorityCandidate(candidates);
    if (shouldReview) {
      selected = await cloud('review', Object.fromEntries(fields.map(f => [f, item.facts[f]])), candidates);
      if (!selected) throw Error('INVALID_REVIEW_PROGRAM');
    }
    const local = begin('evaluate_local', label('在本地完成所选计算','Execute the selected calculation locally'),
      label('校验后的表达式读取实际源值；结果不回传云端。','The checked expression reads actual source values; its result is not returned to the cloud.'), 'local');
    local.introducedAtRuntime = true; local.input = { program: selected.certificate.program };
    const checked = inspectCandidate(selected.certificate.program, item);
    run.programCertificates.push(checked.certificate); local.dependencies = checked.certificate.dependencies;
    local.retained = Object.keys(item.facts); finish(local, checked.certificate);
    run.result = { issueCodes: ['NUMERICAL_RESULT'], amount: checked.certificate.value, summary: String(checked.certificate.value), recommendation: '',
      evidenceIds: checked.certificate.dependencies.map(d => d.field), citations: [item.source] };
    run.report = `# FinQA · ${item.sourceId}\n\n${item.question}\n\nResult: ${run.result.amount}\n\nMethod: ${method}\n\nSource: ${item.source}\n\nSelected numeric fields: ${fields.join(', ') || '(none)'}\n\nProgram:\n\n\`\`\`json\n${JSON.stringify(checked.certificate.program, null, 2)}\n\`\`\`\n\nStructural agreement is not a proof of semantic correctness. Source values and the final result remain local except for the recorded approved fields.\n`;
    run.status = 'completed';
  } catch (error) {
    run.error = error.message; run.status = /BOUNDARY_|BUDGET|LOCAL_PROGRAM/.test(run.error) ? 'blocked' : 'failed';
    if (current) { current.status = run.status; current.error = run.error; current.finishedAt = new Date().toISOString(); }
    addEvent(run, 'run.error', { stepId: current?.id, message: run.error }, notify);
  } finally {
    run.finishedAt = new Date().toISOString(); run.metrics.elapsedMs = performance.now() - start + run.metrics.schemaMs;
    addEvent(run, `run.${run.status}`, { status: run.status }, notify);
  }
  return run;
}
