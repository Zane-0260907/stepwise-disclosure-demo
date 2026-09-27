// Current execution adapter. Frozen v8 code is retained unchanged for reproducibility.
import {hash} from './local-program.mjs';
import {planDisclosureFrontier} from './bounded-disclosure-frontier.mjs';
import {CONDITIONS,validateGraph,ancestors,subgraph,nodeStamp,alternatives} from './model-repair-v8.mjs';
const OPS=['add','subtract','multiply','divide','min','max'];
function tokenFor(arg,program,state){
 if('constant'in arg)return null;
 return 'numeric-service:' + ('field'in arg?`field:${arg.field}:${state.versions[arg.field]}`:`derived:${nodeStamp(program,arg.step,state)}`);
}
const calculate=(op,a,b)=>{const value=({add:()=>a+b,subtract:()=>a-b,multiply:()=>a*b,divide:()=>a/b,min:()=>Math.min(a,b),max:()=>Math.max(a,b)})[op]?.();if(!Number.isFinite(value)||Math.abs(value)>1e18)throw Error('INVALID_ARITHMETIC_RESULT');return value;};


export async function executeLiveModelGraph(item,model,condition,method,receiver,{onEvent=()=>{}}={}){
 if(!['live_frontier','live_budget_0'].includes(method)||!CONDITIONS.includes(condition))throw Error('UNKNOWN_ARM');
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
   const t=performance.now(),slack=method==='live_budget_0'?0:Infinity;
   const plan=planDisclosureFrontier(pending.map(i=>({alternatives:alternatives(program,i,state)})),history,{strategy:method.endsWith('greedy')?'greedy':'frontier',slack:Number.isFinite(remainingBudget)?Infinity:slack,maxFields:remainingBudget});
   run.metrics.planningMs+=performance.now()-t;run.metrics.peakLabels=Math.max(run.metrics.peakLabels,plan.peak??0);
   if(!plan.feasible){run.status='blocked';event('execution.blocked',{reason:plan.reason});break;}
   const index=pending[0],choice=plan.path[0],stamp=nodeStamp(program,index,state);
   if(Number.isFinite(slack)&&!Number.isFinite(remainingBudget))remainingBudget=plan.budget;
   run.decisions.push({index,phase,pending,choice:choice.id,path:plan.path.map(x=>x.id),fields:plan.fields,budget:plan.budget,referenceFields:plan.referenceFields,newDisclosures:plan.newDisclosures,peak:plan.peak,width:plan.width,visited:plan.visited,history:[...history],versions:{...state.versions},capabilityVersion:state.capabilityVersion});
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
    const body=JSON.stringify(payload);for(const token of choice.tokens)history.add(token);event('request.sent',{index,view:choice.id,payload,bodySha256:hash(body),tokens:choice.tokens});
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
