import {randomBytes,createHash} from 'node:crypto';
const protectedKeys=new Set(['address1','address2','zip','email','last_four','dob']);
const sinks={address1:['modify_pending_order_address','modify_user_address'],address2:['modify_pending_order_address','modify_user_address'],zip:['modify_pending_order_address','modify_user_address','find_user_id_by_name_zip'],email:['find_user_id_by_email'],dob:['book_reservation','update_reservation_passengers'],last_four:[]};
const copy=x=>structuredClone(x);
const at=(root,path)=>path.reduce((v,k)=>v?.[k],root);
/** References are a known technique, not claimed as a new cryptographic primitive.
 * Here the distinct candidate check is source + current value + argument purpose.
 * Unrestricted token restoration is retained as an explicit comparison mode.
 */
export function boundViews({mode='scoped'}={}){
 if(!['full','masked','tokenized','scoped'].includes(mode))throw Error('INVALID_VIEW_MODE');
 const nonce=randomBytes(12).toString('hex'),refs=new Map(),events=[];let serial=0;
 function project(value,{sourceRoot=null}={}){
  function visit(v,path){
   if(Array.isArray(v))return v.map((x,i)=>visit(x,[...path,i]));
   if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x,[...path,k])]));
   const field=path.at(-1);
   if(mode==='full'||!protectedKeys.has(field)||v===null||v==='')return v;
   if(mode==='masked')return '[LOCAL ONLY]';
   // Stable within this source field/version, unlinkable across runtime sessions.
   const source=sourceRoot?[...sourceRoot,...path]:null;
   const fingerprint=JSON.stringify({source,field,value:v});
   let found=[...refs].find(([,r])=>r.fingerprint===fingerprint);
   if(!found){const token='local_ref_'+createHash('sha256').update(nonce+':'+(++serial)).digest('hex').slice(0,16);const r={field,value:copy(v),source,fingerprint};refs.set(token,r);found=[token,r];events.push({type:'reference.created',token,field,source});}
   return found[0];
  }
  return visit(value,[]);
 }
 function bind(tool,args,currentDb){
  const used=[];
  function visit(value,path){
   if(Array.isArray(value))return value.map((x,i)=>visit(x,[...path,i]));
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,x])=>[k,visit(x,[...path,k])]));
   if(typeof value!=='string')return value;
   if(value.includes('local_ref_')&&!refs.has(value))throw Error('UNKNOWN_OR_EMBEDDED_REFERENCE');
   const reference=refs.get(value);if(!reference)return value;
   if(mode==='scoped'){
    if(path.at(-1)!==reference.field||!sinks[reference.field]?.includes(tool))throw Error('REFERENCE_PURPOSE_MISMATCH');
    if(!reference.source||JSON.stringify(at(currentDb,reference.source))!==JSON.stringify(reference.value))throw Error('STALE_OR_UNBOUND_REFERENCE');
   }
   used.push({token:value,source:reference.source,destination:path});return copy(reference.value);
  }
  const result=visit(args,[]);events.push({type:'arguments.bound',tool,references:used});return result;
 }
 function sourceRoot(tool,args,result,domain){
  if(!result||typeof result!=='object')return null;
  const root=tool==='get_user_details'||tool==='modify_user_address'?'users':domain==='retail'&&('order_id'in result)?'orders':domain==='airline'&&('reservation_id'in result)?'reservations':null;
  if(!root)return null;
  const key=root==='users'?'user_id':root==='orders'?'order_id':'reservation_id';
  return [root,result[key]||args[key]];
 }
 return {project,bind,sourceRoot,events,mode};
}
export const BOUND_VIEW_INSTRUCTION=`Some exact address, contact and birth-date values are represented by opaque local_ref_ tokens. These tokens are not their actual values. When a native tool needs such an existing value, pass the complete token unchanged in the corresponding argument (including nested passenger dob); a local adapter binds it just before execution. Never guess or reconstruct a hidden value. Do not quote opaque tokens to the user; describe the existing record, city or passenger instead. If existing values cannot answer a question, ask the user. Tool execution and business policies are otherwise unchanged.`;
