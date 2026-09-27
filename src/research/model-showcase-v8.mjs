import {readFile} from 'node:fs/promises';
import {executeModelGraph,createNumericReceiver} from './model-repair-v8.mjs';
import {addEvent} from './engine.mjs';
const text=(zh,en)=>({zh,en}),root=new URL('../../evidence/model-showcase-v8/',import.meta.url);
export const MODEL_REPAIR_NAMES={budget_0:text('约束重复传输 · 保留有效结果','Bound transmissions · reuse valid results'),repair_greedy:text('逐步选择 · 保留有效结果','Greedy selection · reuse valid results'),repair_frontier:text('后续规划 · 不限制传输','Continuation planning · unbounded traffic'),restart_greedy:text('条件变化后全部重跑','Restart all after the change')};
export async function modelRepairCases(){
 const item=JSON.parse(await readFile(new URL('case.json',root)));
 return [['capability_withdrawn','本地能力变化','Local capability changes'],['source_used','已用源值更新','A used source value changes'],['source_unrelated','未用源值更新','An unused source value changes']].map(([condition,zh,en])=>({id:'model-'+condition.replaceAll('_','-'),family:'repair',variant:'model-v8',split:'evaluation',title:text('真实模型计划 · '+zh,'Real model plan · '+en),task:text('计算所选项目占总额的比例；执行中检查条件变化，保留仍有效的计算。','Calculate the selected items as a share of the total; inspect changes and retain valid computations.'),facts:item.facts,source:'model-table.pdf',modelCondition:condition,item}));
}
export async function modelRepairScenarios(){return(await modelRepairCases()).map(c=>({id:c.id,caseId:c.id,condition:'normal',title:c.title}));}
let receiverPromise;
export async function executeModelShowcase(run,example,{notify=()=>{}}={}){
 const model=JSON.parse(await readFile(new URL('model.json',root)));receiverPromise ||= createNumericReceiver();
 run.protocol='v8-model-graph-showcase';run.variant='model-v8';run.executionMode='controlled';run.model='saved-deepseek-plan';run.input={...example.facts};run.savedModelRecord=model;run.metrics.modelCalls=0;
 const labels={add:text('相加','Add'),subtract:text('相减','Subtract'),multiply:text('相乘','Multiply'),divide:text('相除','Divide'),min:text('取小值','Minimum'),max:text('取大值','Maximum')};
 const add=(id,title,reason,location,input,output=null)=>{const s={id,title,reason,location,input,output,status:output?'completed':'running',startedAt:new Date().toISOString(),retained:Object.keys(example.facts).filter(k=>!(k in input)),receipts:[],checks:[],operation:'model-repair'};s.retainedValues=Object.fromEntries(s.retained.map(k=>[k,run.input[k]]));run.steps.push(s);return s;};
 add('model-schema',text('读取已保存的模型调用','Read the saved model calls'),text('此处重用公开的真实 DeepSeek 计划；不发起新的付费模型调用。','Reuse a public real DeepSeek plan; no new paid model call is made.'),'local',{question:example.item.question},{summary:text('模型先申请表结构，再提交三步计算。右侧可核对原始模型记录。','The model requested the schema, then submitted three calculation steps. Inspect the original model record on the right.')});
 addEvent(run,'step.completed',{},notify);let pending;
 const evidence=await executeModelGraph(example.item,{...model,id:run.id},example.modelCondition,run.method,await receiverPromise,{onEvent:(event,core)=>{
  if(event.type==='graph.created')add('graph',text('从模型回复创建执行步骤','Create steps from the model reply'),text('步骤来自已保存的工具调用，不是界面预设的执行答案。','Steps come from the saved tool response, not a prewritten UI answer.'),'local',{program:event.program},{summary:text(`登记 ${event.program.length} 个计算步骤。`,`Registered ${event.program.length} calculation steps.`)});
  if(event.type==='request.sent'){
   const input=event.payload.kind==='source'?event.payload.facts:Object.fromEntries(event.payload.args.map((a,i)=>[model.program[event.index].args[i].field||`operand_${i+1}`,a.value]));
   pending=add('node-'+event.seq,text(`执行步骤 ${event.index+1} · ${labels[model.program[event.index].op].zh}`,`Execute step ${event.index+1} · ${labels[model.program[event.index].op].en}`),text('本地未登记此时所需能力；HTTP 接收端实际接收所选视图并计算。','The required capability is not currently registered locally; the HTTP receiver executes the selected view.'),'tool',input);
   pending.recipient='numeric-service';pending.modelPlan=core.decisions.at(-1);
  }
  if(event.type==='node.completed'){
   let step=pending;
   if(event.location==='local')step=add('node-'+event.seq,text(`执行步骤 ${event.index+1} · ${labels[event.op].zh}`,`Execute step ${event.index+1} · ${labels[event.op].en}`),text('使用已登记的本地算子，本步不发送业务数值。','Use the registered local operator; no business value leaves for this step.'),'local',{},null);
   step.status='completed';step.finishedAt=event.at;step.output={summary:text(`计算值：${event.value}。`,`Computed value: ${event.value}.`)};
   step.modelPlan=core.decisions.at(-1);
   const receipt=core.receipts.at(-1);if(event.location!=='local'&&receipt){const r={...receipt,rawBody:receipt.body,sha256:receipt.bodySha256,receivedAt:receipt.at,runId:run.id,stepId:step.id,recipient:'numeric-service',parsed:JSON.parse(receipt.body)};run.receipts.push(r);step.receipts.push(r.id);}
   pending=null;
  }
  if(event.type==='state.changed'){run.input={...event.after.facts};add('change-'+event.seq,text('条件改变，重新核对剩余步骤','Conditions changed; recheck remaining steps'),text('本次变化是预先登记的实验干预，不是模型自主产生的故障。','This is a registered experimental intervention, not a model-generated failure.'),'local',event.field?{field:event.field,before:event.before.facts[event.field],after:event.after.facts[event.field]}:{local_ops_before:event.before.localOps,local_ops_after:event.after.localOps},{summary:text(`保留有效结果 ${event.retained.length} 个；重新计算 ${event.invalidated.length} 个。`,`Retain ${event.retained.length} valid results; recompute ${event.invalidated.length}.`)});}
  run.metrics.toolCalls=core.metrics.remoteCalls;run.metrics.totalBytes=core.metrics.bytes;run.repairMetrics={newDisclosures:core.metrics.uniqueDisclosures??new Set(core.events.filter(e=>e.type==='request.sent').flatMap(e=>e.tokens)).size,reused:core.metrics.reused};
  addEvent(run,event.type,{coreEvent:event},notify);
 }});
 run.repairEvidence=evidence;run.repairMetrics={newDisclosures:evidence.metrics.uniqueDisclosures,reused:evidence.metrics.reused};run.status=evidence.status;run.error=evidence.error;run.metrics.elapsedMs=evidence.metrics.elapsedMs;run.finishedAt=evidence.finishedAt;
 run.result={summary:text(`计算结果 ${Number(evidence.value?.toPrecision(8))}；新增披露 ${evidence.metrics.uniqueDisclosures} 项，传输 ${evidence.metrics.numericFields} 个数值字段。`,`Computed result ${Number(evidence.value?.toPrecision(8))}; ${evidence.metrics.uniqueDisclosures} new disclosure units and ${evidence.metrics.numericFields} numeric fields transmitted.`),recommendation:text('保存的模型计划已重新执行。源值变化后的答案需按更新后的问题核对；执行完成不等于语义正确。','The saved model plan has executed again. Check changed-source answers against the updated task; completion does not imply semantic correctness.')};
 run.report=JSON.stringify({source:example.item.sourceId,question:example.item.question,modelRecord:model.id,mode:'Saved real DeepSeek plan; fresh local and HTTP execution',condition:example.modelCondition,result:evidence.value,metrics:evidence.metrics},null,2);
 addEvent(run,'run.finalized',{},notify);
}
