import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { METHODS } from './catalog.mjs';
import { localAssessment, neededFacts, selectFacts, chooseView, checkBoundary, modelPayload, parseAssessment } from './policy.mjs';

const label=(zh,en)=>({zh,en});
export function createRun(item,options={}) {
  if(!METHODS.includes(options.method||'joint')) throw new Error('Unknown method');
  return { protocol:'research-v1',id:randomUUID(),source:'live',caseId:item.id,family:item.family,title:item.title,task:item.task,input:structuredClone(item.facts),sourceFile:item.source,
    method:options.method||'joint',condition:options.condition||'normal',model:options.model||process.env.RESEARCH_MODEL||'qwen-plus',createdAt:new Date().toISOString(),status:'running',
    policy:{version:1,allowed:true},steps:[],events:[],receipts:[],result:null,report:null,error:null,
    metrics:{controlMs:[],modelCalls:0,toolCalls:0,promptTokens:0,completionTokens:0,totalBytes:0},
  };
}
export function addEvent(run,type,data={},notify=()=>{}) {
  const event={index:run.events.length+1,type,at:new Date().toISOString(),...data}; run.events.push(event); notify(run,event); return event;
}
function step(run,operation,title,reason,location,notify,parent=null) {
  const item={id:`step-${run.steps.length+1}`,operation,title,reason,location,status:'running',startedAt:new Date().toISOString(),parentStepId:parent?.id||null,input:{},retained:[],receipts:[],output:null,checks:[]};
  run.steps.push(item); addEvent(run,'step.started',{stepId:item.id,title},notify); return item;
}
function finish(run,item,output,notify) { item.status='completed';item.finishedAt=new Date().toISOString();item.output=output;addEvent(run,'step.completed',{stepId:item.id},notify); }
function report(run) {
  const r=run.result;
  return [`# ${run.family==='contract'?'合同风险提示':'学习支持建议'}（合成案例）`,'',`对象：${run.input.identity}`,`运行：${run.id}`,'', '## 分析结果',r.summary,'',`问题分类：${r.issueCodes.join('、')}`,r.amount===null?'':`按输入公式核算金额：${r.amount} 元`,'','## 建议',r.recommendation,'','## 依据',...r.evidenceIds.map((k)=>`- ${k}`),...r.citations.map((c)=>`- ${c}`),'','## 执行记录',`本地步骤：${run.steps.filter(s=>s.location==='local').length}；模型调用：${run.metrics.modelCalls}；资料查询：${run.metrics.toolCalls}`,`数据来源：合成案例 ${run.caseId}；本机独立接收进程记录请求，不是云厂商独立回执。`,'','合同分析为输入条款的系统演示，不作法律效力判断。学习分析仅针对合成记录。',''].join('\n');
}
export async function executeRun(run,source,transport,{notify=()=>{},hook=async()=>{},recheck=true}={}) {
  const start=performance.now(); const item=structuredClone(source);
  const entryView=selectFacts(item.facts,neededFacts(item));
  let current;
  try {
    addEvent(run,'task.started',{caseId:item.id},notify);
    current=step(run,'read',label('读取本地资料','Read local data'),label('原始身份和业务资料在本地读取。','Read original identity and business records locally.'),'local',notify);
    current.input=structuredClone(item.facts); current.source=item.document||{file:item.source,sha256:createHash('sha256').update(JSON.stringify(item.facts)).digest('hex')};
    finish(run,current,{fieldCount:Object.keys(item.facts).length,source:current.source},notify);

    const placementStart=performance.now();
    const assessLocally=localAssessment(item);
    const placeLocal=run.method==='joint' && assessLocally;
    run.metrics.controlMs.push(performance.now()-placementStart);
    current=step(run,'analyze',label('判断当前任务的执行位置','Choose where to execute'),placeLocal
      ?label('本地规则覆盖当前输入，可以直接计算并生成结果。','A local rule covers these inputs and can produce the required output.')
      :label(run.method!=='joint'?'本对照固定使用云端分析；输入处理方式按所选方法执行。':'当前条款或记录超出本地规则范围，使用获准云端分析。',run.method!=='joint'?'This baseline uses cloud analysis with its selected input policy.':'This input is outside the local rule coverage; use the authorized cloud capability.'),placeLocal?'local':'cloud',notify);
    current.candidates=[{implementation:'local-rules-v1',available:Boolean(assessLocally)},{implementation:run.model,available:Boolean(process.env.DASHSCOPE_API_KEY)||Boolean(transport.testing)}];
    addEvent(run,'location.decided',{stepId:current.id,location:current.location,candidates:current.candidates},notify);
    if(placeLocal) {
      current.input=selectFacts(item.facts,neededFacts(item)); current.retained=Object.keys(item.facts).filter(k=>!(k in current.input));
      run.result=assessLocally; finish(run,current,run.result,notify);
    } else {
      let retrieved=false;
      for(let round=0;round<3;round++) {
        if(round>0) current=step(run,'analyze',label('结合查得资料继续分析','Continue with retrieved reference'),label('重新构造当前分析步骤的输入，不沿用工具收到的参数。','Rebuild the analysis view for this step.'),'cloud',notify,current);
        const controlStart=performance.now();
        const view=chooseView(item,run.method,entryView);
        current.input=view; current.retained=Object.keys(item.facts).filter(k=>!(k in view)); current.required=neededFacts(item); current.recipient='cloud-model'; current.plannedPolicyVersion=run.policy.version;
        const payload=modelPayload(item,view,run.model);
        addEvent(run,'view.prepared',{stepId:current.id,keys:Object.keys(view)},notify);
        if(run.condition==='revoke_after_plan' && round===0) {
          run.policy={allowed:false,version:run.policy.version+1};
          addEvent(run,'policy.changed',{stepId:current.id,policy:{...run.policy},reason:label('规划完成后撤销云端授权','Cloud authorization revoked after planning')},notify);
        }
        await hook('beforeSend',{run,step:current,item,view,payload});
        const checked=checkBoundary({item,view,operation:'analyze',recipient:current.recipient,expectedRecipient:'cloud-model',policy:run.policy,version:current.plannedPolicyVersion,method:run.method,finalBody:JSON.stringify(payload),recheck});
        current.checks.push(checked); run.metrics.controlMs.push(performance.now()-controlStart);
        addEvent(run,'exit.checked',{stepId:current.id,...checked},notify);
        addEvent(run,'request.sent',{stepId:current.id,recipient:current.recipient},notify);run.metrics.modelCalls++;
        const envelope=await transport.send(run,current,payload,'cloud-model');
        acceptReceipt(run,current,envelope.receipt,notify);
        if(envelope.status!==200) throw new Error(`MODEL_HTTP_${envelope.status}: ${JSON.stringify(envelope.response?.error||{}).slice(0,200)}`);
        const response=envelope.response;
        run.metrics.promptTokens+=response.usage?.prompt_tokens||0; run.metrics.completionTokens+=response.usage?.completion_tokens||0;
        const message=response.choices?.[0]?.message;
        current.providerResponse={id:response.id,model:response.model,usage:response.usage,message};
        if(message?.tool_calls?.length) {
          if(message.tool_calls.length!==1 || message.tool_calls[0].function?.name!=='lookup_reference') throw new Error('UNSUPPORTED_TOOL: 模型提出未登记的工具操作。');
          if(retrieved) throw new Error('REPEATED_TOOL: 已获得资料，模型仍要求重复查询。');
          let args;try{args=JSON.parse(message.tool_calls[0].function.arguments);}catch{throw new Error('INVALID_TOOL_ARGUMENTS');}
          if(args.code!==item.facts.reference_code || args.version!==item.facts.reference_version || Object.keys(args).some(k=>!['code','version'].includes(k))) throw new Error('UNAUTHORIZED_TOOL_ARGUMENTS: 工具参数超出当前任务允许的资料范围。');
          finish(run,current,{requestedTool:message.tool_calls[0],summary:label('模型提出查询指定版本资料。','The model requested a versioned reference.')},notify);
          const parent=current;
          current=step(run,'lookup_reference',label('查询运行中发现的资料需求','Look up a newly requested reference'),label('由模型实际工具调用触发；查询只需要资料编号和版本。','Triggered by an actual tool call; the lookup needs only a code and version.'),'tool',notify,parent);
          current.introducedAtRuntime=true; current.trigger={modelStepId:parent.id,toolCallId:message.tool_calls[0].id};
          addEvent(run,'step.discovered',{stepId:current.id,parentStepId:parent.id,toolCall:message.tool_calls[0]},notify);
          const controlStart=performance.now();
          const toolView=chooseView(item,run.method,entryView,'lookup_reference');
          current.input=toolView;current.retained=Object.keys(item.facts).filter(k=>!(k in toolView));current.required=['reference_code','reference_version'];current.recipient='reference-service';current.plannedPolicyVersion=run.policy.version;
          const body={code:args.code,version:args.version};
          const extras=Object.keys(toolView).filter(k=>!['reference_code','reference_version'].includes(k));
          if(extras.length) body.context=selectFacts(toolView,extras);
          await hook('beforeSend',{run,step:current,item,view:toolView,payload:body});
          const checked=checkBoundary({item,view:toolView,operation:'lookup_reference',recipient:current.recipient,expectedRecipient:'reference-service',policy:run.policy,version:current.plannedPolicyVersion,method:run.method,finalBody:JSON.stringify(body),recheck});
          current.checks.push(checked);run.metrics.controlMs.push(performance.now()-controlStart);
          addEvent(run,'exit.checked',{stepId:current.id,...checked},notify);
          addEvent(run,'request.sent',{stepId:current.id,recipient:current.recipient},notify);run.metrics.toolCalls++;
          const tool=await transport.send(run,current,body,'reference-service');acceptReceipt(run,current,tool.receipt,notify);
          if(tool.status!==200)throw new Error('REFERENCE_NOT_FOUND: 指定资料不存在。');
          item.facts.reference_text=tool.response.text;item.facts.reference_citation=tool.response.citation;retrieved=true;
          finish(run,current,tool.response,notify);
          continue;
        }
        const result=parseAssessment(message);
        const available=Object.keys(view);
        if(result.evidenceIds.some(k=>!available.includes(k))) throw new Error('UNSUPPORTED_EVIDENCE: 模型引用未提供的事实。');
        if(item.facts.reference_code && (!retrieved || !result.citations.includes(item.facts.reference_citation))) throw new Error('REFERENCE_REQUIRED: 结果缺少实际查得的指定版本资料。');
        if(result.citations.some(c=>c!==item.facts.reference_citation))throw new Error('UNSUPPORTED_CITATION: 结果引用未经查询的资料。');
        run.result=result;finish(run,current,result,notify);break;
      }
      if(!run.result)throw new Error('STEP_LIMIT: 已达到有限步骤上限，未得到可核对结果。');
    }
    current=step(run,'assemble',label('在本地关联合同方并生成结果','Assemble the result locally'),label('在本地恢复身份关联，生成带来源的业务文件。','Reconnect identity locally and produce a report with sources.'),'local',notify,current);
    if(item.family==='study')current.title=label('在本地关联学生并生成建议','Assemble student advice locally');
    current.input={identity:item.facts.identity,assessment:run.result};run.report=report(run);finish(run,current,{fileName:'result.md',summary:run.result.summary},notify);
    run.status='completed';addEvent(run,'report.created',{stepId:current.id},notify);
  }catch(error){
    run.error=error.message;
    run.status=/POLICY_CHANGED|RECIPIENT_CHANGED|FORBIDDEN_VALUE|EXTRA_FIELD|UNAUTHORIZED_TOOL_ARGUMENTS/.test(error.message)?'blocked':'failed';
    if(current){current.status=run.status;current.error=run.error;current.finishedAt=new Date().toISOString();}
    addEvent(run,run.status==='blocked'?'exit.denied':'run.error',{stepId:current?.id,message:run.error},notify);
  }finally{
    run.finishedAt=new Date().toISOString();run.metrics.elapsedMs=performance.now()-start;
    addEvent(run,`run.${run.status}`,{status:run.status},notify);
  }
  return run;
}
export function acceptReceipt(run,current,receipt,notify=()=>{}) {
  if(!receipt)return;
  const existing=run.receipts.findIndex(r=>r.id===receipt.id);
  if(existing<0){run.receipts.push(receipt);current.receipts.push(receipt.id);run.metrics.totalBytes+=receipt.bytes;addEvent(run,'receiver.received',{stepId:current.id,receiptId:receipt.id,recipient:receipt.recipient},notify);}
  else run.receipts[existing]=receipt;
}
