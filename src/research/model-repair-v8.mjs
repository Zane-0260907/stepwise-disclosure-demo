import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {hash, evaluateLocalProgram, PROGRAM_SCHEMA} from './local-program.mjs';
import {planBudgeted} from './budget-frontier-v8.mjs';

export const METHODS=['restart_greedy','repair_greedy','repair_frontier','budget_0','budget_10','budget_25'];
export const CONDITIONS=['all_local','mixed_stable','source_used','source_unrelated','capability_withdrawn'];
const OPS=['add','subtract','multiply','divide','min','max'];
export const MODEL_SYSTEM=`Solve a financial-table question by calling registered tools. First request inspect_source. The source reply contains field identifiers, row labels and the original header structure, but no business numeric values. Then call submit_calculation with a data-only program of at most 8 operations. Each operation has op and exactly two args; an arg is {field: "r1c1"}, {constant: 100}, or {step: 0} referring to a previous zero-indexed operation. Allowed ops: add, subtract, multiply, divide, min, max. Every operation must contribute to the final result. Use field IDs from the source reply. Ratios and percentage changes should be fractions (e.g. 0.12 for 12%), unless the question asks for a count or absolute amount. Do not infer or invent missing numeric values. Return the tool call only.`;
export const MODEL_TOOLS=[
 {type:'function',function:{name:'inspect_source',description:'Read the registered table structure and field schema, without numeric business values.',parameters:{type:'object',properties:{},additionalProperties:false}}},
 {type:'function',function:{name:'submit_calculation',description:'Submit the executable calculation graph. The last node is the answer.',parameters:{type:'object',properties:{program:PROGRAM_SCHEMA},required:['program'],additionalProperties:false}}}
];

