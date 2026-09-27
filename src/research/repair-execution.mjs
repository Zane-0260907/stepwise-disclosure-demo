import {fork} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {planDisclosure,sealDecision} from './disclosure-frontier.mjs';
import {alternatives,newRepairStore,applyRepairMutation,executeRegistered,repairOracle,REPAIR_METHODS} from './repair-workloads.mjs';

export async function createRepairReceiver(){
 const child=fork(fileURLToPath(new URL('./repair-receiver.mjs',import.meta.url)),[],{stdio:['ignore','ignore','inherit','ipc'],execArgv:[],windowsHide:true});
 const port=await new Promise((resolve,reject)=>{child.once('message',m=>resolve(m.port));child.once('error',reject);child.once('exit',code=>reject(Error('RECEIVER_EXIT:'+code)));});
 return {async send(body){const rawBody=JSON.stringify(body);const response=await fetch(`http://127.0.0.1:${port}/execute`,{method:'POST',headers:{'content-type':'application/json'},body:rawBody,signal:AbortSignal.timeout(10000)});const value=await response.json();if(!response.ok)throw Error(value.error);if(value.receipt.rawBody!==rawBody||value.receipt.sha256!==createHash('sha256').update(rawBody).digest('hex')||value.receipt.bytes!==Buffer.byteLength(rawBody))throw Error('RECEIPT_MISMATCH');return value;},async close(){await new Promise(resolve=>{child.once('exit',resolve);child.send('stop');});}};
}

