import {makeRepairCases,OP_LABELS} from './repair-workloads.mjs';
import {createRepairReceiver,executeRepair} from './repair-execution.mjs';
import {addEvent} from './engine.mjs';
const text=(zh,en)=>({zh,en});
export const REPAIR_NAMES={selective_frontier:text('保留有效步骤 · 比较后续方案','Reuse valid steps · compare continuations'),selective_greedy:text('保留有效步骤 · 逐步选择','Reuse valid steps · greedy selection'),full_restart:text('条件变化后全部重跑','Restart all after a change'),payload_only:text('仅核对发送字段 · 对照','Check sent fields only · control')};
export const REPAIR_LABELS={base:['合同金额','Contract amount'],factor:['每日比例','Daily rate'],units:['迟延天数','Days late'],limit:['金额上限','Amount limit'],daily:['本地计算的每日金额','Locally computed daily amount'],total:['本地计算的累计金额','Locally computed total'],bounded:['应用上限后的金额','Capped amount']};
const definitions=[['limit','金额上限更新','Amount limit changes'],['capability_lost','本地能力暂不可用','Local capability becomes unavailable'],['recipient_revoked','撤销服务甲授权','Revoke service A'],['new_step','运行中新增汇总','A new summary step appears']];
export function repairCases(){const dev=makeRepairCases({development:true,count:4});return definitions.map(([mutation,zh,en])=>{const fixture=dev.find(x=>x.seed===1001&&x.mutation===mutation);return {id:'repair-'+mutation.replaceAll('_','-'),family:'repair',split:'evaluation',title:text('按步执行：'+zh,'Stepwise execution: '+en),task:text('核算费用、应用上限并生成结果；执行中检查条件变化对后续步骤的影响。','Calculate the amount, apply the limit, and inspect how an intervening change affects the remaining steps.'),facts:fixture.values,fixture,source:'repair-input.pdf'};});}
export const repairScenarios=repairCases().map(c=>({id:c.id,caseId:c.id,condition:'normal',title:c.title}));
let receiverPromise;
export async function executeRepairShowcase(run,item,{notify=()=>{}}={}){
 receiverPromise ||= createRepairReceiver();run.protocol='v7-dynamic-repair-showcase';run.executionMode='controlled';run.model='registered-operators';run.input=structuredClone(item.facts);let current;
 const add=(id,title,reason,location,input,output=null)=>{const step={id,operation:'repair',title,reason,location,status:output?'completed':'running',startedAt:new Date().toISOString(),input,output,retained:['base','factor','units','limit'].filter(k=>!(k in input)),receipts:[],checks:[]};run.steps.push(step);return step;};
 const evidence=await executeRepair(item.fixture,run.method,await receiverPromise,{onEvent:(core,event)=>{
  run.executionRecordId=core.id;
  if(event.type==='planned'){
   current=add(`${core.decisions.length}:${event.operation}`,OP_LABELS[event.operation],text('比较当前已知后续步骤，按新增披露与执行次数选择方案。','Compare currently known continuations by additional disclosure, then execution work.'),event.recipient==='local'?'local':'tool',event.view);
   current.recipient=event.recipient;current.repairPlan={path:event.path,versions:event.versions,history:event.historySize,newDisclosure:event.newDisclosure};
  }
  if(event.type==='state.changed'){
   if(current){current.status='completed';current.finishedAt=event.at;current.output={summary:text('此时仅完成规划，尚未发送；接下来核对条件变化。','Prepared, not yet sent. The changed conditions are checked next.')};}
   const input=Object.fromEntries(event.changes.map(c=>[c.key,`${c.before.value} → ${c.after.value}`]));
   add(`change-${event.seq}`,text('执行条件发生变化','Execution conditions changed'),text('变化由本轮受控事件触发，不是模型生成的结论。','A controlled event changes state; this is not a model-generated conclusion.'),'local',input,{summary:text('重新核对规划所依据的条件。','Revalidate the conditions used to choose the plan.')});
  }
  if(event.type==='repair.required'){
   if(current)current.invalidated=true;
   add(`repair-${event.seq}`,text('旧请求失效，修复后续步骤','Invalidate the old request and repair'),text('保留仍有效的计算；已经发送过的信息仍计入记录。','Retain valid calculations; previous disclosures remain in the record.'),'local',{}, {summary:text(`重新计算：${event.invalidated.map(x=>OP_LABELS[x].zh).join('、')||'无已完成步骤'}；保留：${event.reused.map(x=>OP_LABELS[x].zh).join('、')||'无'}。`,`Recompute: ${event.invalidated.join(', ')||'no completed steps'}; retain: ${event.reused.join(', ')||'none'}.`)});
  }
  if(event.type==='step.discovered'){if(current){current.status='completed';current.output={summary:text('发现新步骤，重新比较后续方案；本请求尚未发送。','A new step changes the continuation; this prepared request was not sent.')};}const s=add(`new-${event.seq}`,text('新增后续步骤','A new continuation step'),text('受控工作负载在运行中添加步骤；规划器此前不知道该步骤。','The controlled workload adds a step that was absent from the previous planning horizon.'),'local',{}, {summary:OP_LABELS[event.operation]});s.introducedAtRuntime=true;}
  if(event.type==='executed'){
   current.status='completed';current.finishedAt=event.at;current.output={summary:text(`结果：${event.output}。${event.validAtDispatch?'发送时依赖有效。':'对照使用了失效的决策依据。'}`,`Result: ${event.output}. ${event.validAtDispatch?'Dependencies were current at dispatch.':'The control used stale decision evidence.'}`)};
   current.checks.push({versions:event.versions,current:event.validAtDispatch,feasible:event.feasibleAtDispatch});
   const receipt=core.receipts.at(-1);if(receipt?.stepId===current.id){run.receipts.push(structuredClone(receipt));current.receipts.push(receipt.id);}
  }
  run.metrics.toolCalls=core.metrics.calls;run.metrics.totalBytes=core.receipts.reduce((n,r)=>n+r.bytes,0);run.repairMetrics=structuredClone(core.metrics);
  addEvent(run,event.type,{coreEvent:event},notify);
 }});
 run.repairEvidence=evidence;run.status=evidence.status;run.error=evidence.error||null;run.metrics.elapsedMs=evidence.metrics.elapsedMs;run.finishedAt=evidence.finishedAt;
 run.result={summary:text(`本轮新增披露 ${evidence.metrics.newDisclosures} 项，外部算子执行 ${evidence.metrics.calls} 次，修复 ${evidence.metrics.repaired} 次。`,`This run added ${evidence.metrics.newDisclosures} disclosure units, executed ${evidence.metrics.calls} remote operations, and repaired ${evidence.metrics.repaired} times.`),recommendation:text('右侧可逐步核对请求、变化条件及保留的计算。合成算子用于检查机制，不代表真实模型能力。','Inspect requests, changed conditions and retained calculations. Synthetic operators test the mechanism, not language-model quality.'),outputs:evidence.outputs};
 run.report=JSON.stringify({case:run.caseId,status:run.status,outputs:evidence.outputs,metrics:evidence.metrics,protocol:'Controlled registered operators; actual loopback HTTP; no model calls'},null,2);
 addEvent(run,'run.finalized',{},notify);
}
