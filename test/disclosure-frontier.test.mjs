import test from 'node:test';
import assert from 'node:assert/strict';
import {planDisclosure,VersionedFacts,materialize,sealDecision,disclosureTokens} from '../src/research/disclosure-frontier.mjs';

test('continuation union avoids a per-step disclosure trap',()=>{
 const steps=[{id:'a',alternatives:[{id:'A',tokens:['r:x','r:y'],work:1},{id:'B',tokens:['s:z'],work:1}]},{id:'b',alternatives:[{id:'A',tokens:['r:x','r:y'],work:1}]}];
 assert.equal(planDisclosure(steps).newDisclosure.length,2);assert.equal(planDisclosure(steps,[],{strategy:'greedy'}).newDisclosure.length,3);
});
test('frontier objective matches independent exhaustive products on 250 seeded instances',()=>{
 let seed=619;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<250;trial++){
  const history=['r:0'];const steps=Array.from({length:1+rand(5)},(_,i)=>({id:String(i),alternatives:Array.from({length:1+rand(3)},(_,j)=>({id:`${i}-${j}`,work:rand(4),tokens:[...new Set(Array.from({length:rand(4)},()=>`${rand(2)?'r':'s'}:${rand(6)}`))]}))}));
  let best=[Infinity,Infinity];function enumerate(i,tokens,cost){if(i===steps.length){const count=[...tokens].filter(x=>!history.includes(x)).length;if(count<best[0]||count===best[0]&&cost<best[1])best=[count,cost];return;}for(const a of steps[i].alternatives)enumerate(i+1,new Set([...tokens,...a.tokens]),cost+a.work);}
  enumerate(0,new Set(history),0);const result=planDisclosure(steps,history);assert.deepEqual([result.newDisclosure.length,result.work],best);
 }
});
test('history is recipient-specific; infeasible choices cannot be restored by optimization',()=>{
 const a={id:'x',recipient:'r',view:{amount:10},versions:{amount:1},work:1};
 const left=disclosureTokens('r',a.view,a.versions),right=disclosureTokens('s',a.view,a.versions);assert.notDeepEqual(left,right);
 assert.equal(planDisclosure([{id:'x',alternatives:[{...a,tokens:right}]}],left).newDisclosure.length,1);
 assert.equal(planDisclosure([{id:'x',alternatives:[{...a,tokens:left,feasible:false}]}]).feasible,false);
});
test('derived and decision dependencies invalidate even when body bytes did not change',()=>{
 const store=new VersionedFacts({amount:100,rate:0.2,enabled:true,note:'a'});
 const m=materialize(store,['total'],{total:r=>r('amount')*r('rate')});
 const a={id:'computed',recipient:'r',...m};const ticket=sealDecision(store,{stepId:'s',alternative:a,guardKeys:['enabled']});
 store.set('note','b');assert.ok(store.current(ticket.versions));
 store.set('enabled',false);assert.ok(store.current(ticket.valueVersions));assert.equal(store.current(ticket.versions),false);
 store.set('enabled',true);assert.equal(store.current(ticket.versions),false,'ABA cannot restore old decision version');
 const other=sealDecision(store,{stepId:'s',alternative:a,guardKeys:['enabled']});store.set('rate',0.3);assert.equal(store.current(other.versions),false);
});
test('invalid graph, missing inputs and oversized frontiers fail explicitly',()=>{
 const store=new VersionedFacts({x:1});assert.throws(()=>materialize(store,['a'],{a:r=>r('b'),b:r=>r('a')}),/CYCLIC/);
 assert.throws(()=>materialize(store,['missing']),/UNKNOWN/);
 assert.throws(()=>planDisclosure([{id:'x',alternatives:[{id:'a',tokens:['a'],work:1},{id:'b',tokens:['b'],work:1}]}],[],{maxLabels:1}),/BOUND/);
});
