import test from 'node:test';import assert from 'node:assert/strict';
import {boundViews} from '../src/research/bound-views-v10.mjs';
const db={orders:{o:{order_id:'o',address:{address1:'12 Private Road',address2:'Unit 3',city:'Washington',zip:'20307'}}}};
test('a registered local write can use an address without exposing its street value to the planner',()=>{
 const v=boundViews();const observed=v.project(db.orders.o,{sourceRoot:['orders','o']});
 assert.equal(observed.address.city,'Washington');assert.ok(!JSON.stringify(observed).includes('Private Road'));
 const raw=v.bind('modify_pending_order_address',{order_id:'p',...observed.address},db);assert.deepEqual(raw,{order_id:'p',...db.orders.o.address});
});
test('scoped binding rejects forwarding to free text, field substitution, stale values and foreign sessions',()=>{
 const v=boundViews(),other=boundViews();const a=v.project(db.orders.o,{sourceRoot:['orders','o']}).address;
 assert.throws(()=>v.bind('transfer_to_human_agents',{summary:a.address1},db),/PURPOSE_MISMATCH/);
 assert.throws(()=>v.bind('modify_user_address',{zip:a.address1},db),/PURPOSE_MISMATCH/);
 assert.throws(()=>v.bind('modify_user_address',{address1:'copy '+a.address1},db),/EMBEDDED_REFERENCE/);
 assert.throws(()=>other.bind('modify_user_address',{address1:a.address1},db),/UNKNOWN_OR_EMBEDDED_REFERENCE/);
 const updated=structuredClone(db);updated.orders.o.address.address1='Changed';assert.throws(()=>v.bind('modify_user_address',{address1:a.address1},updated),/STALE_OR_UNBOUND_REFERENCE/);
});
test('the reversible-token control exposes the exact limitation tested by scoped binding',()=>{
 const v=boundViews({mode:'tokenized'});const a=v.project(db.orders.o,{sourceRoot:['orders','o']}).address;
 assert.equal(v.bind('transfer_to_human_agents',{summary:a.address1},db).summary,'12 Private Road');
});
