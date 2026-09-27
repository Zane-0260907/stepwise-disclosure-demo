import {createViewRuntime,VIEW_TOOLS,hash} from './view-runtime-v9.mjs';

export const SYSTEM=`You solve a read-only business task over local records. You have a typed local query service. Prefer execute_plan: it can filter, sort, aggregate or search locally and return only final selected columns, using the listed schemas without first opening the table. This strong capability is available to all methods. A local handle is not data and cannot be used as a guessed answer. Some deployments attach rows immediately; others expose them only when observe is called. Use the same tools as needed. To get a final result, observe only needed columns of the last useful query, not necessarily the original table. Filter before sort/limit; do not guess hidden values. Missing rows are not zero. For text, search is lexical and may miss evidence: refine your search or inspect other chunks. Finish with the finish tool; exact quoted evidence must come from observed text. Never invent records or execute a real-world transaction. At most one tool call per response.`;
export const METHODS=['full','eager','deferred'];
function finishTool(item){
 const properties=item.family==='contract'?{answers:{type:'array',items:{type:'string'}}}:item.family==='retail'?{item_id:{type:'string'},price:{type:'number'},fallback:{type:'boolean'}}:{flight_number:{type:['string','null']},price:{type:['number','null']},found:{type:'boolean'}};
 return {type:'function',function:{name:'finish',description:'Submit the final task answer, only after observing enough evidence.',parameters:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}}};
}
export async function runViewAgent(item,method,connection,{id,maxCalls=10,beforeCall=()=>{},afterCall=()=>{},onEvent=()=>{},timeoutMs=95000}={}){
 if(!METHODS.includes(method))throw Error('UNKNOWN_METHOD');
 const runtime=createViewRuntime(item.tables,{mode:method==='deferred'?'deferred':'eager'});
 const record={id,caseId:item.id,family:item.family,sourceGroup:item.sourceGroup,method,status:'running',startedAt:new Date().toISOString(),calls:[],actions:[],result:null};
 const content={question:item.question,tables:runtime.schema(),answerFormat:item.answerFormat};
 if(method==='full'){
  content.records={};for(const table of Object.keys(item.tables)){const opened=runtime.run('open_table',{table});content.records[table]=opened.rows;}
 }
 const messages=[{role:'system',content:SYSTEM},{role:'user',content:JSON.stringify(content)}];
 const tools=[...VIEW_TOOLS,finishTool(item)];let errorCount=0;
 try{
  for(let turn=0;turn<maxCalls;turn++){
   beforeCall();
   const requestBody=JSON.stringify({model:'deepseek-flash',temperature:0,messages,tools,tool_choice:'auto',max_tokens:1500});
   const started=performance.now();
   onEvent({type:'model.started',turn});
   const response=await fetch(connection.url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+connection.token},body:requestBody,signal:AbortSignal.timeout(timeoutMs)});
   const responseBody=await response.text();let data;try{data=JSON.parse(responseBody);}catch{data={};}
   const observations=runtime.events.filter(e=>e.kind==='view.observed');
   const call={turn,requestBody,requestSha256:hash(requestBody),responseBody,responseSha256:hash(responseBody),status:response.status,elapsedMs:performance.now()-started,usage:data.usage||null,observationCount:observations.length,observationCells:observations.reduce((s,e)=>s+e.leaves.length,0)};
   record.calls.push(call);afterCall(call);onEvent({type:'model.finished',turn,status:response.status});
   if(!response.ok)throw Error('MODEL_HTTP_'+response.status);
   const message=data.choices?.[0]?.message;
   if(message?.tool_calls?.length!==1)throw Error('EXPECTED_SINGLE_TOOL_CALL');
   const tc=message.tool_calls[0];let args;try{args=JSON.parse(tc.function.arguments);}catch{throw Error('INVALID_TOOL_JSON');}
   if(tc.function.name==='finish'){record.result=args;record.status='completed';break;}
   messages.push({role:'assistant',content:message.content??null,tool_calls:message.tool_calls});
   const action={turn,name:tc.function.name,args,startedAt:new Date().toISOString(),eventsFrom:runtime.events.length};
   try{action.response=runtime.run(tc.function.name,args);action.status='completed';}catch(e){action.response={error:e.message};action.status='rejected';errorCount++;}
   action.eventsTo=runtime.events.length;action.finishedAt=new Date().toISOString();record.actions.push(action);onEvent({type:'tool.finished',...action});
   messages.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify(action.response)});
   if(errorCount>=3)throw Error('TOOL_ERROR_LIMIT');
  }
  if(record.status!=='completed')throw Error('MODEL_CALL_LIMIT');
 }catch(e){record.status='failed';record.error=e.message;}
 const sentObservationCount=record.calls.at(-1)?.observationCount||0;
 const observed=runtime.events.filter(e=>e.kind==='view.observed').slice(0,sentObservationCount);
 const sourceCells=new Set(),derived=new Set();for(const e of observed)for(const row of e.provenance)for(const origin of Object.values(row))for(const token of origin)(token.startsWith('derived:')?derived:sourceCells).add(token);
 record.events=runtime.events;record.metrics={modelCalls:record.calls.length,totalTokens:record.calls.reduce((s,c)=>s+(c.usage?.total_tokens||0),0),providerRequestBytes:record.calls.reduce((s,c)=>s+Buffer.byteLength(c.requestBody),0),sourceCells:sourceCells.size,derivedValues:derived.size,materializedCells:observed.reduce((s,e)=>s+e.leaves.length,0),repeatedObservationCells:record.calls.reduce((s,c)=>s+c.observationCells,0),elapsedModelMs:record.calls.reduce((s,c)=>s+c.elapsedMs,0),toolErrors:errorCount};
 record.finishedAt=new Date().toISOString();return record;
}
