import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=new URL('../',import.meta.url);
const sources=['evidence/validation-v8/summary.json','evidence/validation-v8/analysis.json','evidence/development-v10/analysis.json','evidence/development-v10/paired-replay.json','evidence/requirement-demo/trace.json'];
const loaded=await Promise.all(sources.map(async p=>{
  const bytes=await readFile(new URL(p,base)),value=JSON.parse(bytes);
  const canonical=structuredClone(value);
  // This verifier writes a new audit timestamp on every successful run. It is
  // not an experimental observation and must not invalidate identical scores.
  if(p==='evidence/validation-v8/summary.json')delete canonical.verifiedAt;
  return {path:p,sha256:createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),value};
}));
const [v8,analysis,v10,paired,contract]=loaded.map(x=>x.value);
assert.equal(v8.model.ready,v8.model.graphs);
const order=['native-full-local-confirmation','native-tokenized-local-confirmation','native-scoped-local-confirmation'];
const rows=order.map(id=>v10.matchedSummary.find(r=>r.method===id));assert.ok(rows.every(Boolean));
const result={scope:'Counts from separate studies are never pooled. V10 is development-only; the constructed contract check is not a task benchmark.',
  sourceDigest:'SHA-256 of parsed JSON serialized compactly in original key order; top-level verifiedAt is excluded from the financial summary only.',
  sources:loaded.map(({path,sha256})=>({path,sha256})),
  financial:{questions:new Set(v8.models.map(x=>x.caseId)).size,modelCalls:v8.model.calls,plans:v8.model.graphs,labelMatches:v8.model.originalCorrect,
    runsPerMethod:v8.methods.repair_greedy.runs,allExecutions:Object.values(v8.methods).reduce((n,r)=>n+r.runs,0),
    restartCalls:v8.methods.restart_greedy.remoteCalls,reuseCalls:v8.methods.repair_greedy.remoteCalls,
    restartFields:v8.methods.restart_greedy.numericFields,reuseFields:v8.methods.repair_greedy.numericFields,
    retainedComputations:v8.methods.repair_greedy.reused,reductionPct:analysis.remoteCallsReductionPct,
    interval:analysis.clusterBootstrap.percentile95,
    planningMethodsAgree:['repair_frontier','budget_0','budget_10','budget_25'].every(k=>['uniqueDisclosures','numericFields','remoteCalls'].every(f=>v8.methods[k][f]===v8.methods.repair_greedy[f]))},
  business:{uniqueTasks:new Set(v10.matchedCases.map(x=>x.caseId)).size,attempts:v10.inventory.reduce((n,r)=>n+r.attempts,0),
    allModelCalls:v10.inventory.reduce((n,r)=>n+r.calls,0),allTokens:v10.inventory.reduce((n,r)=>n+r.tokens,0),
    methods:rows.map(({method,attempts,stateMatches,agentCalls,protectedToolLeavesShownRaw,bindingGuardRefusals,protocolViolations})=>({method,attempts,stateMatches,agentCalls,protectedToolLeavesShownRaw,bindingGuardRefusals,protocolViolations}))},
  mechanism:paired.totals,
  constructedCheck:{stages:contract.steps.length,httpRequests:contract.receipts.length,cumulativeItems:contract.steps.at(-1).cumulativeItems,modelCalls:0}};
const planningBytes=await readFile(new URL('evidence/frontier-study/summary.json',base));
const planning=JSON.parse(planningBytes);
result.planning={final:planning.final,serialTiming:planning.serialTiming,integration:planning.integration};
result.sources.push({path:'evidence/frontier-study/summary.json',sha256:createHash('sha256').update(planningBytes).digest('hex'),digest:'exact file bytes'});
const out=new URL('paper/zh-CN/evidence.json',base);
if(process.argv.includes('--check'))assert.deepEqual(JSON.parse(await readFile(out,'utf8')),result);
else{await mkdir(new URL('.',out),{recursive:true});await writeFile(out,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({paperEvidence:'verified',financialQuestions:result.financial.questions,businessTasks:result.business.uniqueTasks,pairedActions:result.mechanism.actionsCompared}));
