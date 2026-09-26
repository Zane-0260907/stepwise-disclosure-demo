import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hash,evaluateLocalProgram} from '../src/research/local-program.mjs';
import {scoreFinancial} from '../src/research/financial-score.mjs';
import {scoreValidation} from '../src/research/validation-score.mjs';
const root=new URL('../',import.meta.url),mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantile=(a,q)=>{const s=[...a].sort((a,b)=>a-b),p=(s.length-1)*q;return s[Math.floor(p)]+(s[Math.ceil(p)]-s[Math.floor(p)])*(p%1);};
const newId=process.argv.find(x=>x.startsWith('--run-id='))?.slice(9);
if(newId&&!/^[a-zA-Z0-9_-]{1,90}$/.test(newId))throw Error('Invalid run-id');
if(newId&&!process.argv.includes('--finqa')&&!process.argv.includes('--controls'))throw Error('Use --finqa or --controls with a new run-id');
for(const suite of process.argv.includes('--finqa')?['finqa']:process.argv.includes('--controls')?['controls']:['finqa','controls']){
 const published=new URL(`evidence/validation-v4/${suite}/`,root),protocol=JSON.parse(await readFile(new URL('protocol.json',published),'utf8'));
 for(const [file,expected]of Object.entries(protocol.hashes))assert.equal(hash(await readFile(new URL(file,root),'utf8')),expected,`Changed frozen file: ${file}`);
 const dir=new URL(`data/research/validation/${newId||protocol.id}/`,root),done=JSON.parse(await readFile(new URL('complete.json',dir),'utf8'));
 const out=newId?new URL('analysis/',dir):published;await mkdir(out,{recursive:true});
 const rows=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(done.done,protocol.jobs);assert.equal(rows.length,protocol.jobs);assert.equal(new Set(rows.map(r=>r.jobId)).size,rows.length);
 const prefix=suite==='finqa'?'finqa-v4':'validation-v3';
 const items=JSON.parse(await readFile(new URL(`fixtures/${prefix}/cases.json`,root),'utf8'));
 const labels=JSON.parse(await readFile(new URL(`fixtures/${prefix}/labels.json`,root),'utf8'));
 const providers=[];for(const file of await readdir(new URL('provider-egress/',dir)))if(file.endsWith('.json'))providers.push(JSON.parse(await readFile(new URL(`provider-egress/${file}`,dir),'utf8')));
 const unused=new Set(providers.map(p=>p.id)),failures=[];let verifiedProviderCalls=0;
 for(const row of rows){
  const run=JSON.parse(await readFile(new URL(`${row.runId}.json`,dir),'utf8')),item=items.find(i=>i.id===row.caseId);
  assert.ok(item);assert.deepEqual(run.input,item.facts);
  const actual=suite==='finqa'?scoreFinancial(run,labels[row.caseId]):scoreValidation(run,labels[row.caseId]);
  for(const [key,value]of Object.entries(actual))assert.deepEqual(row[key],value,`${row.jobId}/${key}`);
  if(suite==='finqa'&&run.result){
   const certificate=run.programCertificates.at(-1),allowed=run.evaluationMethod==='requested_cells'?Object.keys(JSON.parse(JSON.parse(run.receipts.at(-1).rawBody).messages[1].content).facts):Object.keys(item.facts);
   const recomputed=evaluateLocalProgram(certificate.program,item.facts,allowed);
   assert.deepEqual(certificate,recomputed);assert.equal(run.result.amount,recomputed.value);
  }
  for(const receipt of run.receipts.filter(r=>r.recipient==='cloud-model')){
   const record=providers.find(p=>unused.has(p.id)&&p.receiverBodySha256===receipt.sha256&&p.responseSha256===receipt.responseSha256);
   assert.ok(record,`No distinct provider record for ${row.jobId}`);unused.delete(record.id);
   assert.equal(hash(record.providerBody),record.providerBodySha256);
   assert.deepEqual(JSON.parse(record.providerBody),{...JSON.parse(receipt.rawBody),thinking:{type:'disabled'}});
   verifiedProviderCalls++;
  }
  if(!row.structuredSuccess)failures.push({jobId:row.jobId,runId:run.id,expected:labels[row.caseId],actual:run.result,error:run.error});
 }
 assert.equal(unused.size,0,'Unmatched provider calls');
 const cases=[];
 for(const item of items)for(const method of protocol.methods){
  const rs=rows.filter(r=>r.caseId===item.id&&r.method===method);assert.equal(rs.length,protocol.repetitions);
  cases.push({caseId:item.id,method,cluster:suite==='finqa'?item.sourceFile.split('/').slice(0,2).join('/'):item.id,
   group:suite==='finqa'?'FinQA table subset':item.stratum,success:mean(rs.map(r=>+r.structuredSuccess)),
   extra:mean(rs.map(r=>suite==='finqa'?r.extraGoldCells:r.extraFacts)),disclosed:mean(rs.map(r=>suite==='finqa'?r.transmittedCells:r.extraFacts)),
   calls:mean(rs.map(r=>r.modelCalls)),tokens:mean(rs.map(r=>r.promptTokens+r.completionTokens)),elapsedMs:mean(rs.map(r=>r.elapsedMs))});
 }
 let seed=20260927;const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
 function interval(values){const samples=[];for(let i=0;i<4000;i++)samples.push(mean(values.map(()=>values[Math.floor(random()*values.length)])));return [quantile(samples,.025),quantile(samples,.975)];}
 const summary=protocol.methods.map(method=>{
  const rs=rows.filter(r=>r.method===method),cs=cases.filter(r=>r.method===method);
  return {method,runs:rs.length,passed:rs.filter(r=>r.structuredSuccess).length,success:mean(cs.map(c=>c.success)),
   extra:mean(cs.map(c=>c.extra)),disclosed:mean(cs.map(c=>c.disclosed)),modelCalls:rs.reduce((a,r)=>a+r.modelCalls,0),
   promptTokens:rs.reduce((a,r)=>a+r.promptTokens,0),completionTokens:rs.reduce((a,r)=>a+r.completionTokens,0),
   latencyP50:quantile(rs.map(r=>r.elapsedMs),.5),latencyP95:quantile(rs.map(r=>r.elapsedMs),.95)};
 });
 const target=suite==='finqa'?'local_program':'joint',clusters=[...new Set(cases.map(c=>c.cluster))],paired={};
 for(const method of protocol.methods.filter(m=>m!==target)){
  const deltas=clusters.map(cluster=>{
   const ids=cases.filter(c=>c.cluster===cluster&&c.method===target).map(c=>c.caseId);
   return ids.map(id=>cases.find(c=>c.caseId===id&&c.method===target).success-cases.find(c=>c.caseId===id&&c.method===method).success);
  });
  const boots=[];for(let b=0;b<4000;b++)boots.push(mean(deltas.flatMap(()=>deltas[Math.floor(random()*deltas.length)])));
  paired[`${target}_vs_${method}`]={caseMeanDifference:mean(deltas.flat()),descriptiveClusterBootstrap95:[quantile(boots,.025),quantile(boots,.975)],clusters:clusters.length};
 }
 const result={protocolId:protocol.id,sourceCompletedAt:done.finishedAt,jobs:rows.length,verifiedProviderCalls,summary,paired,
  limits:[protocol.source,protocol.inference,protocol.scope,'Counts describe observed disclosure through registered requests, not resistance to reconstruction or inference.']};
 for(const [file,value]of Object.entries({'summary.json':result,'case-aggregates.json':cases,'failures.json':failures}))await writeFile(new URL(file,out),JSON.stringify(value,null,2)+'\n');
 await writeFile(new URL('scores.jsonl',out),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 await writeFile(new URL('RESULTS.md',out),`# ${protocol.id}\n\n${rows.length} planned tasks; ${verifiedProviderCalls} separately matched provider calls. All failed tasks remain in the denominator.\n\n| Method | Correct | Success | ${suite==='finqa'?'Raw cells transmitted/task':'Extra fields/task'} | Calls | P50 seconds |\n|:--|--:|--:|--:|--:|--:|\n${summary.map(s=>`| ${s.method} | ${s.passed}/${s.runs} | ${(100*s.success).toFixed(1)}% | ${s.disclosed.toFixed(3)} | ${s.modelCalls} | ${(s.latencyP50/1000).toFixed(2)} |`).join('\n')}\n\n${result.limits.join('\n\n')}\n`);
 console.log(JSON.stringify({suite,...result},null,2));
}
