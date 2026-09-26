import http from 'node:http';
import { once } from 'node:events';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRun } from '../src/research/engine.mjs';
import { getCase } from '../src/research/catalog.mjs';
import { neededFacts,selectFacts,modelPayload,checkBoundary } from '../src/research/policy.mjs';
import { createTransport } from '../src/research/transport.mjs';
import { createRequestGate } from '../src/research/checked-execution.mjs';

function changeFacts(payload,fn){const user=JSON.parse(payload.messages[1].content);fn(user);payload.messages[1].content=JSON.stringify(user);}
const mutations={
  extra_fact: c=>changeFacts(c.payload,u=>{u.facts.debug='unregistered value';}),
  swapped_fact_value:c=>changeFacts(c.payload,u=>{u.facts[c.item.family==='contract'?'clause':'observations']='altered after plan';}),
  missing_fact:c=>changeFacts(c.payload,u=>{delete u.facts[c.item.family==='contract'?'clause':'observations'];}),
  task_rewrite:c=>changeFacts(c.payload,u=>{u.task='different task after planning';}),
  added_message:c=>c.payload.messages.push({role:'system',content:'unapproved extra context'}),
  extra_top_level:c=>{c.payload.metadata={unapproved:'extra data'};},
  model_changed:c=>{c.payload.model='different-provider-model';},
  altered_tool_schema:c=>{c.payload.tools[0].function.description+=' unrelated material';},
  encoded_identity:c=>{
    changeFacts(c.payload,u=>{u.facts.debug=c.item.facts.identity;});
    const encoded=[...c.item.facts.identity].map(x=>'\\u'+x.charCodeAt(0).toString(16).padStart(4,'0')).join('');
    c.payload.messages[1].content=c.payload.messages[1].content.replace(c.item.facts.identity,encoded);
  },
  policy_revoked:c=>{c.run.policy={allowed:false,version:2};},
  policy_version_changed:c=>{c.run.policy={allowed:true,version:2};},
  recipient_changed:c=>{c.step.recipient='other-recipient';},
  used_source_changed:c=>{c.item.facts[c.item.family==='contract'?'clause':'observations']='new source value';},
};

export async function bindingStudy(outputDirectory){
  const received=[];
  const mock=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    received.push({raw,at:new Date().toISOString()});
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'request-binding-fixture',choices:[{message:{content:'{}'}}]}));
  });
  mock.listen(0,'127.0.0.1');await once(mock,'listening');
  const previous={url:process.env.DEMO_MODEL_URL,key:process.env.DASHSCOPE_API_KEY};
  process.env.DEMO_MODEL_URL=`http://127.0.0.1:${mock.address().port}/model`;
  process.env.DASHSCOPE_API_KEY='deterministic-boundary-fixture';
  const transport=await createTransport();const rows=[];
  try{
    for(const caseId of ['contract-11','contract-12','study-11','study-12']){
      for(const [mutation,mutate] of Object.entries({unchanged:()=>{},unused_source_changed:c=>{c.item.facts.unrelated_record='new unrelated value';},...mutations})){
        for(const mode of ['v1-final-substring-check','v2-bound-request']){
          const item=await getCase(caseId),run=createRun(item,{model:'deterministic-boundary-fixture'});
          const view=selectFacts(item.facts,neededFacts(item));
          const step={id:'boundary-step',operation:'analyze',recipient:'cloud-model',plannedPolicyVersion:1,checks:[]};
          const payload=modelPayload(item,view,run.model);
          const context={run,step,item,view,payload};
          const gate=createRequestGate(transport);gate.prepare(context);
          mutate(context);
          const before=received.length;let error=null,receipt=null;
          try{
            if(mode==='v1-final-substring-check')checkBoundary({item,view,operation:'analyze',recipient:step.recipient,expectedRecipient:'cloud-model',policy:run.policy,version:1,method:'joint',finalBody:JSON.stringify(payload)});
            receipt=(await (mode==='v2-bound-request'?gate.transport:transport).send(run,step,payload,step.recipient)).receipt;
          }catch(e){error=e.message;}
          const row={caseId,mutation,mode,blocked:received.length===before,receivedRequests:received.length-before,error,receipt};
          const positive=['unchanged','unused_source_changed'].includes(mutation);
          if(mode==='v2-bound-request')assert.equal(row.blocked,!positive,`${caseId}/${mutation}`);
          if(positive)assert.equal(row.receivedRequests,1);
          rows.push(row);
        }
      }
    }
    // One-use tickets must not authorize a second send, even with identical bytes.
    const item=await getCase('contract-11'),run=createRun(item,{model:'deterministic-boundary-fixture'});
    const view=selectFacts(item.facts,neededFacts(item));
    const step={id:'one-use',operation:'analyze',recipient:'cloud-model',plannedPolicyVersion:1,checks:[]};
    const payload=modelPayload(item,view,run.model),gate=createRequestGate(transport);
    gate.prepare({run,step,item,view,payload});await gate.transport.send(run,step,payload,'cloud-model');
    await assert.rejects(gate.transport.send(run,step,payload,'cloud-model'),/NO_TICKET/);
    const attacks=rows.filter(r=>!['unchanged','unused_source_changed'].includes(r.mutation));
    const summary={createdAt:new Date().toISOString(),environment:'Deterministic HTTP fixture behind a separate receiver process; no model-quality evidence',
      mutations:Object.keys(mutations),contexts:4,attackCasesPerMode:attacks.length/2,positiveCasesPerMode:8,
      v1Blocked:attacks.filter(r=>r.mode.startsWith('v1')&&r.blocked).length,
      v2Blocked:attacks.filter(r=>r.mode.startsWith('v2')&&r.blocked).length,oneUseReplayBlocked:true,rows};
    if(outputDirectory){await mkdir(outputDirectory,{recursive:true});await writeFile(new URL('summary.json',outputDirectory),JSON.stringify(summary,null,2));}
    return summary;
  }finally{
    transport.close();await new Promise(resolve=>mock.close(resolve));
    for(const [name,value] of [['DEMO_MODEL_URL',previous.url],['DASHSCOPE_API_KEY',previous.key]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const summary=await bindingStudy(new URL('../data/research/request-binding/',import.meta.url));
  const {rows,...report}=summary;console.log(JSON.stringify(report,null,2));
}
