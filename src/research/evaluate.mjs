import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
let labels;
export async function evaluateRun(run) {
  labels ||= JSON.parse(await readFile(new URL('../../fixtures/research/ground-truth.json',import.meta.url),'utf8'));
  const expected=labels[run.caseId];if(!expected)throw new Error('No evaluation label for case');
  const issues=run.result?.issueCodes||[];
  const classificationCorrect=(expected.acceptableCodeSets||[expected.expectedCodes]).some(set=>set.length===issues.length && set.every(code=>issues.includes(code)));
  const amountCorrect=expected.expectedAmount===null?run.result?.amount===null:Math.abs((run.result?.amount??Infinity)-expected.expectedAmount)<.011;
  const referenceCorrect=!expected.requiredReference||run.result?.citations?.some(c=>c===`synthetic-reference://${expected.requiredReference}`);
  let unnecessary=0,total=0,forbidden=0,receiptIntegrity=true;const recipients={};
  for(const receipt of run.receipts){
    receiptIntegrity &&= createHash('sha256').update(receipt.rawBody).digest('hex')===receipt.sha256;
    const body=JSON.parse(receipt.rawBody);
    let fields;
    if(receipt.recipient==='cloud-model')fields=Object.keys(JSON.parse(body.messages.find(m=>m.role==='user').content).facts);
    else fields=['reference_code','reference_version',...Object.keys(body.context||{})];
    const necessary=receipt.recipient==='reference-service'?['reference_code','reference_version']:[...expected.analysisNecessary,...(body.messages?.some(m=>m.content.includes('"reference_text"'))?['reference_text','reference_citation']:[])];
    const extra=fields.filter(f=>!necessary.includes(f));
    const blocked=fields.filter(f=>['identity','contact','account','internal_note','unrelated_record'].includes(f));
    unnecessary+=extra.length;total+=fields.length;forbidden+=blocked.length;
    const r=recipients[receipt.recipient]||={totalFacts:0,unnecessaryFacts:0,requests:0};r.totalFacts+=fields.length;r.unnecessaryFacts+=extra.length;r.requests++;
  }
  return {runId:run.id,caseId:run.caseId,family:run.family,method:run.method,status:run.status,
    structuredTaskSuccess:run.status==='completed'&&classificationCorrect&&amountCorrect&&referenceCorrect&&receiptIntegrity,
    classificationCorrect,amountCorrect,referenceCorrect,receiptIntegrity,unnecessaryFactTransmissions:unnecessary,totalFactTransmissions:total,forbiddenFactTransmissions:forbidden,recipients,
    modelCalls:run.metrics.modelCalls,toolCalls:run.metrics.toolCalls,promptTokens:run.metrics.promptTokens,completionTokens:run.metrics.completionTokens,bytes:run.metrics.totalBytes,elapsedMs:run.metrics.elapsedMs,
    controlMs:run.metrics.controlMs,humanTextQuality:'not_reviewed',error:run.error,
  };
}
