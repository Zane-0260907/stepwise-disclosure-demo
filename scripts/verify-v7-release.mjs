// Release verifier: preserve frozen verify-v7.mjs; see evidence/validation-v7/verifier-amendment.md.
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),evidence=new URL('evidence/validation-v7/',root),protocol=JSON.parse(await readFile(new URL('protocol.json',evidence)));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(protocol.hashes))assert.equal(hash(await readFile(new URL(p,root))),h,'frozen hash '+p);
const name=process.argv.find(x=>x.startsWith('--run-id='))?.split('=')[1]||'frozen-v7-20260927';if(!/^[a-z0-9-]+$/i.test(name))throw Error('INVALID_RUN_ID');
const dir=new URL(`data/research/validation/${name}/`,root),fixtures=JSON.parse(await readFile(new URL('fixtures/repair-v7/cases.json',root))),cases=new Map(fixtures.map(c=>[c.id,c]));
const manifest=JSON.parse(await readFile(new URL('run.json',dir)));assert.equal(manifest.protocol,protocol.id);assert.equal(manifest.protocolSha256,hash(await readFile(new URL('protocol.json',evidence))));assert.equal(manifest.executions,protocol.executions);
const files=(await readdir(dir)).filter(x=>x.endsWith('.json')&&!['run.json','summary.json'].includes(x)),rows=[],seen=new Set();let receiptCount=0,externalChecks=0;
for(const file of files){
 const r=JSON.parse(await readFile(new URL(file,dir))),item=cases.get(r.caseId);assert.ok(item);assert.ok(protocol.methods.includes(r.method));const pair=r.caseId+'/'+r.method;assert.ok(!seen.has(pair));seen.add(pair);assert.deepEqual(r.initial,item.values);assert.ok(Date.parse(r.startedAt)>=Date.parse(protocol.frozenAt));
 let versions=Object.fromEntries(Object.keys(item.values).map(k=>[k,1])),values=structuredClone(item.values),stale=0,unauthorized=0,previousHistory=0,planIndex=0;const outputs={};
 for(const event of r.events){
  if(event.type==='planned'){
   const decision=r.decisions[planIndex++],kind=event.choice.split(':')[1],total=values.base*values.factor*values.units;
   const wanted=kind==='compact'?(event.operation==='quote'?{daily:values.base*values.factor,units:values.units}:event.operation==='record'?{bounded:Math.min(total,values.limit)}:{total,limit:values.limit}):event.operation==='quote'?{base:values.base,factor:values.factor,units:values.units}:{base:values.base,factor:values.factor,units:values.units,limit:values.limit};
   assert.deepEqual(event.view,wanted);assert.deepEqual(decision.view,wanted);
  }
  if(event.type==='state.changed')for(const c of event.changes){assert.equal(versions[c.key],c.before.version);assert.deepEqual(values[c.key],c.before.value);versions[c.key]=c.after.version;values[c.key]=c.after.value;}
  if('historySize'in event){assert.ok(event.historySize>=previousHistory);previousHistory=event.historySize;}
  if(event.type==='executed'){
   const fresh=Object.entries(event.versions).every(([k,v])=>versions[k]===v);assert.equal(event.validAtDispatch,fresh);if(!fresh)stale++;
   const permitted=values.allow&&(event.recipient==='local'?values.local:event.recipient===values.endpointA?values.allowA:event.recipient===values.endpointB?values.allowB:false);
   assert.equal(event.feasibleAtDispatch,Boolean(permitted));if(!permitted)unauthorized++;outputs[event.operation]=event.output;
  }
 }
 assert.deepEqual(values,r.final);assert.deepEqual(versions,r.finalVersions);assert.equal(stale,r.metrics.staleDispatches);assert.equal(unauthorized,r.metrics.unauthorizedDispatches);
 // Independent arithmetic specification; do not import the runtime evaluator.
 const amount=values.base*values.factor*values.units,expected=Object.fromEntries(r.tasks.map(op=>[op,op==='quote'?amount:op==='flag'?amount>values.limit:Math.min(amount,values.limit)]));
 const correct=Object.entries(expected).every(([op,v])=>typeof v==='number'?Math.abs(outputs[op]-v)<1e-7:outputs[op]===v);
 const feasible=Boolean(values.allow&&(values.local||values.allowA||values.allowB));
 const success=feasible?r.status==='completed'&&correct&&!stale&&!unauthorized:r.status==='blocked'&&!stale&&!unauthorized;
 assert.equal(r.evaluation.success,success);assert.equal(r.evaluation.correct,correct);assert.deepEqual(r.evaluation.expected,expected);
 const tokens=new Set();let fields=0;
 for(const receipt of r.receipts){const body=JSON.parse(receipt.rawBody),decision=r.decisions[receipt.decisionIndex];assert.equal(receipt.runId,r.id);assert.equal(body.runId,r.id);assert.equal(body.recipient,decision.recipient);assert.deepEqual(body.view,decision.view);assert.equal(receipt.sha256,hash(receipt.rawBody));assert.equal(receipt.bytes,Buffer.byteLength(receipt.rawBody));fields+=Object.keys(body.view).length;
  const calculated=Object.entries(body.view).map(([field,value])=>JSON.stringify([body.recipient,field,hash(JSON.stringify({value,versions:decision.lineage[field]}))]));assert.deepEqual(receipt.tokens,calculated);calculated.forEach(t=>tokens.add(t));receiptCount++;}
 assert.equal(tokens.size,r.metrics.newDisclosures);assert.deepEqual([...tokens].sort(),r.disclosures);assert.equal(fields,r.metrics.transmittedFields);assert.equal(r.receipts.length,r.metrics.calls);
 if(r.method.startsWith('freshctx')){assert.equal(r.externalGuard.library,'freshctx');assert.equal(r.externalGuard.version,'0.16.0');assert.ok(r.externalGuard.audit.length>0);assert.equal(r.externalGuard.executed,r.externalGuard.state==='CURRENT');externalChecks++;}
 rows.push({caseId:r.caseId,method:r.method,event:r.mutation,status:r.status,success,correct,stale,unauthorized,calls:r.metrics.calls,disclosures:r.metrics.newDisclosures,fields,local:r.metrics.localExecutions,repaired:r.metrics.repaired,reused:r.metrics.reused,planningMs:r.metrics.planningMs,elapsedMs:r.metrics.elapsedMs,peakLabels:r.metrics.peakLabels});
}
assert.equal(rows.length,protocol.executions);for(const item of fixtures)for(const method of protocol.methods)assert.ok(seen.has(item.id+'/'+method));
const aggregate=list=>({executions:list.length,success:list.filter(x=>x.success).length,correct:list.filter(x=>x.correct).length,stale:list.reduce((s,x)=>s+x.stale,0),unauthorized:list.reduce((s,x)=>s+x.unauthorized,0),calls:list.reduce((s,x)=>s+x.calls,0),disclosures:list.reduce((s,x)=>s+x.disclosures,0),fields:list.reduce((s,x)=>s+x.fields,0),reused:list.reduce((s,x)=>s+x.reused,0)});
const summary={protocol:protocol.id,executions:rows.length,cases:fixtures.length,receiptCount,externalChecks,methods:Object.fromEntries(protocol.methods.map(m=>[m,aggregate(rows.filter(r=>r.method===m))])),strata:Object.fromEntries(protocol.eventTypes.map(event=>[event,Object.fromEntries(protocol.methods.map(m=>[m,aggregate(rows.filter(r=>r.method===m&&r.event===event))]))]))};
const output=name==='frozen-v7-20260927'?evidence:new URL('analysis/',dir);await mkdir(output,{recursive:true});
await writeFile(new URL('summary.json',output),JSON.stringify(summary,null,2)+'\n');await writeFile(new URL('scores.jsonl',output),rows.sort((a,b)=>a.caseId.localeCompare(b.caseId)||a.method.localeCompare(b.method)).map(x=>JSON.stringify(x)).join('\n')+'\n');console.log(JSON.stringify({executions:rows.length,receipts:receiptCount,externalChecks,methods:summary.methods},null,2));
