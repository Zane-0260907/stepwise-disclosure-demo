import {performance} from 'node:perf_hooks';
import {addEvent,acceptReceipt} from './engine.mjs';
import {createSealedRequestGate} from './sealed-request-v4.mjs';
import {evaluateLocalProgram,PROGRAM_SCHEMA} from './local-program.mjs';
const label=(zh,en)=>({zh,en});
export const FINANCIAL_METHODS=['eager_allowed','requested_cells','local_program'];
export function financialPayload(item,visible,model,mode,round){
 const submit={type:'function',function:{name:'submit_calculation',description:'Submit the complete calculation as a finite program. It executes locally. Use field IDs for source values, never guessed or remembered values. Each step has two arguments; step references are zero-based and backward only. The last step is the numerical answer. Return proportions as fractions (e.g. 0.25, not 25) unless the question explicitly asks for a percentage-point difference.',parameters:{type:'object',properties:{program:PROGRAM_SCHEMA},required:['program'],additionalProperties:false}}};
 const request={type:'function',function:{name:'request_cells',description:'Request the numeric cells actually needed to construct this calculation. Values are held locally. Choose by the question and row/column labels, not guessed values. One request only.',parameters:{type:'object',properties:{fields:{type:'array',items:{type:'string',enum:item.schema.map(c=>c.id)},minItems:1,maxItems:12,uniqueItems:true}},required:['fields'],additionalProperties:false}}};
 const user={task:item.question,schema:item.schema,facts:visible,
   instruction:'Use the table schema to identify operands. Unprovided cell values are available to the local interpreter. Do not treat a hidden value as missing source data. Currency symbols and commas have been removed; a cell displayed as 12% is stored as 12. Preserve source units. Output convention: ratios and percent changes are fractions; DO NOT multiply the final ratio by 100. A change from old to new is (new-old)/old, keeping a negative sign for a decrease. Constants must be stated in the question or be conventional arithmetic constants such as 0, 1 or 100.'};
 const body={model,temperature:0,max_tokens:900,messages:[{role:'system',content:'You plan a numerical operation over a local financial table. Return exactly one registered tool call, no prose. Produce the complete calculation; do not use external knowledge or invent cell values. The local interpreter is the only calculator. Never request information unrelated to this question.'},{role:'user',content:JSON.stringify(user)}],tools:[submit]};
 if(mode==='requested_cells'&&round===0){body.tools=[request];body.tool_choice={type:'function',function:{name:'request_cells'}};}
 else body.tool_choice={type:'function',function:{name:'submit_calculation'}};
 return body;
}
export async function executeFinancialRun(run,source,transport,{notify=()=>{},hook=async()=>{},mode=run.method}={}){
 if(!FINANCIAL_METHODS.includes(mode))throw Error('Unknown financial method');
 const start=performance.now(),item=structuredClone(source),gate=createSealedRequestGate(transport,notify);
 run.protocol='research-v4-local-program';run.evaluationMethod=mode;run.policy.allowDerived=true;run.programCertificates=[];
 let current,visible=mode==='eager_allowed'?structuredClone(item.facts):{},requested=false;
 const begin=(operation,title,reason,location,parent=current)=>{
  const s={id:`step-${run.steps.length+1}`,operation,title,reason,location,status:'running',startedAt:new Date().toISOString(),parentStepId:parent?.id||null,input:{},retained:[],checks:[],receipts:[],output:null};run.steps.push(s);current=s;addEvent(run,'step.started',{stepId:s.id,title},notify);return s;
 };
 const finish=(s,output)=>{s.output=output;s.status='completed';s.finishedAt=new Date().toISOString();addEvent(run,'step.completed',{stepId:s.id},notify);};
 try{
  addEvent(run,'task.started',{caseId:item.id},notify);
  const read=begin('read',label('读取本地财务表格','Read the local financial table'),label('公开 FinQA 数据；标签不进入执行输入。','Public FinQA data; evaluation labels are excluded from execution.'),'local');
  read.input=structuredClone(item.facts);finish(read,{source:item.source,question:item.question,cells:item.schema.length});
  for(let round=0;round<2;round++){
   const s=begin('analyze',label('规划当前计算步骤','Plan the current calculation'),label(mode==='local_program'?'模型读取问题与表结构；数值由本地解释器使用。':'按本对照的方法构造可见输入。',mode==='local_program'?'The model reads the question and schema; the local interpreter uses the values.':'Construct the visible input according to this control. '),'cloud');
   const body=financialPayload(item,visible,run.model,mode,round);
   s.input=structuredClone(visible);s.retained=Object.keys(item.facts).filter(k=>!(k in visible));s.recipient='cloud-model';s.required=Object.keys(visible);s.plannedPolicyVersion=run.policy.version;
   gate.prepare({run:{...run,method:'v4'},step:s,item,view:visible,payload:body});
   if(run.condition==='revoke_after_plan'&&round===0)run.policy={...run.policy,allowed:false,version:run.policy.version+1};
   await hook('beforeSend',{run,step:s,item,view:visible,payload:body});
   addEvent(run,'view.prepared',{stepId:s.id,keys:Object.keys(visible)},notify);
   const response=await gate.transport.send(run,s,body,'cloud-model');acceptReceipt(run,s,response.receipt,notify);run.metrics.modelCalls++;
   if(response.status!==200)throw Error(`MODEL_HTTP_${response.status}: ${JSON.stringify(response.response?.error||{})}`);
   const result=response.response,message=result.choices?.[0]?.message;
   run.metrics.promptTokens+=result.usage?.prompt_tokens||0;run.metrics.completionTokens+=result.usage?.completion_tokens||0;
   s.providerResponse={id:result.id,model:result.model,usage:result.usage,message};
   if(message?.tool_calls?.length!==1)throw Error('ONE_TOOL_REQUIRED');
   const call=message.tool_calls[0];let args;try{args=JSON.parse(call.function.arguments);}catch{throw Error('INVALID_TOOL_ARGUMENTS');}
   finish(s,{requestedTool:call});
   if(call.function.name==='request_cells'){
    if(mode!=='requested_cells'||requested||!args||Object.keys(args).join()!=='fields'||!Array.isArray(args.fields)||!args.fields.length||args.fields.length>12||new Set(args.fields).size!==args.fields.length||args.fields.some(k=>!Object.hasOwn(item.facts,k)))throw Error('UNAUTHORIZED_CELL_REQUEST');
    const local=begin('supply_facts',label('核验并提供所请求单元格','Check and supply requested cells'),label('按单元格标识授权，完整表格留在本地。','Authorize cell IDs; retain the remaining table locally.'),'local');
    local.introducedAtRuntime=true;local.trigger={modelStepId:s.id,toolCallId:call.id};local.input={fields:args.fields};
    visible=Object.fromEntries(args.fields.map(k=>[k,item.facts[k]]));requested=true;finish(local,{approvedFields:args.fields});continue;
   }
   if(call.function.name!=='submit_calculation'||!args||Object.keys(args).join()!=='program')throw Error('UNAUTHORIZED_TOOL_ARGUMENTS');
   const local=begin('evaluate_local',label('在本地执行计算','Execute the calculation locally'),label('校验有限算子、字段权限与依赖；不运行模型生成的程序代码。','Validate finite operators, authorized fields and dependencies; no generated code is executed.'),'local');
   local.introducedAtRuntime=true;local.trigger={modelStepId:s.id,toolCallId:call.id};local.input={program:args.program};
   addEvent(run,'step.discovered',{stepId:local.id,parentStepId:s.id,toolCall:call},notify);
   const evaluated=evaluateLocalProgram(args.program,item.facts,mode==='requested_cells'?Object.keys(visible):item.schema.map(c=>c.id));
   local.dependencies=evaluated.dependencies;local.retained=Object.keys(item.facts);
   // Nothing is sent back to the model here. A later external consumer would
   // require an explicit derived-result policy and a one-use release ticket.
   run.programCertificates.push(evaluated);finish(local,{value:evaluated.value,programSha256:evaluated.programSha256,dependencies:evaluated.dependencies});
   run.result={issueCodes:['NUMERICAL_RESULT'],amount:evaluated.value,summary:`${evaluated.value}`,recommendation:'',evidenceIds:evaluated.dependencies.map(d=>d.field),citations:[item.source]};
   break;
  }
  if(!run.result)throw Error('STEP_LIMIT');
  const last=begin('assemble',label('在本地生成可核对结果','Assemble the inspectable result locally'),label('结果与计算依赖可下载；耗时不含展示延迟。','Download the result and dependencies; runtime excludes presentation delay.'),'local');
  const cert=run.programCertificates.at(-1);
  run.report=`# FinQA · ${item.sourceId}\n\n${item.question}\n\nResult: ${run.result.amount}\n\nSource: ${item.source}\n\nProgram:\n\n\`\`\`json\n${JSON.stringify(cert.program,null,2)}\n\`\`\`\n\nDependencies: ${cert.dependencies.map(d=>d.field).join(', ')}\n\nPublic table-only benchmark subset. Numeric correctness is checked separately against withheld FinQA labels. No semantic privacy guarantee.\n`;
  finish(last,{value:run.result.amount,fileName:'result.md'});run.status='completed';
 }catch(error){run.error=error.message;run.status=/BOUNDARY_|UNAUTHORIZED_|LOCAL_PROGRAM_/.test(run.error)?'blocked':'failed';if(current){current.status=run.status;current.error=run.error;current.finishedAt=new Date().toISOString();}addEvent(run,'run.error',{stepId:current?.id,message:run.error},notify);}
 finally{run.finishedAt=new Date().toISOString();run.metrics.elapsedMs=performance.now()-start;addEvent(run,`run.${run.status}`,{status:run.status},notify);}
 return run;
}
