import { createHash } from 'node:crypto';
export function scoreValidation(run,expected){
 const result=run.result;
 const codes=(expected.acceptableCodeSets||[expected.expectedCodes]).some(set=>set.length===result?.issueCodes?.length&&set.every(c=>result.issueCodes.includes(c)));
 const amount=expected.expectedAmount===null?result?.amount===null:Math.abs((result?.amount??Infinity)-expected.expectedAmount)<.011;
 const reference=!expected.requiredReference||result?.citations?.includes(`synthetic-reference://${expected.requiredReference}`);
 let extra=0,missing=0,forbidden=0,integrity=true;const recipients={};
 for(const receipt of run.receipts){
   integrity&&=createHash('sha256').update(receipt.rawBody).digest('hex')===receipt.sha256;
   const body=JSON.parse(receipt.rawBody);
   const facts=receipt.recipient==='cloud-model'?JSON.parse(body.messages.find(m=>m.role==='user').content).facts:{reference_code:body.code,reference_version:body.version,...body.context};
   const keys=Object.keys(facts);
   const necessary=receipt.recipient==='reference-service'?['reference_code','reference_version']:[...expected.analysisNecessary,...('reference_text' in facts?['reference_text','reference_citation']:[])];
   const x=keys.filter(k=>!necessary.includes(k)).length;
   const m=necessary.filter(k=>!keys.includes(k)).length;
   extra+=x;missing+=m;
   forbidden+=keys.filter(k=>['identity','contact','account','internal_note','unrelated_record'].includes(k)).length;
   const r=recipients[receipt.recipient]||={requests:0,extra:0,missing:0};r.requests++;r.extra+=x;r.missing+=m;
 }
 return {runId:run.id,caseId:run.caseId,method:run.evaluationMethod||run.method,group:expected.group,family:run.family,
  status:run.status,structuredSuccess:run.status==='completed'&&codes&&amount&&reference&&integrity,
  classificationCorrect:codes,amountCorrect:amount,referenceCorrect:!!reference,receiptIntegrity:integrity,
  extraFacts:extra,missingFacts:missing,forbiddenFacts:forbidden,recipients,
  modelCalls:run.metrics.modelCalls,toolCalls:run.metrics.toolCalls,bytes:run.metrics.totalBytes,
  elapsedMs:run.metrics.elapsedMs,promptTokens:run.metrics.promptTokens,completionTokens:run.metrics.completionTokens,error:run.error,
  humanTextQuality:'pending'};
}