export async function executeRepair(item,method,receiver,{onEvent=()=>{},externalGuard=null}={}){
 if(!REPAIR_METHODS.includes(method))throw Error('INVALID_METHOD');
 if(method.startsWith('freshctx')&&!externalGuard)throw Error('FRESHCTX_REQUIRED');
 const start=performance.now(),store=newRepairStore(item),history=new Set(),cache=new Map(),tasks=[...item.tasks];
 const run={id:randomUUID(),caseId:item.id,method,mutation:item.mutation,initial:structuredClone(item.values),events:[],receipts:[],decisions:[],changes:[],status:'running',metrics:{calls:0,localExecutions:0,repaired:0,reused:0,newDisclosures:0,transmittedFields:0,staleDispatches:0,unauthorizedDispatches:0,planningMs:0,peakLabels:0},startedAt:new Date().toISOString()};
 const emit=(type,data={})=>{const event={seq:run.events.length,type,at:new Date().toISOString(),...data};run.events.push(event);onEvent(run,event);};
 let mutationApplied=false,iteration=0,finishedCount=0;
 const strategy=method==='selective_greedy'||method==='payload_only'?'greedy':'frontier';
 const computePlan=()=>{const before=performance.now();const pending=tasks.filter(x=>!cache.has(x));const choices=pending.map(id=>({id,alternatives:alternatives(store,id)}));const plan=planDisclosure(choices,history,{strategy});
  // Plan choice reads availability of unselected alternatives too. A newly
  // available local implementation can change the best continuation even when
  // the old remote request body still matches its source values.
  plan.decisionKeys=[...new Set(choices.flatMap(s=>s.alternatives.flatMap(a=>[...a.guards,...Object.keys(a.versions)])))];
  run.metrics.planningMs+=performance.now()-before;run.metrics.peakLabels=Math.max(run.metrics.peakLabels,plan.peak);return plan;};
 const certify=(a,plan)=>sealDecision(store,{stepId:a.operation,alternative:a,guardKeys:plan.decisionKeys});
 try{
  emit('started',{tasks:[...tasks]});
  while(cache.size<tasks.length&&iteration++<24){
   let plan=computePlan();if(!plan.feasible){run.status='blocked';emit('blocked',{reason:plan.reason});break;}
   let choice=plan.path[0],ticket=certify(choice,plan);run.decisions.push({operation:choice.operation,choice:choice.id,recipient:choice.recipient,view:structuredClone(choice.view),lineage:structuredClone(choice.lineage),versions:ticket.versions,valueVersions:ticket.valueVersions,path:plan.path.map(a=>a.id),newDisclosure:plan.newDisclosure,history:[...history]});
   emit('planned',{operation:choice.operation,choice:choice.id,recipient:choice.recipient,view:choice.view,versions:ticket.versions,path:plan.path.map(a=>a.id),newDisclosure:plan.newDisclosure.length,historySize:history.size});
   const trigger=item.mutation==='between_steps'?finishedCount===2:finishedCount===1;
   if(!mutationApplied&&trigger){
    mutationApplied=true;const before=structuredClone(store.values),beforeVersions={...store.versions};
    run.changes=applyRepairMutation(store,item.mutation);
    if(item.mutation==='new_step'){const discovered=['record','flag','cap','quote'].find(op=>!tasks.includes(op));tasks.push(discovered);emit('step.discovered',{operation:discovered,parent:tasks[0]});}
    if(run.changes.length)emit('state.changed',{changes:run.changes});
    let stale;
    if(method==='payload_only'){
     // Earlier payload-oriented behavior: source fields that literally appear
     // in the view. This intentionally omits derived inputs and decision guards.
     stale=Object.keys(choice.view).some(k=>Object.hasOwn(store.values,k)&&beforeVersions[k]!==store.versions[k]);
    }else if(method.startsWith('freshctx')){
     const evidence=await externalGuard({id:run.id,before,beforeVersions,after:store.values,afterVersions:store.versions,dependencies:Object.keys(ticket.versions)});
     run.externalGuard=evidence;stale=!evidence.executed;
    }else stale=!store.current(ticket.versions);
    if(stale){
     const invalid=[];
     for(const [op,entry] of cache)if(method.endsWith('restart')||!store.current(entry.valueVersions)){cache.delete(op);invalid.push(op);}
     run.metrics.repaired++;run.metrics.reused+=cache.size;
     emit('repair.required',{invalidated:invalid,reused:[...cache.keys()],reason:'DECISION_DEPENDENCY_CHANGED',historySize:history.size});
     continue;
    }
    if(item.mutation==='new_step')continue;
   }
   // The complete methods make an authoritative check immediately at dispatch;
   // no await or mutable object intervenes before handing the serialized body
   // to the registered transport. The local controller is the trust boundary.
   const unchangedBody=JSON.stringify({stepId:choice.operation,implementation:choice.id,recipient:choice.recipient,view:choice.view})===ticket.body;
   if(!unchangedBody)throw Error('PREPARED_BODY_CHANGED');
   const current=store.current(ticket.versions);
   const stillFeasible=alternatives(store,choice.operation).some(a=>a.id===choice.id&&a.recipient===choice.recipient&&a.feasible);
   if(method!=='payload_only'&&(!current||!stillFeasible)){run.status='blocked';emit('blocked',{reason:'STALE_AT_DISPATCH'});break;}
   if(!current)run.metrics.staleDispatches++;
   if(!stillFeasible)run.metrics.unauthorizedDispatches++;
   let output;
   if(choice.recipient==='local'){output=executeRegistered(choice.operation,'raw',choice.view);run.metrics.localExecutions++;}
   else{
    // A receipt failure cannot undo disclosure. Reserve before the request;
    // no retry erases it. The external operator sees only this chosen view.
    choice.tokens.forEach(x=>history.add(x));run.metrics.transmittedFields+=Object.keys(choice.view).length;run.metrics.calls++;
    const envelope=await receiver.send({runId:run.id,stepId:`${run.decisions.length}:${choice.operation}`,operation:choice.operation,kind:choice.kind,recipient:choice.recipient,view:choice.view});
    output=envelope.result;run.receipts.push({...envelope.receipt,decisionIndex:run.decisions.length-1,tokens:choice.tokens,validAtDispatch:current&&stillFeasible});
   }
   cache.set(choice.operation,{output,valueVersions:ticket.valueVersions,recipient:choice.recipient});finishedCount++;
   emit('executed',{operation:choice.operation,recipient:choice.recipient,view:choice.view,output,historySize:history.size,versions:ticket.versions,valueVersions:ticket.valueVersions,validAtDispatch:current,feasibleAtDispatch:stillFeasible});
  }
  if(run.status==='running')run.status=cache.size===tasks.length?'completed':'failed';
 }catch(error){run.status='failed';run.error=error.message;emit('failed',{error:error.message});}
 run.final=structuredClone(store.values);run.finalVersions={...store.versions};run.tasks=tasks;run.outputs=Object.fromEntries([...cache].map(([op,x])=>[op,x.output]));run.disclosures=[...history].sort();run.metrics.newDisclosures=history.size;run.metrics.elapsedMs=performance.now()-start;run.finishedAt=new Date().toISOString();
 const expected=repairOracle(run.final,tasks),feasible=tasks.every(op=>alternatives(store,op).some(a=>a.feasible));
 const correct=Object.entries(expected).every(([op,value])=>typeof value==='number'?Math.abs(run.outputs[op]-value)<1e-7:run.outputs[op]===value);
 run.evaluation={feasible,expected,correct,success:feasible?run.status==='completed'&&correct&&run.metrics.staleDispatches===0&&run.metrics.unauthorizedDispatches===0:run.status==='blocked'&&run.metrics.staleDispatches===0&&run.metrics.unauthorizedDispatches===0};
 emit('finished',{status:run.status,metrics:run.metrics});return run;
}
