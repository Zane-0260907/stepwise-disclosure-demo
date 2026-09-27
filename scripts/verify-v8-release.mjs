import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hash} from '../src/research/local-program.mjs';
import {subgraph,ancestors,MODEL_SYSTEM,MODEL_TOOLS} from '../src/research/model-repair-v8.mjs';
const root=new URL('../',import.meta.url),load=async p=>JSON.parse(await readFile(new URL(p,root)));
const protocol=await load('evidence/validation-v8/protocol.json');
for(const [p,h]of Object.entries(protocol.hashes))assert.equal(hash(await readFile(new URL(p,root),'utf8')),h,'Frozen file: '+p);
const name=process.argv.find(a=>a.startsWith('--run-id='))?.slice(9)||'frozen-v8-20260927';if(!/^[a-z0-9-]+$/i.test(name))throw Error('INVALID_RUN_ID');
const base=`data/research/validation/${name}/`,manifest=await load(base+'run.json');assert.equal(manifest.protocolSha256,hash(JSON.stringify(protocol)));
const cases=await load('fixtures/model-repair-v8/cases.json'),labels=await load('fixtures/model-repair-v8/labels.json'),rows=[],modelRows=[];
// Separate straight-line evaluator; does not use the controller's cache or evaluator.
const op=(name,a,b)=>{switch(name){case'add':return a+b;case'subtract':return a-b;case'multiply':return a*b;case'divide':return a/b;case'min':return Math.min(a,b);case'max':return Math.max(a,b);default:throw Error('OP');}};
function evaluate(program,facts){const values=[];for(const e of program)values.push(op(e.op,...e.args.map(a=>'field'in a?facts[a.field]:'step'in a?values[a.step]:a.constant)));return values;}
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b));
const right=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=0.00005*Math.max(1,Math.abs(b));
for(const item of cases)for(let repeat=0;repeat<protocol.repeats;repeat++){
 const id=`${name}-${item.id}-${repeat}`,model=await load(base+id+'.model.json');assert.equal(model.caseId,item.id);assert.equal(model.id,id);
 let tokens=0;
 for(const [i,c]of model.calls.entries()){
  assert.equal(hash(c.requestBody),c.requestSha256);assert.equal(hash(c.responseBody),c.responseSha256);
  const provider=model.providerRecords.find(p=>p.receiverBodySha256===c.requestSha256&&p.responseSha256===c.responseSha256);assert.ok(provider,'Missing independent provider record');
  assert.equal(hash(provider.providerBody),provider.providerBodySha256);assert.equal(provider.responseStatus,c.status);
  assert.equal(provider.endpoint,'https://api.deepseek.com/chat/completions');
  const p=JSON.parse(provider.providerBody),q=JSON.parse(c.requestBody);assert.deepEqual(p,{...q,thinking:{type:'disabled'}});assert.deepEqual(q.tools,MODEL_TOOLS);
  assert.deepEqual(q.messages[0],{role:'system',content:MODEL_SYSTEM});assert.deepEqual(q.messages[1],{role:'user',content:JSON.stringify({requestId:id,question:item.question})});
  if(i===1){assert.deepEqual(JSON.parse(q.messages[3].content),{schema:item.schema,tableStructure:item.tableStructure,headerRows:item.headerRows});}
  const response=JSON.parse(c.responseBody);tokens+=response.usage?.total_tokens||0;
 }
 if(model.status==='ready'){
  assert.equal(model.calls.length,2);const proposal=JSON.parse(model.calls[1].responseBody).choices[0].message.tool_calls[0];
  assert.equal(proposal.id,model.parentToolCallId);assert.equal(proposal.function.name,'submit_calculation');assert.deepEqual(JSON.parse(proposal.function.arguments).program,model.program);
 }
 const original=model.status==='ready'?evaluate(model.program,item.facts).at(-1):null;
 modelRows.push({id,caseId:item.id,status:model.status,nodes:model.program?.length||0,calls:model.calls.length,tokens,originalCorrect:right(original,labels[item.id].expected)});
 for(const condition of protocol.conditions)for(const method of protocol.methods){
  const run=await load(base+`${id}.${condition}.${method}.json`);assert.equal(run.modelRecordId,id);assert.equal(run.condition,condition);assert.equal(run.method,method);
  if(model.status!=='ready'){assert.equal(run.status,'model_failed');rows.push({caseId:item.id,repeat,condition,method,status:run.status,correct:false,uniqueDisclosures:0,numericFields:0,bytes:0,remoteCalls:0,executions:0,work:0,reused:0,planningMs:0});continue;}
  assert.deepEqual(run.events[0].program,model.program);
  let facts={...item.facts},versions=Object.fromEntries(Object.keys(facts).map(f=>[f,1])),localOps=condition==='all_local'?['add','subtract','multiply','divide','min','max']:['add','subtract'],fields=0,bytes=0,calls=0,executions=0,work=0,phase=0,phaseFields=0;
  const history=new Set(),receiptIds=new Set(),nodeValues=new Map();
  const stamp=i=>hash({program:subgraph(model.program,i),sources:ancestors(model.program,i).fields.map(f=>[f,versions[f]])});
  const token=a=>'constant'in a?null:'numeric-service:'+('field'in a?`field:${a.field}:${versions[a.field]}`:`derived:${stamp(a.step)}`);
  const checkBudget=()=>{const d=run.decisions.find(d=>d.phase===phase);if(d?.budget!==null&&d?.budget!==undefined)assert.ok(phaseFields<=d.budget,'Phase budget exceeded');};
  for(const event of run.events){
   if(event.type==='request.sent'){
    const receipt=run.receipts.find(r=>r.bodySha256===event.bodySha256&&!receiptIds.has(r.id));assert.ok(receipt);assert.ok(!receiptIds.has(receipt.id));receiptIds.add(receipt.id);assert.equal(hash(receipt.body),receipt.bodySha256);assert.equal(Buffer.byteLength(receipt.body),receipt.bytes);assert.deepEqual(JSON.parse(receipt.body),event.payload);
    const i=event.index,payload=event.payload;assert.equal(payload.node,i);assert.equal(payload.runId,run.id);
    let expectedTokens,n;
    if(payload.kind==='source'){
     assert.deepEqual(payload.program,subgraph(model.program,i));const fs=ancestors(model.program,i).fields;assert.deepEqual(payload.facts,Object.fromEntries(fs.map(f=>[f,facts[f]])));expectedTokens=fs.map(f=>token({field:f}));n=fs.length;
    }else{
     assert.equal(payload.op,model.program[i].op);assert.equal(payload.args.length,2);expectedTokens=[];n=0;
     model.program[i].args.forEach((a,j)=>{const expected='field'in a?facts[a.field]:'constant'in a?a.constant:nodeValues.get(a.step)?.value;assert.equal(payload.args[j].value,expected);if('step'in a)assert.equal(nodeValues.get(a.step)?.stamp,stamp(a.step),'Stale intermediate');const t=token(a);if(t){assert.equal(payload.args[j].token,t);expectedTokens.push(t);n++;}else assert.equal(payload.args[j].constant,true);});
    }
    assert.deepEqual(event.tokens,expectedTokens);expectedTokens.forEach(t=>history.add(t));fields+=n;phaseFields+=n;bytes+=receipt.bytes;calls++;
    assert.ok(close(receipt.value,evaluate(model.program,facts)[i]),'Wrong receiver result');
   }
   if(event.type==='node.completed'){
    assert.ok(close(event.value,evaluate(model.program,facts)[event.index]));assert.equal(event.stamp,stamp(event.index));
    if(event.location==='local')assert.ok(localOps.includes(model.program[event.index].op));
    nodeValues.set(event.index,{value:event.value,stamp:event.stamp});executions++;work+=event.view==='source'?ancestors(model.program,event.index).steps.length:1;
   }
   if(event.type==='state.changed'){
    checkBudget();phase++;phaseFields=0;assert.deepEqual(event.before.facts,facts);assert.equal(event.controlled,true);
    const expected={...facts};if(event.field){assert.ok(['source_used','source_unrelated'].includes(condition));expected[event.field]=expected[event.field]*1.01+0.5;versions[event.field]++;}
    assert.deepEqual(event.after.facts,expected);facts=expected;localOps=condition==='capability_withdrawn'?[]:localOps;assert.deepEqual(event.after.localOps,localOps);
    for(const i of event.retained)assert.equal(nodeValues.get(i)?.stamp,stamp(i));for(const i of event.invalidated)nodeValues.delete(i);
   }
  }
  checkBudget();assert.equal(run.receipts.length,calls);assert.equal(run.metrics.uniqueDisclosures,history.size);assert.equal(run.metrics.numericFields,fields);assert.equal(run.metrics.bytes,bytes);assert.equal(run.metrics.remoteCalls,calls);assert.equal(run.metrics.executions,executions);assert.equal(run.metrics.work,work);
  assert.deepEqual(run.finalFacts,facts);const expected=evaluate(labels[item.id].gold,facts).at(-1),executionConsistent=run.status==='completed'&&close(run.value,evaluate(model.program,facts).at(-1));
  rows.push({caseId:item.id,repeat,condition,method,status:run.status,correct:run.status==='completed'&&right(run.value,expected),executionConsistent,...run.metrics});
 }
}
const aggregate=records=>Object.fromEntries(protocol.methods.map(method=>{const rs=records.filter(x=>x.method===method),sum=k=>rs.reduce((n,r)=>n+(r[k]||0),0);return[method,{runs:rs.length,completed:rs.filter(r=>r.status==='completed').length,correct:rs.filter(r=>r.correct).length,executionConsistent:rs.filter(r=>r.executionConsistent).length,...Object.fromEntries(['uniqueDisclosures','numericFields','bytes','remoteCalls','executions','work','reused','planningMs'].map(k=>[k,sum(k)]))}];}));
const summary={protocol:protocol.id,verifiedAt:new Date().toISOString(),scope:'24 public financial questions; 2 model plans per question; the same real model plan is shared across 5 controlled conditions and 6 paired controller arms. Arms are not independent LLM runs.',model:{graphs:modelRows.length,ready:modelRows.filter(x=>x.status==='ready').length,originalCorrect:modelRows.filter(x=>x.originalCorrect).length,calls:modelRows.reduce((n,r)=>n+r.calls,0),tokens:modelRows.reduce((n,r)=>n+r.tokens,0),nodes:modelRows.map(x=>x.nodes)},methods:aggregate(rows),conditions:Object.fromEntries(protocol.conditions.map(c=>[c,aggregate(rows.filter(r=>r.condition===c))])),statisticalUnit:'24 source questions; repeats, conditions and methods within a question are dependent.',models:modelRows};
const output=name==='frozen-v8-20260927'?'evidence/validation-v8/':base+'analysis/';await mkdir(new URL(output,root),{recursive:true});
await writeFile(new URL(output+'scores.jsonl',root),rows.map(x=>JSON.stringify(x)).join('\n')+'\n');await writeFile(new URL(output+'summary.json',root),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({graphs:modelRows.length,arms:rows.length,model:summary.model,methods:summary.methods},null,2));