// This prompt is deliberately constructed from an allowlist. Neither labels,
// original numeric tables nor sourceOperationCount enter the model request.
export async function acquireModelGraph(item,tag,connection){
 const record={id:tag,caseId:item.id,model:'deepseek-flash',calls:[],status:'running',startedAt:new Date().toISOString()};
 const messages=[{role:'system',content:MODEL_SYSTEM},{role:'user',content:JSON.stringify({requestId:tag,question:item.question})}];
 async function call(name){
  const body=JSON.stringify({model:'deepseek-flash',temperature:0,messages,tools:MODEL_TOOLS,tool_choice:{type:'function',function:{name}},max_tokens:1800});
  const started=performance.now();
  const response=await fetch(connection.url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${connection.token}`},body,signal:AbortSignal.timeout(100000)});
  const responseBody=await response.text();record.calls.push({requestBody:body,requestSha256:hash(body),responseBody,responseSha256:hash(responseBody),status:response.status,elapsedMs:performance.now()-started});
  if(!response.ok)throw Error('MODEL_HTTP_'+response.status);
  const data=JSON.parse(responseBody),message=data.choices?.[0]?.message,tool=message?.tool_calls?.[0];
  if(message?.tool_calls?.length!==1||tool?.function?.name!==name)throw Error('UNEXPECTED_TOOL_CALL');
  return {message,tool,args:JSON.parse(tool.function.arguments)};
 }
 try{
  const inspection=await call('inspect_source');
  messages.push({role:'assistant',content:inspection.message.content??null,tool_calls:inspection.message.tool_calls});
  messages.push({role:'tool',tool_call_id:inspection.tool.id,content:JSON.stringify({schema:item.schema,tableStructure:item.tableStructure,headerRows:item.headerRows})});
  const proposal=await call('submit_calculation');
  record.program=proposal.args.program;record.parentToolCallId=proposal.tool.id;
  validateGraph(record.program,Object.keys(item.facts));
  record.programSha256=hash(record.program);record.status='ready';
 }catch(e){record.status='failed';record.error=e.message;}
 record.finishedAt=new Date().toISOString();return record;
}

export function validateGraph(program,fields){
 if(!Array.isArray(program)||program.length<1||program.length>8)throw Error('PROGRAM_SIZE');
 const permitted=new Set(fields);
 for(const [i,node]of program.entries()){
  if(!node||Object.keys(node).sort().join(',')!=='args,op'||!OPS.includes(node.op)||!Array.isArray(node.args)||node.args.length!==2)throw Error('PROGRAM_NODE');
  for(const a of node.args){
   if(!a||Object.keys(a).length!==1)throw Error('PROGRAM_OPERAND');
   if('field'in a){if(!permitted.has(a.field))throw Error('PROGRAM_FIELD');}
   else if('step'in a){if(!Number.isInteger(a.step)||a.step<0||a.step>=i)throw Error('PROGRAM_REFERENCE');}
   else if('constant'in a){if(!Number.isFinite(a.constant)||Math.abs(a.constant)>1e9)throw Error('PROGRAM_CONSTANT');}
   else throw Error('PROGRAM_OPERAND');
  }
 }
 if(ancestors(program,program.length-1).steps.length!==program.length||!ancestors(program,program.length-1).fields.length)throw Error('PROGRAM_UNUSED_OR_NO_SOURCE');
}

export function ancestors(program,index){
 const steps=new Set(),fields=new Set();
 function visit(i){if(steps.has(i))return;steps.add(i);for(const arg of program[i].args){if('field'in arg)fields.add(arg.field);else if('step'in arg)visit(arg.step);}}
 visit(index);return {steps:[...steps].sort((a,b)=>a-b),fields:[...fields].sort()};
}
export function subgraph(program,index){
 const lineage=ancestors(program,index),remap=new Map(lineage.steps.map((n,i)=>[n,i]));
 return lineage.steps.map(i=>({op:program[i].op,args:program[i].args.map(a=>'step'in a?{step:remap.get(a.step)}:{...a})}));
}
export function nodeStamp(program,index,state){return hash({program:subgraph(program,index),sources:ancestors(program,index).fields.map(f=>[f,state.versions[f]])});}
function tokenFor(arg,program,state){
 if('constant'in arg)return null;
 return 'numeric-service:' + ('field'in arg?`field:${arg.field}:${state.versions[arg.field]}`:`derived:${nodeStamp(program,arg.step,state)}`);
}
export function alternatives(program,index,state){
 const line=ancestors(program,index),allowed=line.fields.every(f=>state.allowedFields.includes(f));
 return [
  {id:'local',recipient:'local',feasible:state.localOps.includes(program[index].op),tokens:[],fields:0,work:1},
  {id:'operands',recipient:'numeric-service',feasible:allowed&&state.remoteAllowed,tokens:program[index].args.map(a=>tokenFor(a,program,state)).filter(Boolean),fields:program[index].args.filter(a=>!('constant'in a)).length,work:1},
  {id:'source',recipient:'numeric-service',feasible:allowed&&state.remoteAllowed,tokens:line.fields.map(f=>tokenFor({field:f},program,state)),fields:line.fields.length,work:line.steps.length}
 ];
}
const calculate=(op,a,b)=>{const value=({add:()=>a+b,subtract:()=>a-b,multiply:()=>a*b,divide:()=>a/b,min:()=>Math.min(a,b),max:()=>Math.max(a,b)})[op]?.();if(!Number.isFinite(value)||Math.abs(value)>1e18)throw Error('INVALID_ARITHMETIC_RESULT');return value;};

export async function createNumericReceiver(){
 const receipts=[];
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.method!=='POST'||req.url!=='/calculate')throw Error('INVALID_ROUTE');
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536)throw Error('BODY_LIMIT');chunks.push(c);}
   const bytes=Buffer.concat(chunks),body=bytes.toString(),payload=JSON.parse(body);let value;
   if(payload.kind==='source')value=evaluateLocalProgram(payload.program,payload.facts,Object.keys(payload.facts)).value;
   else if(payload.kind==='operands'&&payload.args.length===2)value=calculate(payload.op,...payload.args.map(x=>x.value));
   else throw Error('INVALID_VIEW');
   const receipt={id:randomUUID(),at:new Date().toISOString(),body,bodySha256:hash(body),bytes:bytes.length,value};receipts.push(receipt);
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({receiptId:receipt.id,value}));
  }catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}/calculate`,receipts,close:()=>new Promise(resolve=>server.close(resolve))};
}

export async function executeModelGraph(item,model,condition,method,receiver,{onEvent=()=>{}}={}){
 if(!METHODS.includes(method)||!CONDITIONS.includes(condition))throw Error('UNKNOWN_ARM');
 const run={id:`${model.id}.${condition}.${method}`,caseId:item.id,modelRecordId:model.id,parentToolCallId:model.parentToolCallId,condition,method,status:'running',events:[],receipts:[],decisions:[],startedAt:new Date().toISOString(),metrics:{executions:0,remoteCalls:0,numericFields:0,bytes:0,work:0,reused:0,invalidated:0,planningMs:0,peakLabels:0}};
 const began=performance.now(),event=(type,data={})=>{const e={seq:run.events.length,type,at:new Date().toISOString(),...data};run.events.push(e);onEvent(e,run);};
 if(model.status!=='ready'){run.status='model_failed';run.error=model.error;return run;}
 const program=structuredClone(model.program),facts=structuredClone(item.facts);
 const state={facts,versions:Object.fromEntries(Object.keys(facts).map(k=>[k,1])),localOps:condition==='all_local'?[...OPS]:['add','subtract'],allowedFields:Object.keys(facts),remoteAllowed:true,capabilityVersion:1};
 validateGraph(program,Object.keys(facts));
 const cache=new Map(),history=new Set();let intervention=false,remainingBudget=Infinity,phase=0;
 const boundary=Math.max(1,Math.floor(program.length/2));
 event('graph.created',{program,programSha256:hash(program),modelRecordId:model.id,parentToolCallId:model.parentToolCallId});
 const valid=i=>cache.has(i)&&cache.get(i).stamp===nodeStamp(program,i,state);
 try{
  while(!valid(program.length-1)){
   const pending=program.map((_,i)=>i).filter(i=>!valid(i));
   const t=performance.now(),slack=method==='budget_0'?0:method==='budget_10'?0.10:method==='budget_25'?0.25:Infinity;
   const plan=planBudgeted(pending.map(i=>({alternatives:alternatives(program,i,state)})),history,{strategy:method.endsWith('greedy')?'greedy':'frontier',slack:Number.isFinite(remainingBudget)?Infinity:slack,maxFields:remainingBudget});
   run.metrics.planningMs+=performance.now()-t;run.metrics.peakLabels=Math.max(run.metrics.peakLabels,plan.peak??0);
   if(!plan.feasible){run.status='blocked';event('execution.blocked',{reason:plan.reason});break;}
   const index=pending[0],choice=plan.path[0],stamp=nodeStamp(program,index,state);
   if(Number.isFinite(slack)&&!Number.isFinite(remainingBudget))remainingBudget=plan.budget;
   run.decisions.push({index,phase,pending,choice:choice.id,path:plan.path.map(x=>x.id),fields:plan.fields,budget:plan.budget,referenceFields:plan.referenceFields,newDisclosures:plan.newDisclosures,history:[...history],versions:{...state.versions},capabilityVersion:state.capabilityVersion});
   // The dependency/policy check and serialization have no intervening await.
   if(!alternatives(program,index,state).find(x=>x.id===choice.id)?.feasible)throw Error('STALE_OR_DENIED_DISPATCH');
   const args=program[index].args.map(a=>{
    if('constant'in a)return a.constant;
    if('field'in a)return facts[a.field];
    if(!valid(a.step))throw Error('STALE_PARENT');return cache.get(a.step).value;
   });
   let value,payload=null;
   if(choice.id==='local')value=calculate(program[index].op,...args);
   else{
    payload={runId:run.id,node:index,kind:choice.id};
    if(choice.id==='source'){payload.program=subgraph(program,index);payload.facts=Object.fromEntries(ancestors(program,index).fields.map(f=>[f,facts[f]]));}
    else {payload.op=program[index].op;payload.args=program[index].args.map((a,i)=>({value:args[i],...(tokenFor(a,program,state)?{token:tokenFor(a,program,state)}:{constant:true})}));}
    const body=JSON.stringify(payload);event('request.sent',{index,view:choice.id,payload,bodySha256:hash(body),tokens:choice.tokens});
    const response=await fetch(receiver.url,{method:'POST',headers:{'content-type':'application/json'},body});
    const reply=await response.json();if(!response.ok)throw Error(reply.error);
    const receipt=receiver.receipts.find(r=>r.id===reply.receiptId);if(!receipt||receipt.bodySha256!==hash(body)||receipt.value!==reply.value)throw Error('RECEIPT_MISMATCH');
    run.receipts.push(structuredClone(receipt));value=reply.value;
    run.metrics.remoteCalls++;run.metrics.numericFields+=choice.fields;run.metrics.bytes+=receipt.bytes;
    for(const token of choice.tokens)history.add(token);
   }
   remainingBudget-=choice.fields;
   if(remainingBudget<0)throw Error('TRANSMISSION_BUDGET_EXCEEDED');
   cache.set(index,{value,stamp});run.metrics.executions++;run.metrics.work+=choice.work;
   event('node.completed',{index,op:program[index].op,location:choice.recipient,view:choice.id,value,stamp,tokens:choice.tokens});
   if(!intervention&&cache.size>=boundary){
    intervention=true;const before={facts:{...facts},localOps:[...state.localOps]};let field=null;
    if(condition==='source_used')field=ancestors(program,0).fields[0]||ancestors(program,program.length-1).fields[0];
    if(condition==='source_unrelated')field=Object.keys(facts).sort().find(f=>!ancestors(program,program.length-1).fields.includes(f));
    if(field){facts[field]=facts[field]*1.01+0.5;state.versions[field]++;}
    if(condition==='capability_withdrawn'){state.localOps=[];state.capabilityVersion++;}
    const changed=Boolean(field)||condition==='capability_withdrawn';
    if(changed){
     remainingBudget=Infinity;phase++;
     const invalid=[...cache.keys()].filter(i=>!valid(i)),kept=[...cache.keys()].filter(i=>valid(i));
     if(method==='restart_greedy'){run.metrics.invalidated+=cache.size;cache.clear();}
     else{run.metrics.invalidated+=invalid.length;run.metrics.reused+=kept.length;for(const i of invalid)cache.delete(i);}
     event('state.changed',{controlled:true,field,before,after:{facts:{...facts},localOps:[...state.localOps]},invalidated:method==='restart_greedy'?[...new Set([...invalid,...kept])]:invalid,retained:method==='restart_greedy'?[]:kept});
    }else if(condition==='source_unrelated')event('intervention.unavailable',{reason:'All registered fields used; no unrelated source exists.'});
   }
   if(run.metrics.executions>24)throw Error('EXECUTION_BOUND');
  }
  if(valid(program.length-1)){run.status='completed';run.value=cache.get(program.length-1).value;}
 }catch(e){run.status='failed';run.error=e.message;event('execution.failed',{error:e.message});}
 run.finalFacts={...facts};run.finalVersions={...state.versions};run.disclosures=[...history].sort();run.metrics.uniqueDisclosures=history.size;
 run.metrics.elapsedMs=performance.now()-began;run.finishedAt=new Date().toISOString();event('run.completed',{status:run.status,value:run.value});return run;
}
