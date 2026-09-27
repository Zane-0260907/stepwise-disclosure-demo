const subset=(a,b)=>[...a].every(value=>b.has(value));
const compare=(a,b)=>a.tokens.size-b.tokens.size||a.work-b.work||a.fields-b.fields||a.path.map(x=>x.id).join('/').localeCompare(b.path.map(x=>x.id).join('/'));

// Each listed alternative is an equivalent registered realization of one node.
// The optimizer selects representations; it never infers their equivalence.
export function planBudgeted(steps,history=[],{strategy='frontier',slack=Infinity,maxLabels=4096,maxFields=Infinity}={}){
  if(!(slack>=0))throw Error('INVALID_TRANSMISSION_SLACK');
  const start=new Set(history);
  const greedy=()=>{
    let label={tokens:new Set(start),work:0,fields:0,path:[]};
    for(const step of steps){
      const candidates=step.alternatives.filter(a=>a.feasible).map(a=>extend(label,a));
      if(!candidates.length)return null;
      label=candidates.sort(compare)[0];
    }
    return label;
  };
  function extend(label,a){
    if(!Number.isInteger(a.fields)||a.fields<0||!Number.isFinite(a.work)||a.work<0)throw Error('INVALID_ALTERNATIVE_COST');
    return {tokens:new Set([...label.tokens,...a.tokens]),fields:label.fields+a.fields,work:label.work+a.work,path:[...label.path,a]};
  }
  const reference=greedy();
  if(!reference)return {feasible:false,reason:'NO_AUTHORIZED_IMPLEMENTATION'};
  const budget=Math.min(maxFields,Number.isFinite(slack)?Math.floor(reference.fields*(1+slack)+1e-9):Infinity);
  let labels=[{tokens:new Set(start),fields:0,work:0,path:[]}],visited=0,peak=1;
  if(strategy==='greedy')labels=[reference];
  else for(const step of steps){
    const next=[];
    for(const label of labels)for(const a of step.alternatives.filter(a=>a.feasible)){
      const candidate=extend(label,a);visited++;
      if(candidate.fields>budget)continue;
      if(next.some(x=>subset(x.tokens,candidate.tokens)&&x.work<=candidate.work&&x.fields<=candidate.fields))continue;
      for(let i=next.length-1;i>=0;i--)if(subset(candidate.tokens,next[i].tokens)&&candidate.work<=next[i].work&&candidate.fields<=next[i].fields)next.splice(i,1);
      next.push(candidate);
    }
    labels=next;peak=Math.max(peak,labels.length);
    if(labels.length>maxLabels)throw Error('FRONTIER_BOUND_EXCEEDED');
  }
  const selected=labels.sort(compare)[0];
  if(!selected)throw Error('GREEDY_FEASIBLE_BUT_NO_BOUNDED_PLAN');
  return {feasible:true,path:selected.path,newDisclosures:[...selected.tokens].filter(x=>!start.has(x)).sort(),work:selected.work,fields:selected.fields,budget:Number.isFinite(budget)?budget:null,referenceFields:reference.fields,visited,peak};
}
