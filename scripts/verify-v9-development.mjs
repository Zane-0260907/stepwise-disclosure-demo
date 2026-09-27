import {readFile,readdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const name=process.argv[2]||'dev-v9-strong-02';
if(!/^dev-v9-[a-z0-9-]+$/.test(name))throw Error('INVALID_RUN_ID');
const directory=resolve('data/research/v9-runs',name);
const protocol=JSON.parse(await readFile(resolve(directory,'protocol.json'),'utf8'));
for(const [path,digest]of Object.entries(protocol.sourceHashes))assert.equal(sha(await readFile(resolve(directory,'frozen',basename(path)),'utf8')),digest,'frozen '+path);
const casesText=await readFile(resolve(directory,'frozen/cases.json'),'utf8');assert.equal(sha(casesText),protocol.caseSha256);
const evaluation=JSON.parse(await readFile(resolve(directory,'evaluation-snapshot.json'),'utf8'));
assert.equal(sha(await readFile(resolve(directory,'frozen/labels.json'),'utf8')),evaluation.labelsSha256);
assert.equal(sha(await readFile(resolve(directory,'frozen/score-v9-development.py'),'utf8')),evaluation.scorerSha256);
const cases=new Map(JSON.parse(casesText).map(x=>[x.id,x]));
const {createViewRuntime}=await import(pathToFileURL(resolve(directory,'frozen/view-runtime-v9.mjs')).href);
const providerDir=resolve(directory,'provider-egress');const providers=[];
for(const f of await readdir(providerDir))providers.push(JSON.parse(await readFile(resolve(providerDir,f),'utf8')));
let count=0,calls=0,leaves=0;
for(const caseId of protocol.caseIds)for(const method of protocol.methods){
 const r=JSON.parse(await readFile(resolve(directory,caseId+'--'+method+'.json'),'utf8'));const item=cases.get(caseId);
 assert.equal(r.caseId,caseId);assert.equal(r.method,method);assert.equal(r.calls.length,r.metrics.modelCalls);
 const runtime=createViewRuntime(item.tables,{mode:method==='deferred'?'deferred':'eager'});const handles=new Map();
 const initial={question:item.question,tables:runtime.schema(),answerFormat:item.answerFormat};
 if(method==='full'){
  initial.records={};for(const table of Object.keys(item.tables))initial.records[table]=runtime.run('open_table',{table}).rows;
 }
 const history=[{role:'system',content:protocol.system},{role:'user',content:JSON.stringify(initial)}];
 const mapArgs=args=>JSON.parse(JSON.stringify(args),(key,value)=>key==='handle'?handles.get(value)||value:value);
 for(const action of r.actions){
  let result,error;try{result=runtime.run(action.name,mapArgs(action.args));}catch(e){error=e.message;result={error};}
  assert.equal(error? 'rejected':'completed',action.status);
  if(result.handle){handles.set(action.response.handle,result.handle);result={...result,handle:action.response.handle};}
  assert.deepEqual(result,action.response,'re-executed tool result '+r.id);
 }
 const sent=runtime.events.filter(e=>e.kind==='view.observed').slice(0,r.calls.at(-1)?.observationCount||0);
 const source=new Set(),derived=new Set();for(const e of sent)for(const row of e.provenance)for(const tokens of Object.values(row))for(const token of tokens)(token.startsWith('derived:')?derived:source).add(token);
 assert.equal(source.size,r.metrics.sourceCells);assert.equal(derived.size,r.metrics.derivedValues);
 assert.equal(sent.reduce((s,e)=>s+e.leaves.length,0),r.metrics.materializedCells);
 for(const [turn,c]of r.calls.entries()){
  assert.equal(c.turn,turn);
  assert.equal(sha(c.requestBody),c.requestSha256);assert.equal(sha(c.responseBody),c.responseSha256);
  const request=JSON.parse(c.requestBody);const response=JSON.parse(c.responseBody);assert.deepEqual(response.usage||null,c.usage);
  assert.deepEqual(request.messages,history,'model message history '+r.id+'/'+turn);
  assert.deepEqual(request.tools.slice(0,-1),protocol.tools,'frozen tool schemas');
  const message=response.choices?.[0]?.message;
  if(message?.tool_calls?.length===1){
   const tc=message.tool_calls[0];let args;
   try{args=JSON.parse(tc.function.arguments);}catch{}
   if(args&&tc.function.name==='finish'){
    assert.equal(turn,r.calls.length-1);assert.equal(r.status,'completed');assert.deepEqual(args,r.result);
   }else if(args){
    const action=r.actions.find(a=>a.turn===turn);
    assert.ok(action,'executed action for tool call');assert.equal(action.name,tc.function.name);assert.deepEqual(action.args,args);
    history.push({role:'assistant',content:message.content??null,tool_calls:message.tool_calls});
    history.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify(action.response)});
   }
  }
  const index=providers.findIndex(p=>!p.used&&p.receiverBodySha256===c.requestSha256&&p.responseSha256===c.responseSha256&&p.responseStatus===c.status);
  assert.ok(index>=0,'distinct provider record '+r.id+'/'+c.turn);const p=providers[index];p.used=true;
  const providerBody=JSON.stringify({...request,thinking:{type:'disabled'}});assert.equal(p.providerBody,providerBody);assert.equal(p.providerBodySha256,sha(providerBody));
  for(const message of request.messages.filter(m=>m.role==='tool')){
   const reply=JSON.parse(message.content);
   assert.ok(r.actions.some(a=>JSON.stringify(a.response)===JSON.stringify(reply)),'tool message has executed origin');
  }
  calls++;
 }
 assert.equal(r.metrics.totalTokens,r.calls.reduce((s,c)=>s+(c.usage?.total_tokens||0),0));
 assert.equal(r.metrics.providerRequestBytes,r.calls.reduce((s,c)=>s+Buffer.byteLength(c.requestBody),0));
 assert.equal(r.metrics.repeatedObservationCells,r.calls.reduce((s,c)=>s+c.observationCells,0));
 leaves+=r.metrics.sourceCells;count++;
}
assert.equal(providers.filter(x=>x.used).length,calls);assert.equal(providers.length,calls);
console.log(JSON.stringify({runId:name,runs:count,providerCalls:calls,allToolsReexecuted:true,frozenHashesVerified:true,sourceCells:leaves}));
