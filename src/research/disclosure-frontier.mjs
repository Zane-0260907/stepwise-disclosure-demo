import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const subset = (a,b) => [...a].every(x=>b.has(x));
const union = (a,b) => new Set([...a,...b]);
const order = (a,b) => a.tokens.size-b.tokens.size || a.work-b.work || a.path.map(x=>x.id).join('/').localeCompare(b.path.map(x=>x.id).join('/'));

// The caller supplies complete registered alternatives with identical output
// semantics for each step. This is bounded set-union planning, not inference of
// semantic necessity, a generic new DP, or an oracle for undiscovered steps.
export function planDisclosure(steps, history = [], {strategy='frontier', maxLabels=4096}={}) {
  const start=new Set(history); let labels=[{tokens:start,work:0,path:[]}],visited=0,peak=1;
  for(const step of steps){
    const choices=step.alternatives.filter(a=>a.feasible!==false);
    if(!choices.length)return {feasible:false,reason:'NO_AUTHORIZED_IMPLEMENTATION',stepId:step.id,visited,peak};
    const next=[];
    for(const previous of labels)for(const choice of choices){
      if(!Number.isFinite(choice.work)||choice.work<0||!Array.isArray(choice.tokens))throw Error('INVALID_ALTERNATIVE');
      visited++;const label={tokens:union(previous.tokens,choice.tokens),work:previous.work+choice.work,path:[...previous.path,choice]};
      if(strategy==='greedy'){next.push(label);continue;}
      if(next.some(x=>x.work<=label.work&&subset(x.tokens,label.tokens)))continue;
      for(let i=next.length-1;i>=0;i--)if(label.work<=next[i].work&&subset(label.tokens,next[i].tokens))next.splice(i,1);
      next.push(label);
    }
    labels=strategy==='greedy'?[next.sort(order)[0]]:next;
    peak=Math.max(peak,labels.length);
    if(labels.length>maxLabels)throw Error('FRONTIER_BOUND_EXCEEDED');
  }
  const best=labels.sort(order)[0];
  return {feasible:true,path:best.path,newDisclosure:[...best.tokens].filter(x=>!start.has(x)).sort(),work:best.work,visited,peak};
}

export class VersionedFacts {
  constructor(values){this.values=structuredClone(values);this.versions=Object.fromEntries(Object.keys(values).map(k=>[k,1]));}
  read(key){if(!(key in this.values))throw Error('UNKNOWN_DEPENDENCY:'+key);return {value:structuredClone(this.values[key]),version:this.versions[key]};}
  set(key,value){if(!(key in this.values))throw Error('UNKNOWN_DEPENDENCY:'+key);this.values[key]=structuredClone(value);this.versions[key]++;}
  snapshot(keys){return Object.fromEntries([...new Set(keys)].sort().map(k=>[k,this.read(k).version]));}
  current(stamp){return Object.entries(stamp).every(([k,v])=>this.versions[k]===v);}
}

// All state accesses in registered recipes go through read(). A derived value
// carries the transitive source-read versions; guards are tracked separately.
export function materialize(store, keys, recipes={}) {
  const view={},versions={},lineage={};
  for(const key of keys){
    const used={},resolving=new Set();
    function read(k){
      if(resolving.has(k))throw Error('CYCLIC_RECIPE');resolving.add(k);let result;
      if(Object.hasOwn(recipes,k))result=recipes[k](read);
      else{const source=store.read(k);used[k]=source.version;result=source.value;}
      if(result===undefined||typeof result==='number'&&!Number.isFinite(result))throw Error('INVALID_VALUE');
      resolving.delete(k);return result;
    }
    view[key]=read(key);lineage[key]=used;Object.assign(versions,used);
  }
  return {view,versions,lineage};
}

export function disclosureTokens(recipient, view, versions, lineage={}){
  return recipient==='local'?[]:Object.entries(view).map(([field,value])=>JSON.stringify([recipient,field,digest({value,versions:lineage[field]||versions})]));
}

// A decision certificate includes both value dependencies and non-payload
// capability/authorization reads. Revalidating payload fields alone misses the
// latter. The certificate is kept separate from user-editable display metadata.
export function sealDecision(store,{stepId,alternative,guardKeys}){
  const guards=store.snapshot(guardKeys);
  const body=JSON.stringify({stepId,implementation:alternative.id,recipient:alternative.recipient,view:alternative.view});
  return Object.freeze({stepId,recipient:alternative.recipient,body,sha256:digest(body),versions:Object.freeze({...alternative.versions,...guards}),valueVersions:Object.freeze({...alternative.versions})});
}
