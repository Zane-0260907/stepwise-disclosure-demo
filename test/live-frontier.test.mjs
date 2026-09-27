import test from 'node:test';
import assert from 'node:assert/strict';
import {planLiveFrontier,enumeratePlans} from '../src/research/live-frontier.mjs';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
import {planComponentFrontier} from '../src/research/component-frontier.mjs';
import {planDisclosureFrontier} from '../src/research/bounded-disclosure-frontier.mjs';
const a=(id,tokens,fields=tokens.length,work=1)=>({id,tokens,fields,work,feasible:true});
const value=p=>p.feasible?[p.newDisclosures.length,p.work,p.fields]:null;
function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}

test('all three planners match independent enumeration over 250 small cases',()=>{
  for(let seed=31000;seed<31250;seed++){
    const r=random(seed),n=1+Math.floor(r()*6),history=r()<.5?['r:t0']:[];
    const steps=Array.from({length:n},(_,i)=>({alternatives:Array.from({length:3},(_,j)=>a(`${i}-${j}`,Array.from({length:1+Math.floor(r()*3)},()=>`r:t${Math.floor(r()*9)}`),1+Math.floor(r()*4),1+Math.floor(r()*3)))}));
    const legacy=planBudgeted(steps,history,{slack:.25,maxLabels:100000});
    const candidate=planLiveFrontier(steps,history,{slack:.25,maxLabels:100000});
    const exhaustive=enumeratePlans(steps,history,legacy.budget);
    assert.deepEqual(value(candidate),value(exhaustive),`seed ${seed}`);
    assert.deepEqual(value(legacy),value(exhaustive),`legacy seed ${seed}`);
    assert.deepEqual(value(planComponentFrontier(steps,history,{slack:.25,maxLabels:100000})),value(exhaustive),`components seed ${seed}`);
    assert.deepEqual(value(planDisclosureFrontier(steps,history,{slack:.25,maxLabels:100000})),value(exhaustive),`lex components seed ${seed}`);
  }
});
test('disconnected cost components preserve a shared budget and original execution order',()=>{
 const steps=Array.from({length:40},(_,i)=>({alternatives:[a('private',[`u:${i}`]),a('shared',[`x:${i%20}`,`y:${i%20}`])]}));
 const p=planComponentFrontier(steps,[],{maxFields:60});assert.equal(p.components,20);assert.equal(p.largestComponent,2);assert.equal(p.newDisclosures.length,40);assert.equal(p.fields,40);assert.equal(p.path.length,40);
});
test('retirement collapses independent choices without erasing costs',()=>{
  const steps=Array.from({length:30},(_,i)=>({alternatives:[a('a',[`a:${i}`]),a('b',[`b:${i}`])]}));
  const p=planLiveFrontier(steps);assert.equal(p.newDisclosures.length,30);assert.equal(p.peak,1);assert.equal(p.width,0);
  assert.throws(()=>planBudgeted(steps,[],{maxLabels:64}),/FRONTIER_BOUND/);
});
test('future sharing, recipient identity, history and budget remain distinct',()=>{
  const steps=[{alternatives:[a('short',['other:u']),a('shared',['cloud:x','cloud:y'])]},{alternatives:[a('shared',['cloud:x','cloud:y']),a('long',['other:v','other:w'])]}];
  assert.deepEqual(value(planLiveFrontier(steps)),[2,2,4]);
  assert.deepEqual(value(planLiveFrontier(steps,[],{maxFields:3})),[3,2,3]);
  const h=['cloud:x','cloud:y'];const copy=[...h];assert.deepEqual(value(planLiveFrontier(steps,h)),[0,2,4]);assert.deepEqual(h,copy);
  assert.equal(planLiveFrontier([{alternatives:[a('x',['other:x'])]}],['cloud:x']).newDisclosures.length,1);
});
test('infeasible and empty plans, zero-cost alternatives and explicit bound',()=>{
  assert.equal(planLiveFrontier([{alternatives:[]}]).feasible,false);
  assert.equal(planLiveFrontier([{alternatives:[a('a',['x'],2)]}],[],{maxFields:1}).feasible,false);
  assert.deepEqual(value(planLiveFrontier([])),[0,0,0]);
  assert.deepEqual(value(planLiveFrontier([{alternatives:[a('local',[],0,1)]}])),[0,1,0]);
  assert.throws(()=>planLiveFrontier([{alternatives:[a('bad',[],0,NaN)]}]),/INVALID_ALTERNATIVE/);
});
test('newly discovered suffix reuses full runtime history after prior retirement',()=>{
  const p=planLiveFrontier([{alternatives:[a('first',['r:x'])]}]);
  const q=planLiveFrontier([{alternatives:[a('again',['r:x']),a('other',['r:y'])]}],p.newDisclosures);
  assert.equal(q.newDisclosures.length,0);assert.equal(q.path[0].id,'again');
});
