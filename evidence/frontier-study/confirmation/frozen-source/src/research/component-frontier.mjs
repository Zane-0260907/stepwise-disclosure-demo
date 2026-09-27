import {planLiveFrontier} from './live-frontier.mjs';
const dominates=(a,b)=>a.disclosures<=b.disclosures&&a.work<=b.work&&a.fields<=b.fields;
const rank=(a,b)=>a.disclosures-b.disclosures||a.work-b.work||a.fields-b.fields;
const pareto=items=>{const keep=[];for(const x of items){if(keep.some(k=>dominates(k,x)))continue;for(let i=keep.length-1;i>=0;i--)if(dominates(x,keep[i]))keep.splice(i,1);keep.push(x);}return keep;};

// Components concern the cost of disclosure, not execution order. We return
// alternatives in the original step order and never reorder side effects.
export function planComponentFrontier(steps,history=[],options={}){
 const initial=new Set(history),parent=steps.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
 const link=(i,j)=>{parent[find(i)]=find(j);},owners=new Map();
 for(const [i,s]of steps.entries())for(const a of s.alternatives.filter(a=>a.feasible))for(const t of a.tokens){if(initial.has(t))continue;if(owners.has(t))link(i,owners.get(t));else owners.set(t,i);}
 const groups=new Map();for(let i=0;i<steps.length;i++){const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 // A zero-label pass supplies the same deterministic greedy traffic reference.
 let seen=new Set(initial),referenceFields=0;
 for(const s of steps){const a=s.alternatives.filter(a=>a.feasible).map(a=>({a,size:new Set([...seen,...a.tokens]).size})).sort((x,y)=>x.size-y.size||x.a.work-y.a.work||x.a.fields-y.a.fields||x.a.id.localeCompare(y.a.id))[0]?.a;
  if(!a)return {feasible:false,reason:'NO_AUTHORIZED_IMPLEMENTATION'};referenceFields+=a.fields;a.tokens.forEach(t=>seen.add(t));}
 const slack=options.slack??Infinity;
 if(!(slack>=0)||!Number.isInteger(options.maxLabels??4096)||(options.maxLabels??4096)<1||!(options.maxFields===undefined||options.maxFields>=0))throw Error('INVALID_PLANNER_LIMIT');
 const maximum=steps.reduce((n,s)=>n+Math.max(...s.alternatives.filter(a=>a.feasible).map(a=>a.fields)),0);
 const budget=Math.min(options.maxFields??Infinity,Number.isFinite(slack)?Math.floor(referenceFields*(1+slack)+1e-9):Infinity,maximum);
 if(groups.size<=1)return {...planLiveFrontier(steps,history,{...options,maxFields:budget,slack:Infinity}),referenceFields,components:groups.size,largestComponent:steps.length};
 let combined=[{disclosures:0,work:0,fields:0,path:[]}],peak=1,visited=0,width=0,largestComponent=0;
 for(const indices of groups.values()){
  largestComponent=Math.max(largestComponent,indices.length);
  const part=indices.map(i=>steps[i]),maximumPart=Math.min(budget,part.reduce((n,s)=>n+Math.max(...s.alternatives.filter(a=>a.feasible).map(a=>a.fields)),0));
  const possible=new Set([0]);
  for(const s of part){const next=new Set();for(const b of possible)for(const a of s.alternatives.filter(a=>a.feasible))if(b+a.fields<=maximumPart)next.add(b+a.fields);possible.clear();for(const b of next)possible.add(b);}
  const frontier=[];
  for(const fields of [...possible].sort((a,b)=>a-b)){
   const p=planLiveFrontier(part,history,{...options,maxFields:fields,slack:Infinity});
   peak=Math.max(peak,p.peak??0);visited+=p.visited??0;width=Math.max(width,p.width??0);
   if(p.feasible)frontier.push({disclosures:p.newDisclosures.length,work:p.work,fields:p.fields,path:p.path.map((a,j)=>({index:indices[j],a}))});
  }
  const next=[];
  for(const x of combined)for(const y of pareto(frontier))if(x.fields+y.fields<=budget)next.push({disclosures:x.disclosures+y.disclosures,work:x.work+y.work,fields:x.fields+y.fields,path:[...x.path,...y.path]});
  combined=pareto(next);peak=Math.max(peak,combined.length);visited+=next.length;
  if(combined.length>(options.maxLabels??4096))throw Error('FRONTIER_BOUND_EXCEEDED');
  if(!combined.length)return {feasible:false,reason:'NO_BUDGET_FEASIBLE_PLAN',peak,visited,width,referenceFields,budget};
 }
 const best=combined.sort(rank)[0],path=best.path.sort((a,b)=>a.index-b.index).map(x=>x.a);
 return {feasible:true,path,newDisclosures:[...new Set(path.flatMap(a=>a.tokens).filter(t=>!initial.has(t)))].sort(),work:best.work,fields:best.fields,budget,referenceFields,visited,peak,width,components:groups.size,largestComponent};
}
