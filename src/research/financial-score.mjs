import {hash} from './local-program.mjs';
export function scoreFinancial(run,label){
 let transmitted=0,extra=0,integrity=true;const unique=new Set();
 for(const receipt of run.receipts){
  integrity&&=hash(receipt.rawBody)===receipt.sha256;
  const body=JSON.parse(receipt.rawBody),fields=Object.keys(JSON.parse(body.messages[1].content).facts);
  fields.forEach(k=>unique.add(k));transmitted+=fields.length;extra+=fields.filter(k=>!label.goldCells.includes(k)).length;
 }
 const value=run.result?.amount,numericCorrect=Number.isFinite(value)&&Math.abs(value-label.expected)<=label.tolerance;
 return {runId:run.id,caseId:run.caseId,method:run.evaluationMethod,sourceId:label.sourceId,sourceFile:label.sourceFile,
  status:run.status,structuredSuccess:run.status==='completed'&&numericCorrect&&integrity,numericCorrect,receiptIntegrity:integrity,
  answer:value??null,expected:label.expected,transmittedCells:transmitted,uniqueTransmittedCells:unique.size,
  extraGoldCells:extra,computedCells:run.programCertificates?.at(-1)?.dependencies.length||0,
  modelCalls:run.metrics.modelCalls,bytes:run.metrics.totalBytes,elapsedMs:run.metrics.elapsedMs,
  promptTokens:run.metrics.promptTokens,completionTokens:run.metrics.completionTokens,error:run.error};
}
