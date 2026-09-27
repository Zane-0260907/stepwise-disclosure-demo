// Constructed integration demonstration. No model calls, benchmark scores,
// secrets or real business records. The receiver really receives HTTP bytes.
import http from 'node:http';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {requirementController, requestDigest} from '../src/research/requirement-controller.mjs';

const receipts = [];
const server = http.createServer(async (req,res) => {
  let body=''; for await(const chunk of req) body+=chunk;
  const {contract,representation,input}=JSON.parse(body);
  assert.equal(contract,'threshold-assessment');
  const result={aboveLimit: typeof input.aboveLimit==='boolean' ? input.aboveLimit : input.amount>input.limit};
  const receipt={requestSha256:requestDigest(body),result};
  receipts.push({representation,body,...receipt});
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(receipt));
});
server.listen(0,'127.0.0.1'); await once(server,'listening');
const address=`http://127.0.0.1:${server.address().port}`;
const state={values:{amount:120,limit:100},versions:{amount:1,limit:1},local:false,derived:true};
const controller=requirementController({snapshot:()=>state,authorize:p=>p.recipient==='registered-receiver',
  contracts:[{id:'threshold-assessment',required:()=>['above-limit'],
    validate:x=>typeof x?.aboveLimit==='boolean'||(Number.isFinite(x?.amount)&&Number.isFinite(x?.limit)),
    validateResult:x=>typeof x?.aboveLimit==='boolean', options:[
      {id:'local-result',kind:'local',covers:['above-limit'],dependencies:()=>['amount','limit'],available:s=>s.local,evaluate:v=>({aboveLimit:v.amount>v.limit})},
      {id:'derived-result',kind:'remote',covers:['above-limit'],dependencies:()=>['amount','limit'],available:s=>s.derived,evaluate:v=>({aboveLimit:v.amount>v.limit})},
      {id:'raw-operands',kind:'remote',covers:['above-limit'],dependencies:()=>['amount','limit'],available:()=>true,evaluate:v=>({amount:v.amount,limit:v.limit})},
    ]}],transport:async({body})=>{
      const r=await fetch(address,{method:'POST',headers:{'content-type':'application/json'},body});
      if(!r.ok)throw Error('RECEIVER_HTTP_'+r.status);return r.json();
    }});
let evidence;
try {
  const steps=[];
  async function step(label){const ticket=controller.inspect('threshold-assessment','registered-receiver');const result=await controller.execute(ticket);steps.push({label,ticket,result,cumulativeItems:controller.history.length});}
  await step('The registered service accepts a locally derived predicate.');
  const old=controller.inspect('threshold-assessment','registered-receiver');state.derived=false;
  await assert.rejects(controller.execute(old),/STATE_CHANGED_REPLAN/);
  await step('Derived representation is withdrawn; recheck and send permitted operands.');
  state.local=true;await step('Local completion becomes available; no additional transmission.');
  assert.deepEqual(steps.map(s=>s.result),Array(3).fill({aboveLimit:true}));
  assert.deepEqual(steps.map(s=>s.cumulativeItems),[1,3,3]);assert.equal(receipts.length,2);
  evidence={scope:'Constructed integration check, not a natural-task experiment or evidence of novelty.',
    localData:{amount:120,limit:100},steps,receipts,events:controller.events};
} finally {await new Promise(resolve=>server.close(resolve));}
const path=new URL('../evidence/requirement-demo/trace.json',import.meta.url);
if(process.argv.includes('--check')) assert.deepEqual(JSON.parse(await readFile(path,'utf8')),evidence);
else {await mkdir(new URL('.',path),{recursive:true});await writeFile(path,JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify({stages:evidence.steps.length,httpRequests:evidence.receipts.length,finalCumulativeItems:3,checked:true,modelCalls:0}));
