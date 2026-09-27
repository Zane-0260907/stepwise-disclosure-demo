import test from 'node:test';import assert from 'node:assert/strict';
import {localConfirmations,confirmationTools} from '../src/research/local-confirmation-v10.mjs';
test('only approved, unchanged, single-use local actions execute',()=>{
 const c=localConfirmations(),args={order_id:'a',address1:'private street'};
 const offer=c.prepare({name:'modify_pending_order_address',args,dbHash:'v1'});
 offer.arguments.address1='tampered';args.address1='also changed';
 assert.equal(c.consume(offer.id,{approved:true,dbHash:'v1'}).args.address1,'private street');
 assert.throws(()=>c.consume(offer.id,{approved:true,dbHash:'v1'}),/CONSUMED/);
 for(const [approved,hash,pattern] of [[false,'v1',/DECLINED/],[true,'v2',/STATE_CHANGED/]]){
  const p=c.prepare({name:'change',args:{},dbHash:'v1'});
  assert.throws(()=>c.consume(p.id,{approved,dbHash:hash}),pattern);
  assert.throws(()=>c.consume(p.id,{approved:true,dbHash:'v1'}),/CONSUMED/);
 }
});
test('common confirmation wrapper preserves native argument schemas and read tools',()=>{
 const input=[{type:'function',function:{name:'read',parameters:{type:'object'}}},{type:'function',function:{name:'write',description:'native',parameters:{type:'object',required:['id']}}}];
 const out=confirmationTools(input,['write']);assert.equal(out[0],input[0]);assert.equal(out[1].function.name,'propose_write');
 assert.deepEqual(out[1].function.parameters,input[1].function.parameters);assert.equal(input[1].function.name,'write');
});
