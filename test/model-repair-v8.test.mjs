import test from 'node:test';
import assert from 'node:assert/strict';
import {planBudgeted} from '../src/research/budget-frontier-v8.mjs';
import {METHODS,CONDITIONS,executeModelGraph,createNumericReceiver,validateGraph} from '../src/research/model-repair-v8.mjs';
import {evaluateLocalProgram} from '../src/research/local-program.mjs';

test('budget frontier agrees with exhaustive search on 240 varied small instances',()=>{
 let seed=971;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
 for(let trial=0;trial<240;trial++){
  const steps=Array.from({length:2+trial%4},(_,i)=>({alternatives:Array.from({length:3},(_,j)=>({id:`${i}-${j}`,feasible:true,tokens:[`t${Math.floor(random()*6)}`,`t${Math.floor(random()*6)}`],fields:Math.ceil(random()*4),work:1+Math.floor(random()*3)}))}));
  const history=trial%2?['t0']:[],greedy=planBudgeted(steps,history,{strategy:'greedy'}),slack=[0,.1,.25,Infinity][trial%4];
  const budget=Number.isFinite(slack)?Math.floor(greedy.fields*(1+slack)+1e-9):Infinity;
  let paths=[{tokens:new Set(history),work:0,fields:0}];
  for(const step of steps)paths=paths.flatMap(p=>step.alternatives.map(a=>({tokens:new Set([...p.tokens,...a.tokens]),work:p.work+a.work,fields:p.fields+a.fields}))).filter(p=>p.fields<=budget);
  const best=paths.sort((a,b)=>a.tokens.size-b.tokens.size||a.work-b.work||a.fields-b.fields)[0],actual=planBudgeted(steps,history,{slack});
  assert.deepEqual([actual.newDisclosures.length+history.length,actual.work,actual.fields],[best.tokens.size,best.work,best.fields]);
 }
});

test('real HTTP views, changed dependencies and retained pure branches agree on every arm',async()=>{
 const receiver=await createNumericReceiver();
 const item={id:'branched',facts:{a:10,b:2,c:6,d:3,unused:99}};
 const model={id:'synthetic-test',status:'ready',parentToolCallId:'fixture',program:[
  {op:'multiply',args:[{field:'a'},{field:'b'}]},
  {op:'add',args:[{field:'c'},{field:'d'}]},
  {op:'divide',args:[{step:0},{step:1}]}
 ]};
 try{for(const condition of CONDITIONS)for(const method of METHODS){
  const r=await executeModelGraph(item,model,condition,method,receiver);
  assert.equal(r.status,'completed',r.error);assert.equal(r.value,evaluateLocalProgram(model.program,r.finalFacts,Object.keys(item.facts)).value);
  assert.equal(r.receipts.length,r.metrics.remoteCalls);
  if(condition==='all_local')assert.equal(r.metrics.numericFields,0);
  if(condition==='source_unrelated'&&method!=='restart_greedy')assert.equal(r.metrics.reused,1);
  if(method.startsWith('budget_'))for(const phase of new Set(r.decisions.map(d=>d.phase))){
   const ds=r.decisions.filter(d=>d.phase===phase);assert.ok(ds.every(d=>d.fields<=d.budget));
   assert.ok(ds.at(-1).budget>=0);
  }
 }}finally{await receiver.close();}
});

test('model graph rejects forward references, unused work and unauthorized fields before execution',()=>{
 assert.throws(()=>validateGraph([{op:'add',args:[{step:0},{constant:1}]}],['a']),/REFERENCE/);
 assert.throws(()=>validateGraph([{op:'add',args:[{field:'secret'},{constant:1}]}],['a']),/FIELD/);
 assert.throws(()=>validateGraph([{op:'add',args:[{field:'a'},{constant:1}]},{op:'add',args:[{field:'a'},{constant:2}]}],['a']),/UNUSED/);
});
