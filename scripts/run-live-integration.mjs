import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {executeLiveModelGraph} from '../src/research/live-model-execution.mjs';
import {createNumericReceiver,executeModelGraph,CONDITIONS} from '../src/research/model-repair-v8.mjs';
import {hash,evaluateLocalProgram} from '../src/research/local-program.mjs';
const root=new URL('../',import.meta.url),out=new URL('evidence/frontier-study/',root),load=async p=>JSON.parse(await readFile(new URL(p,root)));
const cases=await load('fixtures/model-repair-v8/cases.json'),dir=new URL('data/research/validation/frozen-v8-20260927/',root);
const methods=['budget_0','live_budget_0'],receiver=await createNumericReceiver(),records=[];
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b));
try{
 for(const name of (await readdir(dir)).filter(f=>f.endsWith('.model.json')).sort()){
  const model=JSON.parse(await readFile(new URL(name,dir))),item=cases.find(c=>c.id===model.caseId);
  for(const condition of CONDITIONS)for(const method of methods){
   const run=await(method==='budget_0'?executeModelGraph:executeLiveModelGraph)(item,model,condition,method,receiver);
   if(run.status==='completed'){
    const expected=evaluateLocalProgram(model.program,run.finalFacts,Object.keys(run.finalFacts)).value;
    assert.ok(close(run.value,expected),'Program result mismatch');
    const tokens=new Set();let fields=0;
    for(const event of run.events.filter(e=>e.type==='request.sent')){
     const receipt=run.receipts.find(r=>r.bodySha256===event.bodySha256);
     assert.ok(receipt);assert.equal(hash(receipt.body),receipt.bodySha256);assert.deepEqual(JSON.parse(receipt.body),event.payload);event.tokens.forEach(t=>tokens.add(t));
     fields+=event.payload.kind==='source'?Object.keys(event.payload.facts).length:event.payload.args.filter(a=>!a.constant).length;
    }
    assert.equal(tokens.size,run.metrics.uniqueDisclosures);assert.equal(fields,run.metrics.numericFields);
   }
   records.push(run);
  }
 }
 const compact=records.map(r=>({caseId:r.caseId,modelRecordId:r.modelRecordId,condition:r.condition,method:r.method,status:r.status,value:r.value,disclosures:r.disclosures,metrics:{...r.metrics,elapsedMs:undefined,planningMs:undefined},requestBodies:r.receipts.map(x=>x.body),finalFacts:r.finalFacts}));
 if(process.argv.includes('--check')){const expected=await load('evidence/frontier-study/integration-check.json'),actual=JSON.parse(JSON.stringify(compact));assert.equal(actual.length,expected.length);for(let i=0;i<actual.length;i++)assert.deepEqual(actual[i],expected[i],actual[i].modelRecordId+':'+actual[i].condition+':'+actual[i].method);console.log(JSON.stringify({verifiedIntegrationRuns:records.length,receipts:records.reduce((s,r)=>s+r.receipts.length,0)}));}
 else{
  await mkdir(out,{recursive:true});await writeFile(new URL('integration-records.json',out),JSON.stringify(records,null,2)+'\n');await writeFile(new URL('integration-check.json',out),JSON.stringify(compact,null,2)+'\n');
  console.log(JSON.stringify({runs:records.length,completed:records.filter(r=>r.status==='completed').length,receipts:records.reduce((s,r)=>s+r.receipts.length,0),newModelCalls:0}));
 }
}finally{await receiver.close();}
