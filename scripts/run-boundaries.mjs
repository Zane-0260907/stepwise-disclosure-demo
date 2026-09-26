import http from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { getCase } from '../src/research/catalog.mjs';
import { createRun,executeRun } from '../src/research/engine.mjs';
import { localAssessment } from '../src/research/policy.mjs';
import { createTransport } from '../src/research/transport.mjs';

let faultMode='normal',source;
const mock=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const input=JSON.parse(raw),facts=JSON.parse(input.messages[1].content).facts;
 let message;
 if(facts.reference_code&&!facts.reference_text){
   const args={code:facts.reference_code,version:facts.reference_version};
   if(faultMode==='restricted')args.code='UNAPPROVED-REFERENCE';
   message={tool_calls:[{id:'boundary-tool-call',type:'function',function:{name:'lookup_reference',arguments:JSON.stringify(args)}}]};
 }else{
   const assessment=localAssessment({...source,localCapabilities:true})||{issueCodes:['UNDEFINED_TRIGGER'],amount:null,summary:'边界测试的确定性响应。',recommendation:'仅用于控制路径核验。',evidenceIds:[facts.clause?'clause':'observations'],citations:facts.reference_citation?[facts.reference_citation]:[]};
   message={content:JSON.stringify(assessment)};
 }
 res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id:'deterministic-boundary-fixture',choices:[{message}]}));
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');
process.env.DEMO_MODEL_URL=`http://127.0.0.1:${mock.address().port}/model`;process.env.DASHSCOPE_API_KEY='boundary-test-only';
const transport=await createTransport();const rows=[],ablations=[];
// Preserve the published boundary evidence; new local checks write only to ignored runtime data.
const out=new URL('../data/research/boundaries/',import.meta.url);await mkdir(out,{recursive:true});
try{
 for(const type of ['revoked','recipient','extra','missing','capability','restricted'])for(let variant=0;variant<4;variant++){
   const ids=type==='capability'?['contract-01','contract-03','study-01','study-03']:['contract-21','contract-22','study-21','study-22'];
   source=await getCase(ids[variant]);if(type==='capability')source.localCapabilities=false;
   faultMode=type==='restricted'?'restricted':'normal';
   const run=createRun(source);let injected=false;
   const hook=async(stage,{run,step,item,view,payload})=>{
     if(injected)return;injected=true;
     if(type==='revoked')run.policy={allowed:false,version:2};
     if(type==='recipient')step.recipient='unapproved-service';
     if(type==='extra')payload.messages[1].content+=String(item.facts[['identity','contact','account','internal_note'][variant]]);
     if(type==='missing')delete view[source.family==='contract'?'clause':'observations'];
   };
   await executeRun(run,source,transport,{hook});
   const expected=type==='missing'?'failed':type==='capability'?'completed':'blocked';
   assert.equal(run.status,expected,`${type}/${variant}: ${run.error}`);
   assert.equal(run.receipts.filter(r=>r.recipient==='reference-service').length,0);
   if(['revoked','recipient','extra','missing'].includes(type))assert.equal(run.receipts.length,0);
   if(['restricted','capability'].includes(type))assert.ok(run.receipts.some(r=>r.recipient==='cloud-model'));
   await writeFile(new URL(`${type}-${variant+1}.json`,out),JSON.stringify({...run,testEnvironment:'deterministic HTTP model fixture; real separate receiver process'},null,2));
   rows.push({type,variant:variant+1,caseId:source.id,expected,status:run.status,correct:true,receivedRequests:run.receipts.length,toolRequests:run.metrics.toolCalls,controlMs:run.metrics.controlMs,runId:run.id});
 }
 for(let variant=0;variant<4;variant++){
   source=await getCase(['contract-21','contract-22','study-21','study-22'][variant]);faultMode='normal';
   const run=createRun(source,{condition:'revoke_after_plan'});await executeRun(run,source,transport,{recheck:false});
   assert.ok(run.receipts.length>0);ablations.push({caseId:source.id,status:run.status,receivedAfterRevocation:run.receipts.length});
   await writeFile(new URL(`without-recheck-${variant+1}.json`,out),JSON.stringify(run,null,2));
 }
 await writeFile(new URL('summary.json',out),JSON.stringify({environment:'Deterministic HTTP model fixture with actual separate receiver; not live model quality evaluation',cases:rows,withoutRecheck:ablations},null,2));
 console.log(JSON.stringify({boundaryCases:rows.length,correct:rows.filter(r=>r.correct).length,withoutRecheck:ablations}));
}finally{transport.close();await new Promise(resolve=>mock.close(resolve));}
