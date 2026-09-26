import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { scoreValidation } from '../src/research/validation-score.mjs';
const version=process.argv[2]||'v3';if(!['v2','v3'].includes(version))throw new Error('Use v2 or v3');
const root=new URL('../',import.meta.url),out=new URL(`evidence/validation-${version}/`,root);
const protocol=JSON.parse(await readFile(new URL('protocol.json',out),'utf8'));
const dir=new URL(`data/research/validation/${protocol.id}/`,root);
const done=JSON.parse(await readFile(new URL('complete.json',dir),'utf8'));assert.equal(done.done,protocol.jobs);
for(const[file,hash]of Object.entries(protocol.hashes))assert.equal(createHash('sha256').update(await readFile(new URL(file,root))).digest('hex'),hash,`Frozen file changed: ${file}`);
const labels=JSON.parse(await readFile(new URL(`fixtures/validation-${version}/labels.json`,root),'utf8'));
const rows=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(rows.length,protocol.jobs);assert.equal(new Set(rows.map(r=>r.jobId)).size,rows.length);
const providers=[];for(const name of await readdir(new URL('provider-egress/',dir)))if(name.endsWith('.json'))providers.push(JSON.parse(await readFile(new URL(`provider-egress/${name}`,dir),'utf8')));
let verifiedProviderCalls=0;const failures=[];
for(const row of rows){
 const run=JSON.parse(await readFile(new URL(`${row.runId}.json`,dir),'utf8'));
 const actual=scoreValidation(run,labels[row.caseId]);
 for(const[key,value]of Object.entries(actual))assert.deepEqual(row[key],value,`${row.jobId}/${key}`);
 for(const receipt of run.receipts.filter(r=>r.recipient==='cloud-model')){
  const record=providers.find(p=>p.receiverBodySha256===receipt.sha256&&p.responseSha256===receipt.responseSha256);
  assert.ok(record,`Missing provider record ${row.runId}`);
  assert.equal(createHash('sha256').update(record.providerBody).digest('hex'),record.providerBodySha256);
  const expected={...JSON.parse(receipt.rawBody),thinking:{type:'disabled'}};
  assert.deepEqual(JSON.parse(record.providerBody),expected);verifiedProviderCalls++;
 }
 if(!row.structuredSuccess)failures.push({jobId:row.jobId,runId:run.id,error:run.error,expected:labels[row.caseId],actual:run.result});
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const quantile=(a,q)=>{const s=[...a].sort((a,b)=>a-b),i=(s.length-1)*q;return s[Math.floor(i)]+(s[Math.ceil(i)]-s[Math.floor(i)])*(i-Math.floor(i));};
let seed=20260926;const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const ci=values=>{const boots=[];for(let b=0;b<2000;b++)boots.push(mean(values.map(()=>values[Math.floor(rand()*values.length)])));return [quantile(boots,.025),quantile(boots,.975)];};
const caseIds=Object.keys(labels),groups=[...new Set(rows.map(r=>r.group))];
const aggregates=[];
for(const method of protocol.methods)for(const id of caseIds){
 const r=rows.filter(r=>r.caseId===id&&r.method===method);assert.equal(r.length,protocol.repetitions);
 aggregates.push({method,caseId:id,group:labels[id].group,success:mean(r.map(r=>Number(r.structuredSuccess))),extra:mean(r.map(r=>r.extraFacts)),missing:mean(r.map(r=>r.missingFacts)),modelCalls:mean(r.map(r=>r.modelCalls)),bytes:mean(r.map(r=>r.bytes)),elapsedMs:mean(r.map(r=>r.elapsedMs)),factRequests:mean(r.map(r=>r.factRequestCount||0))});
}
const summarize=(method,group)=>{
 const r=rows.filter(x=>x.method===method&&(!group||x.group===group)),a=aggregates.filter(x=>x.method===method&&(!group||x.group===group));
 return {method,group:group||'all',cases:a.length,runs:r.length,passed:r.filter(r=>r.structuredSuccess).length,success:mean(a.map(a=>a.success)),successCI:ci(a.map(a=>a.success)),extraFacts:mean(a.map(a=>a.extra)),missingFacts:mean(a.map(a=>a.missing)),forbiddenFacts:r.reduce((s,r)=>s+r.forbiddenFacts,0),modelCalls:r.reduce((s,r)=>s+r.modelCalls,0),toolCalls:r.reduce((s,r)=>s+r.toolCalls,0),factRequests:r.reduce((s,r)=>s+(r.factRequestCount||0),0),promptTokens:r.reduce((s,r)=>s+r.promptTokens,0),completionTokens:r.reduce((s,r)=>s+r.completionTokens,0),latencyP50:quantile(r.map(r=>r.elapsedMs),.5),latencyP95:quantile(r.map(r=>r.elapsedMs),.95)};
};
const paired={};for(const comparator of protocol.methods.filter(m=>m!=='joint')){
 const differences=caseIds.map(id=>aggregates.find(a=>a.method==='joint'&&a.caseId===id).success-aggregates.find(a=>a.method===comparator&&a.caseId===id).success);
 paired[`joint_vs_${comparator}`]={difference:mean(differences),descriptiveCaseBootstrap95:ci(differences)};
}
const summary={protocolId:protocol.id,sourceCompletedAt:done.finishedAt,model:protocol.model,jobs:rows.length,verifiedProviderCalls,
 primary:'strict structured-task outcome, not free-text quality',summary:protocol.methods.map(m=>summarize(m)),byGroup:groups.flatMap(g=>protocol.methods.map(m=>summarize(m,g))),paired,
 limits:['Author-created synthetic inputs in two domains, not an independently collected benchmark.','Case-level bootstrap is descriptive; templates are designed and not population samples.','No cross-paper superiority claim; these are in-repository mechanism controls.','Human quality review pending.','v2 was used to develop v3; only v3 prospective runs evaluate the new mechanism.','No semantic privacy or completeness guarantee for model-requested business fields.']};
await mkdir(out,{recursive:true});
await writeFile(new URL('summary.json',out),JSON.stringify(summary,null,2)+'\n');
await writeFile(new URL('scores.jsonl',out),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
await writeFile(new URL('case-aggregates.json',out),JSON.stringify(aggregates,null,2)+'\n');
await writeFile(new URL('failures.json',out),JSON.stringify(failures,null,2)+'\n');
const table=summary.summary.map(r=>`| ${r.method} | ${r.passed}/${r.runs} | ${(100*r.success).toFixed(1)}% | ${r.extraFacts.toFixed(2)} | ${r.modelCalls} | ${r.factRequests} |`).join('\n');
await writeFile(new URL('RESULTS.md',out),`# ${protocol.id}\n\nProtocol frozen before these model calls. All ${rows.length} planned jobs are retained; ${verifiedProviderCalls} provider calls have matched receiver and provider-egress records.\n\n| Method | Passed | Structured success | Extra facts/task | Model calls | Fact requests |\n| :-- | --: | --: | --: | --: | --: |\n${table}\n\nThese values describe controlled synthetic inputs. Human prose ratings are pending. See summary.json for predefined strata, paired intervals and limitations. Raw provider responses and failures are retained in the reproduction archive.\n`);
console.log(JSON.stringify({version,jobs:rows.length,verifiedProviderCalls,summary:summary.summary,paired},null,2));
