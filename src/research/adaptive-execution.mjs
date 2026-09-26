import { performance } from 'node:perf_hooks';
import { addEvent,acceptReceipt } from './engine.mjs';
import { localAssessment,neededFacts,chooseView,selectFacts,modelPayload,parseAssessment } from './policy.mjs';
import { createRequestGate } from './checked-execution.mjs';

// Local authorization bounds. A model request is a request for data, never an
// authorization grant. These public business fields are permitted for the
// registered operation; identity and internal records are never requestable.
export const SUPPLEMENTABLE=Object.freeze({contract:['late_days','amount'],study:['scores','homework','absences']});
const label=(zh,en)=>({zh,en});
const fail=code=>{throw new Error(code);};

export function validateFactRequest(args,item,visible){
 if(!args||Object.keys(args).some(k=>!['fields','reason'].includes(k))||!Array.isArray(args.fields)||!args.fields.length||
    args.fields.length>3||new Set(args.fields).size!==args.fields.length||typeof args.reason!=='string'||!args.reason.trim())fail('UNAUTHORIZED_FACT_REQUEST');
 for(const field of args.fields){
  if(!SUPPLEMENTABLE[item.family]?.includes(field)||!(field in item.facts)||field in visible)fail('UNAUTHORIZED_FACT_REQUEST');
 }
 return args.fields;
}
export function adaptivePayload(item,view,model,acquisition=true){
 const body=modelPayload(item,view,model);
 // The same tools and instructions are used by all information-view methods.
 // The no_acquisition ablation removes only the fact-request capability.
 const tools=[];
 if(view.reference_code&&!view.reference_text)tools.push(body.tools[0]);
 const missing=(SUPPLEMENTABLE[item.family]||[]).filter(key=>key in item.facts&&!(key in view));
 if(acquisition&&missing.length)tools.push({type:'function',function:{name:'request_task_facts',description:'仅在当前判断或计算缺少必要数值时，向本地请求尚未提供的业务字段。一次列出当前实际需要的全部字段，并解释其与当前判断的关系。不要猜测数值。',parameters:{type:'object',properties:{fields:{type:'array',items:{type:'string',enum:missing},minItems:1,maxItems:3,uniqueItems:true},reason:{type:'string'}},required:['fields','reason'],additionalProperties:false}}});
 body.tools=tools;
 if(tools.length)body.tool_choice='auto';else {delete body.tools;delete body.tool_choice;}
 body.messages[0].content='你通过工具与本地数据管理器协作。未在facts中出现的数值可能仍保留在本地，并非原文没有这些信息。若本轮提供request_task_facts且计算或判断缺少其可请求的字段，必须调用该工具取得数据；不要在最终答案里要求用户补交这些字段，也不要把暂未传输的数据误判为条款缺项。工具交互优先于最终JSON输出要求。\n'+body.messages[0].content+' 只有取得本次判断所需事实后，才能输出最终JSON。字段缺失不等于数值为零。仅参考当前facts，不假定早先上下文仍存在。';
 if(acquisition&&missing.length){const user=JSON.parse(body.messages[1].content);user.availableLocalFields=missing;user.dataAccess='这些字段当前保留在本地。如确实需要，请调用request_task_facts获取，不能猜测。';body.messages[1].content=JSON.stringify(user);}
 return body;
}

