import {nativeTau} from './native-tau-v10.mjs';
import {createHash} from 'node:crypto';
import {boundViews,BOUND_VIEW_INSTRUCTION} from './bound-views-v10.mjs';
import {localConfirmations,confirmationTools,LOCAL_CONFIRMATION_INSTRUCTION,CONFIRMATION_SCHEMA} from './local-confirmation-v10.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const NATIVE_SYSTEM='You are a customer service agent. Follow the supplied domain policy. On a turn, either call exactly one tool OR send a message to the user. Obtain the explicit confirmations required by policy before state-changing actions. Never fabricate records or ignore a failed tool result.';
export async function runNativeTask(item,connection,{userGuidelines,recordCall=()=>{},onEvent=()=>{},maxAgentCalls=40,maxUserCalls=20,viewMode='full',localConfirmation=false}={}){
 const bridge=nativeTau();const views=boundViews({mode:viewMode});const confirmations=localConfirmations();const record={caseId:item.id,domain:item.domain,method:'native-'+viewMode+(localConfirmation?'-local-confirmation':''),status:'running',startedAt:new Date().toISOString(),calls:[],actions:[],conversation:[],protocolViolations:[],localPanels:[]};
 async function model(role,messages,tools,extra={}){
  const body=JSON.stringify({model:'deepseek-flash',temperature:0,messages,max_tokens:role==='agent'?1700:700,...(tools?{tools,parallel_tool_calls:false}: {}),...extra});
  const started=performance.now();await recordCall({phase:'before',role,body});
  const response=await fetch(connection.url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+connection.token},body,signal:AbortSignal.timeout(95000)});
  const responseBody=await response.text();let data;try{data=JSON.parse(responseBody);}catch{data={};}
  const c={index:record.calls.length,role,requestBody:body,requestSha256:sha(body),responseBody,responseSha256:sha(responseBody),status:response.status,usage:data.usage||null,elapsedMs:performance.now()-started};
  record.calls.push(c);await recordCall({phase:'after',role,call:c});onEvent({type:'model.returned',role,index:c.index});
  if(!response.ok)throw Error('MODEL_HTTP_'+response.status);
  if(!data.choices?.[0]?.message)throw Error('EMPTY_MODEL_MESSAGE');
  return data.choices[0].message;
 }
 try{
  const info=await bridge.call({command:'init',domain:item.domain});record.initialDbHash=info.dbHash;
  const exposedTools=localConfirmation?confirmationTools(info.tools,info.mutatingTools):info.tools;
  const agent=[{role:'system',content:NATIVE_SYSTEM+'\n\n'+info.policy+(viewMode==='full'?'':'\n\n'+BOUND_VIEW_INSTRUCTION)+(localConfirmation?'\n\n'+LOCAL_CONFIRMATION_INSTRUCTION:'')}];
  const user=[{role:'system',content:userGuidelines+'\n\n<scenario>\n'+JSON.stringify(item.userScenario)+'\n</scenario>'},{role:'user',content:'Please begin the customer service conversation.'}];
  let agentCalls=0,userCalls=0,needUser=true;
  while(agentCalls<maxAgentCalls&&userCalls<maxUserCalls){
   if(needUser){
    const reply=await model('user-simulator',user);userCalls++;const content=reply.content||'';
    user.push({role:'assistant',content});record.conversation.push({role:'user',content});
    if(/###(?:STOP|TRANSFER|OUT-OF-SCOPE)###/.test(content)){record.status='completed';record.stopReason=content;break;}
    agent.push({role:'user',content});needUser=false;
   }
   const message=await model('agent',agent,exposedTools);agentCalls++;
   const agentCallIndex=record.calls.length-1;
   if(message.tool_calls?.length){
    if(message.tool_calls.length!==1)record.protocolViolations.push({callIndex:record.calls.length-1,type:'multiple-tools',count:message.tool_calls.length});
    if(message.content?.trim())record.protocolViolations.push({callIndex:record.calls.length-1,type:'text-with-tools'});
    agent.push({role:'assistant',content:message.content??null,tool_calls:message.tool_calls});
    // The upstream text orchestrator executes every tool call in order. Policy
    // violations remain visible and are not counted as policy-compliant success.
    for(const tool of message.tool_calls){
    let args;try{args=JSON.parse(tool.function.arguments);}catch{throw Error('INVALID_TOOL_JSON');}
    const started=performance.now();let result,boundArgs=args,nativeExecuted=false,confirmationId=null;
    const proposed=localConfirmation&&tool.function.name.startsWith('propose_');
    const nativeName=proposed?tool.function.name.slice(8):tool.function.name;
    let snapshot=await bridge.call({command:'snapshot'});
    try{
     if(!exposedTools.some(t=>t.function.name===tool.function.name))throw Error('UNEXPOSED_TOOL');
     if(viewMode!=='full'){
      boundArgs=views.bind(nativeName,args,snapshot.db);
     }
     if(proposed){
      if(userCalls>=maxUserCalls)throw Error('LOCAL_USER_CALL_LIMIT');
      await bridge.call({command:'validate',name:nativeName,arguments:boundArgs});
      const offer=confirmations.prepare({name:nativeName,args:boundArgs,dbHash:snapshot.dbHash});
      confirmationId=offer.id;
      const panel='The trusted LOCAL customer panel proposes ONE atomic operation. These details are visible to you, not the remote planning agent. Decide using only your scenario and conversation. A request affecting several records is confirmed one operation at a time; approve a correct component of your request even if other components remain, unless your scenario explicitly requires atomic all-or-nothing execution. This is not a claim that the whole task is finished. Decline wrong or unwanted operations. Return submit_local_confirmation. This proposal has NOT executed.\n'+JSON.stringify(offer);
      user.push({role:'user',content:panel});userCalls++;
      const answer=await model('local-user-simulator',user,[CONFIRMATION_SCHEMA],{tool_choice:{type:'function',function:{name:'submit_local_confirmation'}}});
      let decision;try{decision=JSON.parse(answer.tool_calls?.[0]?.function?.arguments||'{}');}catch{decision={};}
      const approved=answer.tool_calls?.length===1&&answer.tool_calls[0].function.name==='submit_local_confirmation'&&decision.approve===true;
      user.push({role:'assistant',content:'Local panel decision: '+JSON.stringify({...decision,approve:approved})});
      record.localPanels.push({id:offer.id,callIndex:record.calls.length-1,name:nativeName,arguments:boundArgs,approved,reason:decision.reason||''});
      if(!approved)user.push({role:'user',content:'The proposed local operation was declined and did not execute. Other previously executed operations, if any, remain executed.'});
      snapshot=await bridge.call({command:'snapshot'});
      const accepted=confirmations.consume(offer.id,{approved,dbHash:snapshot.dbHash});boundArgs=accepted.args;
     }
     result=await bridge.call({command:'call',name:nativeName,arguments:boundArgs});nativeExecuted=true;
     if(proposed)user.push({role:'user',content:result.errorType?'The local action failed: '+JSON.stringify(result.result):'The local action was executed: '+nativeName+'. Continue following your scenario.'});
    }
    catch(error){
     if(error.message?.startsWith('MODEL_HTTP_')||error.message==='BATCH_BUDGET'||error.name==='TimeoutError')throw error;
     result={result:{error:error.message},errorType:'AdapterValidationError',dbBefore:snapshot.dbHash,dbAfter:snapshot.dbHash,mutatesState:false};
    }
    const observation=views.project(result.result,{sourceRoot:views.sourceRoot(nativeName,boundArgs,result.result,item.domain)});
    const action={callIndex:agentCallIndex,toolCallId:tool.id,confirmationId,name:nativeName,exposedName:tool.function.name,nativeExecuted,arguments:boundArgs,plannerArguments:args,observation,...result,elapsedMs:performance.now()-started};
    record.actions.push(action);onEvent({type:'tool.returned',name:action.name,error:action.errorType});
    agent.push({role:'tool',tool_call_id:tool.id,content:JSON.stringify(observation)});
    if(tool.function.name==='transfer_to_human_agents'){record.status='completed';record.stopReason='transfer_to_human_agents';break;}
    }
    if(record.status==='completed')break;
   }else{
    const content=message.content||'';agent.push({role:'assistant',content});record.conversation.push({role:'assistant',content});user.push({role:'user',content});needUser=true;
   }
  }
  if(record.status==='running'){record.status='failed';record.error='INTERACTION_LIMIT';}
 }catch(error){record.status='failed';record.error=error.message;}
 finally{
  try{const final=await bridge.call({command:'snapshot'});record.finalDbHash=final.dbHash;}catch{}
  await bridge.close();
 }
 record.viewEvents=views.events;record.confirmationEvents=confirmations.events;record.finishedAt=new Date().toISOString();record.metrics={agentCalls:record.calls.filter(c=>c.role==='agent').length,userSimulatorCalls:record.calls.filter(c=>c.role==='user-simulator').length,localUserSimulatorCalls:record.calls.filter(c=>c.role==='local-user-simulator').length,totalTokens:record.calls.reduce((s,c)=>s+(c.usage?.total_tokens||0),0),nativeToolCalls:record.actions.filter(a=>a.nativeExecuted).length,stateChangingCalls:record.actions.filter(a=>a.mutatesState&&!a.errorType).length,toolErrors:record.actions.filter(a=>a.errorType).length};
 return record;
}
