// Offline transport/source audit. Native business state is checked separately
// by audit-native-v10.py; neither checker grades free-text policy compliance.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const sha=x=>createHash('sha256').update(x).digest('hex');
const name=process.argv[2];assert.match(name||'',/^dev-v10-[a-z0-9-]+$/);
const dir=resolve('data/research/v10-runs',name),load=async p=>JSON.parse(await readFile(resolve(dir,p),'utf8'));
const protocol=await load('protocol.json');
for(const [file,digest] of Object.entries(protocol.sourceHashes))assert.equal(sha(await readFile(resolve(dir,'frozen',basename(file)))),digest,'Frozen source '+file);
assert.equal(sha(await readFile(resolve(dir,'frozen/cases.json'))),protocol.inputHash);
const index=await load('post-run-audit.json');
for(const [file,digest] of Object.entries(index.files))assert.equal(sha(await readFile(resolve(dir,file))),digest,'Post-run manifest '+file);
const providers=[];for(const f of await readdir(resolve(dir,'provider-egress')))providers.push(await load('provider-egress/'+f));
let count=0,agent=0,user=0,localUser=0,tokens=0,attempts=0;
for(const cid of protocol.caseIds){
 const r=await load(cid+'.json');assert.equal(r.caseId,cid);attempts++;
 const responseToolCalls=r.calls.filter(c=>c.role==='agent').flatMap(c=>JSON.parse(c.responseBody).choices?.[0]?.message?.tool_calls||[]);
 const actionById=new Map(r.actions.filter(a=>a.toolCallId).map(a=>[a.toolCallId,a]));
 let computedTokens=0;
 for(const c of r.calls){
  assert.equal(sha(c.requestBody),c.requestSha256);assert.equal(sha(c.responseBody),c.responseSha256);
  const q=JSON.parse(c.requestBody),a=JSON.parse(c.responseBody);
  assert.deepEqual(c.usage,a.usage||null);computedTokens+=c.usage?.total_tokens||0;
  assert.equal(q.model,protocol.model);assert.equal(q.temperature,0);
  const p=providers.find(p=>!p.used&&p.receiverBodySha256===c.requestSha256&&p.responseSha256===c.responseSha256&&p.responseStatus===c.status);
  assert.ok(p,'Distinct provider record for '+cid+'/'+c.index);p.used=true;
  assert.equal(p.endpoint,'https://api.deepseek.com/chat/completions');assert.equal(sha(p.providerBody),p.providerBodySha256);
  assert.deepEqual(JSON.parse(p.providerBody),{...q,thinking:{type:'disabled'}});
  if(c.role==='agent'){
   agent++;
   for(const m of q.messages.filter(m=>m.role==='tool')){
    const action=actionById.get(m.tool_call_id)||r.actions.find(x=>JSON.stringify(x.result)===m.content);
    assert.ok(action,'Native action backing tool observation');
    assert.deepEqual(JSON.parse(m.content),action.observation??action.result);
   }
  }else if(c.role==='user-simulator')user++;
  else if(c.role==='local-user-simulator')localUser++;
  else assert.fail('Unknown actor');
  count++;
 }
 for(const action of r.actions){
  const tc=action.toolCallId?responseToolCalls.find(t=>t.id===action.toolCallId):responseToolCalls.find(t=>t.function.name===action.name&&t.function.arguments===JSON.stringify(action.arguments));
  // Old diagnostic does not retain tool ids; the hash/state audit still covers it.
  if(action.toolCallId){assert.ok(tc);assert.equal(tc.function.name,action.exposedName||action.name);assert.deepEqual(JSON.parse(tc.function.arguments),action.plannerArguments||action.arguments);}
 }
 assert.equal(r.metrics.totalTokens,computedTokens);tokens+=computedTokens;
}
assert.equal(providers.length,count);assert.equal(providers.filter(p=>p.used).length,count);
console.log(JSON.stringify({runId:name,attempts,providerCalls:count,agentCalls:agent,userSimulatorCalls:user,localUserSimulatorCalls:localUser,tokens,scope:'Frozen source, request/response/provider agreement and recorded tool-observation origins. Not a semantic or official benchmark score.'}));
