import test from 'node:test';import assert from 'node:assert/strict';
import {createViewRuntime} from '../src/research/view-runtime-v9.mjs';
const tables={offers:{rows:[{id:'a',price:20,available:true,private:'p1'},{id:'b',price:10,available:false,private:'p2'},{id:'c',price:15,available:true,private:'p3'}]}};
test('deferred views perform local filtering before any data materialization',()=>{
 const r=createViewRuntime(tables,{denied:['private']});const h=r.run('open_table',{table:'offers'});assert.equal(r.events.filter(e=>e.kind==='view.observed').length,0);assert.ok(!h.columns.includes('private'));
 const q=r.run('query',{handle:h.handle,where:[{column:'available',op:'eq',value:true}],sort:{column:'price',direction:'asc'},limit:1,columns:['id','price']});
 assert.equal(r.events.filter(e=>e.kind==='view.observed').length,0);assert.deepEqual(r.run('observe',{handle:q.handle,columns:['id','price']}),{rows:[{id:'c',price:15}]});
 assert.equal(r.events.at(-1).leaves.length,2);
});
test('every registered query has the same values under eager and deferred materialization',()=>{
 for(let seed=1;seed<=80;seed++){
  const t={t:{rows:Array.from({length:20},(_,i)=>({id:i,v:(seed*17+i*31)%101,keep:i%3===0}))}};
  const result=[];
  for(const mode of ['eager','deferred']){const r=createViewRuntime(t,{mode});const h=r.run('open_table',{table:'t'});const q=r.run('query',{handle:h.handle,where:[{column:'keep',op:'eq',value:true}],sort:{column:'v',direction:'asc'},columns:['id','v'],limit:4});const a=r.run('aggregate',{handle:q.handle,op:'sum',column:'v'});result.push(r.run('observe',{handle:a.handle,columns:['value']}));}
  assert.deepEqual(result[0],result[1]);
 }
});
test('handles cannot cross sessions; version changes fail closed; denied columns never appear',()=>{
 const a=createViewRuntime(tables,{denied:['private']}),b=createViewRuntime(tables);const h=a.run('open_table',{table:'offers'});
 assert.throws(()=>b.run('observe',{handle:h.handle,columns:['price']}),/UNKNOWN_LOCAL_HANDLE/);
 assert.throws(()=>a.run('query',{handle:h.handle,columns:['private']}),/INVALID_COLUMNS/);
 assert.throws(()=>a.run('query',{handle:h.handle,where:[{column:'private',op:'eq',value:'p1'}]}),/INVALID_FILTER/);
 a.update('offers',0,{price:21});assert.throws(()=>a.run('observe',{handle:h.handle,columns:['price']}),/STALE_VIEW/);
});
test('derived values are explicitly recorded as disclosures, including an empty count',()=>{
 const r=createViewRuntime(tables);const h=r.run('open_table',{table:'offers'});const q=r.run('query',{handle:h.handle,where:[{column:'price',op:'gt',value:1000}]});const c=r.run('aggregate',{handle:q.handle,op:'count'});assert.deepEqual(r.run('observe',{handle:c.handle,columns:['value']}),{rows:[{value:0}]});assert.match(r.events.at(-1).provenance[0].value[0],/^derived:/);
});
test('strong eager baseline can fuse operations without exposing intermediate source data',()=>{
 const r=createViewRuntime(tables,{mode:'eager',denied:['private']});
 const result=r.run('execute_plan',{table:'offers',steps:[{op:'query',where:[{column:'available',op:'eq',value:true}]},{op:'aggregate',aggregation:'min',column:'price'}],output_columns:['value']});
 assert.deepEqual(result.rows,[{value:15}]);const disclosed=r.events.filter(e=>e.kind==='view.observed');assert.equal(disclosed.length,1);assert.equal(disclosed[0].leaves.length,1);assert.match(disclosed[0].provenance[0].value[0],/^derived:/);
});
