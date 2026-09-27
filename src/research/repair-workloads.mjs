import {VersionedFacts,materialize,disclosureTokens} from './disclosure-frontier.mjs';

export const REPAIR_METHODS=['payload_only','full_restart','selective_greedy','selective_frontier','freshctx_restart','freshctx_frontier'];
export const MUTATIONS=['none','unused','base','limit','capability_lost','capability_gained','recipient_revoked','recipient_changed','all_revoked','aba','new_step','between_steps'];
export const RECIPES={daily:r=>r('base')*r('factor'),total:r=>r('daily')*r('units'),bounded:r=>Math.min(r('total'),r('limit'))};
export const KEYS={
 quote:{raw:['base','factor','units'],compact:['daily','units']},
 cap:{raw:['base','factor','units','limit'],compact:['total','limit']},
 flag:{raw:['base','factor','units','limit'],compact:['total','limit']},
 record:{raw:['base','factor','units','limit'],compact:['bounded']}
};
export const OP_LABELS={quote:{zh:'核算当前金额',en:'Calculate the current amount'},cap:{zh:'应用金额上限',en:'Apply the amount limit'},flag:{zh:'检查是否超过上限',en:'Check the limit'},record:{zh:'生成新增汇总记录',en:'Build the newly requested summary'}};

export function makeRepairCases({development=false,count=24}={}){
 const cases=[];
 for(let i=0;i<count;i++)for(const mutation of MUTATIONS){
  const n=development?i+1000:i+100;
  cases.push({id:`${development?'dev':'test'}-repair-${i.toString().padStart(2,'0')}-${mutation}`,seed:n,mutation,
    values:{base:100+n*13,factor:(1+n%7)/100,units:2+n%11,limit:100+n%5*100,unused:`local-note-${n}`,local:mutation==='capability_lost'||mutation==='aba'?true:mutation==='capability_gained'?false:i%4===0,allow:true,allowA:true,allowB:true,endpointA:'service-A',endpointB:'service-B'},
    tasks:[['quote','cap','flag'],['quote','cap','record'],['cap','record','flag'],['quote','record','flag']][i%4],source:'Author-created finite-operation workflow; not a language-model benchmark',split:development?'development':'test'});
 }
 return cases;
}
export function newRepairStore(item){return new VersionedFacts(item.values);}
export function alternatives(store,operation){
 const defs=[{kind:'local',recipient:'local',fields:KEYS[operation].raw,guards:['local','allow'],feasible:store.values.local&&store.values.allow},
 {kind:'raw',recipient:store.values.endpointA,fields:KEYS[operation].raw,guards:['allow','allowA','endpointA'],feasible:store.values.allow&&store.values.allowA},
 {kind:'compact',recipient:store.values.endpointB,fields:KEYS[operation].compact,guards:['allow','allowB','endpointB'],feasible:store.values.allow&&store.values.allowB}];
 return defs.map(d=>{const m=materialize(store,d.fields,RECIPES);return {...d,id:`${operation}:${d.kind}`,operation,...m,tokens:disclosureTokens(d.recipient,m.view,m.versions,m.lineage),work:d.kind==='local'?0:1};});
}
export function applyRepairMutation(store,mutation){
 const changes=[];const set=(k,v)=>{const before=store.read(k);store.set(k,v);changes.push({key:k,before,after:store.read(k)});};
 if(mutation==='unused')set('unused','updated-local-note');
 if(mutation==='base')set('base',store.values.base+73);
 if(mutation==='limit'||mutation==='between_steps')set('limit',store.values.limit+211);
 if(mutation==='capability_lost')set('local',false);
 if(mutation==='capability_gained')set('local',true);
 if(mutation==='recipient_revoked')set('allowA',false);
 if(mutation==='recipient_changed')set('endpointA','service-A2');
 if(mutation==='all_revoked')set('allow',false);
 if(mutation==='aba'){const old=store.values.local;set('local',!old);set('local',old);}
 return changes;
}
export function executeRegistered(operation,kind,view){
 const total=kind==='compact'?(operation==='quote'?view.daily*view.units:view.total):view.base*view.factor*view.units;
 if(operation==='quote')return total;
 if(operation==='cap')return Math.min(total,view.limit);
 if(operation==='flag')return total>view.limit;
 if(operation==='record')return kind==='compact'?view.bounded:Math.min(total,view.limit);
 throw Error('UNKNOWN_REGISTERED_OPERATION');
}

// Deliberately separate scoring formula: no plan, candidate or runtime helper
// is used here. This is an executable specification for a finite synthetic task.
export function repairOracle(values,tasks){
 const amount=values.base*values.factor*values.units;
 return Object.fromEntries(tasks.map(op=>[op,op==='quote'?amount:op==='flag'?amount>values.limit:Math.min(amount,values.limit)]));
}
