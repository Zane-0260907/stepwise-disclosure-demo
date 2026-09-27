import {createHash,randomUUID} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// A common execution substrate for ALL comparison arms. It is deliberately
// not presented as a new consent, transaction or capability algorithm.
export function localConfirmations(){
 const pending=new Map();const events=[];
 return {
  events,
  prepare({name,args,dbHash}){
   const id=randomUUID(),body={name,args:structuredClone(args),dbHash};
   pending.set(id,{...body,digest:digest(body)});
   events.push({type:'local.prepared',id,name,argumentsDigest:digest(args),dbHash});
   return {id,name,arguments:structuredClone(args)};
  },
  consume(id,{approved,dbHash}){
   const body=pending.get(id);if(!body)throw Error('UNKNOWN_OR_CONSUMED_CONFIRMATION');
   // Consume on refusal and stale state as well: a fresh proposal is required.
   pending.delete(id);
   events.push({type:'local.confirmed',id,approved:approved===true,dbHash});
   if(approved!==true)throw Error('LOCAL_USER_DECLINED');
   if(dbHash!==body.dbHash)throw Error('STATE_CHANGED_SINCE_CONFIRMATION');
   if(digest({name:body.name,args:body.args,dbHash:body.dbHash})!==body.digest)throw Error('CONFIRMATION_BODY_CHANGED');
   events.push({type:'local.committed',id,name:body.name});
   return {name:body.name,args:structuredClone(body.args)};
  }
 };
}

export function confirmationTools(tools,mutatingTools){
 const writes=new Set(mutatingTools);
 return tools.map(t=>{
  if(!writes.has(t.function.name))return t;
  const result=structuredClone(t);
  result.function.name='propose_'+t.function.name;
  result.function.description='Propose this operation in the local customer confirmation panel. The panel resolves local_ref_ values, shows the EXACT native arguments to the customer, and requests approval BEFORE any change. A denial does not execute it. You may propose an operation using existing-record tokens; do not ask the customer to type the hidden values again. '+t.function.description;
  return result;
 });
}

export const LOCAL_CONFIRMATION_INSTRUCTION=`State-changing tools are exposed as propose_<native tool name>. Calling one proposes a local action; it does NOT bypass customer approval. A trusted local panel first resolves any local_ref_ values, shows the actual action details directly to the customer and collects explicit approval. Only then does the controller execute the original business tool. Its response reports whether approval and execution occurred. You may use a token from an existing order to propose copying that address; the customer can inspect the real address in the local panel. Do not demand that the customer repeat hidden fields in chat. Read tools and business eligibility rules are unchanged. Never claim that a proposed or declined action has executed.`;

export const CONFIRMATION_SCHEMA={type:'function',function:{name:'submit_local_confirmation',description:'Return the customer decision on the exact local operation shown.',parameters:{type:'object',properties:{approve:{type:'boolean'},reason:{type:'string'}},required:['approve','reason'],additionalProperties:false}}};