export async function executeAdaptiveRun(run,source,transport,{notify=()=>{},hook=async()=>{},acquisition=true}={}){
 const started=performance.now(),item=structuredClone(source),granted=new Set();
 const gate=createRequestGate(transport,notify);
 run.protocol='research-v3-progressive-facts';run.factRequests=[];
 let current,referenceUsed=false,factRounds=0;
 const begin=(operation,title,reason,location,parent=null)=>{
  const step={id:`step-${run.steps.length+1}`,operation,title,reason,location,status:'running',startedAt:new Date().toISOString(),parentStepId:parent?.id||null,input:{},retained:[],receipts:[],checks:[],output:null};
  run.steps.push(step);current=step;addEvent(run,'step.started',{stepId:step.id,title},notify);return step;
 };
 const finish=(step,output)=>{step.output=output;step.status='completed';step.finishedAt=new Date().toISOString();addEvent(run,'step.completed',{stepId:step.id},notify);};
 const send=async(step,view,body,recipient)=>{
  const beginTime=performance.now();
  step.input=structuredClone(view);step.retained=Object.keys(item.facts).filter(k=>!(k in view));
  step.required=Object.keys(view);step.recipient=recipient;step.plannedPolicyVersion=run.policy.version;
  addEvent(run,'view.prepared',{stepId:step.id,keys:Object.keys(view)},notify);
  if(['joint','per_step','no_acquisition'].includes(run.method)){
   const permitted=new Set([...neededFacts(item,step.operation),...(step.operation==='analyze'?granted:[])]);
   if(Object.keys(view).some(k=>!permitted.has(k)))fail('UNAUTHORIZED_VIEW_FIELD');
   const serialized=JSON.stringify(body);
   for(const field of ['identity','contact','account','internal_note','unrelated_record']){
    const value=item.facts[field];if(value&&serialized.includes(String(value)))fail('UNAUTHORIZED_PRIVATE_LITERAL');
   }
  }
  // The local controller has checked the dynamic authorization set above;
  // the v2 gate binds its resulting immutable serialization and dependencies.
  gate.prepare({run:{...run,method:'adaptive-contract'},step,item,view,payload:body});
  run.metrics.controlMs.push(performance.now()-beginTime);
  if(run.condition==='revoke_after_plan'&&run.metrics.modelCalls===0&&step.operation==='analyze'){
   run.policy={allowed:false,version:run.policy.version+1};addEvent(run,'policy.changed',{stepId:step.id,policy:{...run.policy}},notify);
  }
  await hook('beforeSend',{run,step,item,view,payload:body});
  addEvent(run,'exit.checked',{stepId:step.id,policyVersion:run.policy.version},notify);
  const envelope=await gate.transport.send(run,step,body,recipient);
  if(recipient==='cloud-model')run.metrics.modelCalls++;else run.metrics.toolCalls++;
  acceptReceipt(run,step,envelope.receipt,notify);
  if(envelope.status!==200)fail(`MODEL_HTTP_${envelope.status}: ${JSON.stringify(envelope.response?.error||{})}`);
  return envelope.response;
 };
 try{
  addEvent(run,'task.started',{caseId:item.id},notify);
  const read=begin('read',label('读取本地资料','Read local data'),label('原始资料在本地读取。','Read original records locally.'),'local');
  read.input=structuredClone(item.facts);finish(read,{fieldCount:Object.keys(item.facts).length,source:item.document||item.source});
  const local=localAssessment(item);
  if(['joint','no_acquisition','placement_full'].includes(run.method)&&local){
   const step=begin('analyze',label('在本地完成当前判断','Complete this step locally'),label('登记规则覆盖当前输入。','A registered local rule covers this input.'),'local',read);
   step.input=selectFacts(item.facts,neededFacts(item));step.retained=Object.keys(item.facts).filter(k=>!(k in step.input));
   step.candidates=[{implementation:'local-rules-v1',available:true}];run.result=local;finish(step,local);
  }else{
   const entry=selectFacts(item.facts,neededFacts(item));
   for(let round=0;round<6;round++){
    const step=begin('analyze',round?label('结合新增事实继续分析','Continue with newly available facts'):label('判断当前任务的执行位置','Choose where to execute'),label('按当前步骤构造模型可见内容。','Construct the model view for the current step.'),'cloud',current);
    step.candidates=[{implementation:'local-rules-v1',available:Boolean(local)},{implementation:run.model,available:true}];
    addEvent(run,'location.decided',{stepId:step.id,location:'cloud',candidates:step.candidates},notify);
    const view={...chooseView(item,run.method==='placement_full'?'full':run.method,entry),...selectFacts(item.facts,[...granted])};
    const response=await send(step,view,adaptivePayload(item,view,run.model,acquisition&&run.method!=='no_acquisition'),'cloud-model');
    run.metrics.promptTokens+=response.usage?.prompt_tokens||0;run.metrics.completionTokens+=response.usage?.completion_tokens||0;
    const message=response.choices?.[0]?.message;
    step.providerResponse={id:response.id,model:response.model,usage:response.usage,message};
    if(message?.tool_calls?.length){
     if(message.tool_calls.length!==1)fail('UNSUPPORTED_TOOL_BATCH');
     const call=message.tool_calls[0];let args;try{args=JSON.parse(call.function.arguments);}catch{fail('INVALID_TOOL_ARGUMENTS');}
     if(call.function.name==='request_task_facts'){
      if(!acquisition||run.method==='no_acquisition'||factRounds++>=2)fail('UNAUTHORIZED_FACT_REQUEST');
      const fields=validateFactRequest(args,item,view);
      finish(step,{requestedTool:call,summary:label('请求补充当前判断缺少的事实。','Request facts missing from this decision.')});
      const localStep=begin('supply_facts',label('核验并补充所需业务事实','Check and supply requested business facts'),label('模型请求不等于授权；本地白名单决定能否补充。','A model request is not authorization; the local allowlist controls access.'),'local',step);
      localStep.introducedAtRuntime=true;localStep.trigger={modelStepId:step.id,toolCallId:call.id};
      localStep.input={fields,reason:args.reason};localStep.retained=Object.keys(item.facts).filter(k=>!fields.includes(k));
      fields.forEach(field=>granted.add(field));run.factRequests.push({stepId:localStep.id,fields,reason:args.reason,policyVersion:run.policy.version});
      addEvent(run,'step.discovered',{stepId:localStep.id,parentStepId:step.id,toolCall:call},notify);
      finish(localStep,{approvedFields:fields,values:selectFacts(item.facts,fields)});continue;
     }
     if(call.function.name!=='lookup_reference'||referenceUsed||!item.facts.reference_code||
        args.code!==item.facts.reference_code||args.version!==item.facts.reference_version||Object.keys(args).some(k=>!['code','version'].includes(k)))fail('UNAUTHORIZED_TOOL_ARGUMENTS');
     finish(step,{requestedTool:call,summary:label('模型请求指定版本资料。','The model requested a versioned reference.')});
     const lookup=begin('lookup_reference',label('查询运行中发现的资料需求','Look up a newly requested reference'),label('资料服务只需要编号和版本。','The reference service needs only a code and version.'),'tool',step);
     lookup.introducedAtRuntime=true;lookup.trigger={modelStepId:step.id,toolCallId:call.id};
     addEvent(run,'step.discovered',{stepId:lookup.id,parentStepId:step.id,toolCall:call},notify);
     const toolView=chooseView(item,run.method==='placement_full'?'full':run.method,entry,'lookup_reference');
     const body={code:args.code,version:args.version};const extra=Object.keys(toolView).filter(k=>!['reference_code','reference_version'].includes(k));
     if(extra.length)body.context=selectFacts(toolView,extra);
     const reference=await send(lookup,toolView,body,'reference-service');
     item.facts.reference_text=reference.text;item.facts.reference_citation=reference.citation;referenceUsed=true;finish(lookup,reference);continue;
    }
    const result=parseAssessment(message);
    if(result.evidenceIds.some(k=>!(k in view)))fail('UNSUPPORTED_EVIDENCE');
    if(item.facts.reference_code&&(!referenceUsed||!result.citations.includes(item.facts.reference_citation)))fail('REFERENCE_REQUIRED');
    if(result.citations.some(c=>c!==item.facts.reference_citation))fail('UNSUPPORTED_CITATION');
    run.result=result;finish(step,result);break;
   }
   if(!run.result)fail('STEP_LIMIT');
  }
  const last=begin('assemble',label('在本地关联对象并生成结果','Assemble the result locally'),label('身份关联留在本地。','Identity association stays local.'),'local',current);
  last.input={identity:item.facts.identity,assessment:run.result};
  run.report=[`# ${item.family==='contract'?'合同风险提示':'学习支持建议'}（合成案例）`,'',`对象：${item.facts.identity}`,`运行：${run.id}`,'','## 分析结果',run.result.summary,'','## 建议',run.result.recommendation,'','## 依据',...run.result.evidenceIds.map(k=>`- ${k}`),...run.result.citations.map(c=>`- ${c}`),'','## 执行记录',`本地步骤：${run.steps.filter(s=>s.location==='local').length}；模型调用：${run.metrics.modelCalls}；资料查询：${run.metrics.toolCalls}`,'登记出口经本机独立 HTTP 接收进程记录；不是云厂商独立认证。'].join('\n');
  finish(last,{fileName:'result.md',summary:run.result.summary});run.status='completed';addEvent(run,'report.created',{stepId:last.id},notify);
 }catch(error){
  run.error=error.message;run.status=/BOUNDARY_|UNAUTHORIZED_/.test(run.error)?'blocked':'failed';
  if(current){current.status=run.status;current.error=run.error;current.finishedAt=new Date().toISOString();}
  addEvent(run,run.status==='blocked'?'exit.denied':'run.error',{stepId:current?.id,message:run.error},notify);
 }finally{run.finishedAt=new Date().toISOString();run.metrics.elapsedMs=performance.now()-started;addEvent(run,`run.${run.status}`,{status:run.status},notify);}
 return run;
}
