// Exact lexicographic finite-candidate planning. Unlike a multi-objective
// Pareto set, a strict improvement in retired disclosure dominates any work
// cost at an equal live set and no greater traffic.
// Exact finite-candidate planning. Retire an item's SEARCH STATE at its last
// possible use; never erase the runtime recipient's disclosure history.
const signature = s => JSON.stringify([...s].sort());
const pathKey = p => p.map(x=>x.id).join('/');
const order = (a,b) => a.retired+a.live.size-b.retired-b.live.size || a.work-b.work || a.fields-b.fields || pathKey(a.path).localeCompare(pathKey(b.path));

export function planLexFrontier(steps, history=[], {slack=Infinity,maxFields=Infinity,maxLabels=4096}={}) {
  if (!(slack>=0) || !(maxFields>=0) || !Number.isInteger(maxLabels) || maxLabels<1) throw Error('INVALID_PLANNER_LIMIT');
  const initial=new Set(history);
  const choices=steps.map(s=>s.alternatives.filter(a=>a.feasible).map(a=>{
    if(!Number.isInteger(a.fields)||a.fields<0||!Number.isInteger(a.work)||a.work<0||typeof a.id!=='string'||!Array.isArray(a.tokens)||a.tokens.some(t=>typeof t!=='string'))throw Error('INVALID_ALTERNATIVE_COST');
    return {...a,tokens:[...new Set(a.tokens)]};
  }));
  if(choices.some(a=>!a.length))return {feasible:false,reason:'NO_AUTHORIZED_IMPLEMENTATION'};
  let g={tokens:new Set(initial),fields:0,work:0,path:[]};
  for(const alternatives of choices){
    g=alternatives.map(a=>({tokens:new Set([...g.tokens,...a.tokens]),fields:g.fields+a.fields,work:g.work+a.work,path:[...g.path,a]}))
      .sort((a,b)=>a.tokens.size-b.tokens.size||a.work-b.work||a.fields-b.fields||pathKey(a.path).localeCompare(pathKey(b.path)))[0];
  }
  const budget=Math.min(maxFields,Number.isFinite(slack)?Math.floor(g.fields*(1+slack)+1e-9):Infinity);
  const future=Array(steps.length+1);future[steps.length]=new Set();
  for(let i=steps.length-1;i>=0;i--)future[i]=new Set([...future[i+1],...choices[i].flatMap(a=>a.tokens).filter(t=>!initial.has(t))]);
  let states=[{live:new Set(),retired:0,fields:0,work:0,path:[]}],visited=0,peak=1,width=0;
  const seen=new Set();
  for(let i=0;i<choices.length;i++){
    for(const a of choices[i])for(const t of a.tokens)if(!initial.has(t))seen.add(t);
    width=Math.max(width,[...seen].filter(t=>future[i+1].has(t)).length);
    const groups=new Map();
    for(const state of states)for(const a of choices[i]){
      visited++;const fields=state.fields+a.fields;if(fields>budget)continue;
      const union=new Set([...state.live,...a.tokens.filter(t=>!initial.has(t))]);
      const live=new Set([...union].filter(t=>future[i+1].has(t)));
      const candidate={live,retired:state.retired+union.size-live.size,fields,work:state.work+a.work,path:[...state.path,a]};
      const key=signature(live),group=groups.get(key)||[];
      const dominates=(x,y)=>x.fields<=y.fields&&(x.retired<y.retired||(x.retired===y.retired&&x.work<=y.work));
      if(group.some(x=>dominates(x,candidate)))continue;
      const kept=group.filter(x=>!dominates(candidate,x));kept.push(candidate);groups.set(key,kept);
    }
    states=[...groups.values()].flat();peak=Math.max(peak,states.length);
    if(states.length>maxLabels)throw Object.assign(Error('FRONTIER_BOUND_EXCEEDED'),{peak,visited,width});
    if(!states.length)return {feasible:false,reason:'NO_BUDGET_FEASIBLE_PLAN',budget,referenceFields:g.fields,peak,visited,width};
  }
  const best=states.sort(order)[0],tokens=new Set(best.path.flatMap(a=>a.tokens));
  const result={feasible:true,path:best.path,newDisclosures:[...tokens].filter(t=>!initial.has(t)).sort(),work:best.work,fields:best.fields,budget:Number.isFinite(budget)?budget:null,referenceFields:g.fields,visited,peak,width};
  if(best.live.size||result.newDisclosures.length!==best.retired)throw Error('RETIREMENT_ACCOUNTING_MISMATCH');
  return result;
}

export function enumeratePlans(steps,history=[],maxFields=Infinity){
  const initial=new Set(history);let best=null,visited=0;
  function visit(i,tokens,work,fields,path){
    if(fields>maxFields)return;
    if(i===steps.length){
      visited++;const c={live:tokens,retired:0,work,fields,path};
      if(!best||order(c,best)<0)best=c;return;
    }
    for(const a of steps[i].alternatives.filter(a=>a.feasible))visit(i+1,new Set([...tokens,...a.tokens.filter(t=>!initial.has(t))]),work+a.work,fields+a.fields,[...path,a]);
  }
  visit(0,new Set(),0,0,[]);
  return best?{feasible:true,path:best.path,newDisclosures:[...best.live].sort(),work:best.work,fields:best.fields,visited}:{feasible:false};
}

// The proof uses only equality of live token sets. Subset dominance can be
// added, but is deliberately omitted here to keep each merge independently
// checkable and avoid quadratic comparisons across unrelated live sets.
export const liveStateInvariant = {historyIsPersistent:true,closedItemsRemainCharged:true,usesOnlyKnownSuffix:true};
