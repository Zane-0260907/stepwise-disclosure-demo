import {createHash,randomBytes} from 'node:crypto';

export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const copy=x=>structuredClone(x);
const ops=new Set(['eq','ne','lt','le','gt','ge','contains']);
const match=(x,op,y)=>op==='eq'?x===y:op==='ne'?x!==y:op==='lt'?x<y:op==='le'?x<=y:op==='gt'?x>y:op==='ge'?x>=y:String(x??'').toLowerCase().includes(String(y).toLowerCase());
function fieldsValid(columns,schema){if(!Array.isArray(columns)||!columns.length||columns.length>40||new Set(columns).size!==columns.length||columns.some(c=>!schema.includes(c)))throw Error('INVALID_COLUMNS');}
function leaves(value,path=''){
 if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>leaves(v,path?path+'.'+k:k));
 return [{path,value}];
}

/** Local typed views: operation execution, access policy and final materialization are separate.
 * Opaque handles carry no source row counts or values. They are scoped to one runtime.
 * No natural-language evaluator or benchmark labels are reachable from this module.
 */
export function createViewRuntime(tables,{mode='deferred',denied=[],maxRows=5000,maxViews=40}={}){
 if(!['full','fixed','fields','eager','deferred'].includes(mode))throw Error('INVALID_MODE');
 const sources=copy(tables),views=new Map(),events=[],blocked=new Set(denied),nonce=randomBytes(16).toString('hex');let serial=0,suppress=false;
 for(const [name,t]of Object.entries(sources)){
  if(!Array.isArray(t.rows)||t.rows.length>maxRows)throw Error('INVALID_SOURCE');
  t.schema=[...new Set(t.rows.flatMap(Object.keys))];t.version=1;
  t.rows=t.rows.map((r,i)=>({values:r,origin:Object.fromEntries(Object.keys(r).map(k=>[k,[`${name}:${i}:${k}:1`]]))}));
 }
 const schema=()=>Object.fromEntries(Object.entries(sources).map(([name,t])=>[name,{columns:t.schema.filter(k=>!blocked.has(k)),types:Object.fromEntries(t.schema.filter(k=>!blocked.has(k)).map(k=>[k,[...new Set(t.rows.map(r=>r.values[k]===null?'null':typeof r.values[k]))].sort().join('|')])),description:t.description||''}]));
 function get(id){const v=views.get(id);if(!v)throw Error('UNKNOWN_LOCAL_HANDLE');for(const [name,version]of Object.entries(v.versions))if(sources[name].version!==version)throw Error('STALE_VIEW');return v;}
 function offer(rows,columns,versions,operation){
  if(views.size>=maxViews)throw Error('VIEW_LIMIT');
  const handle=hash(nonce+':'+(++serial)).slice(0,24);views.set(handle,{rows,columns,versions,operation});
  const result={handle,columns};
  if(mode!=='deferred'&&!suppress)Object.assign(result,materialize(handle,columns));
  events.push({kind:'view.created',operation,handle,columns,materialized:mode!=='deferred'&&!suppress});return result;
 }
 function materialize(handle,columns){
  const v=get(handle);fieldsValid(columns,v.columns);if(columns.some(c=>blocked.has(c)))throw Error('FORBIDDEN_COLUMN');
  const rows=v.rows.map(r=>Object.fromEntries(columns.map(k=>[k,r.values[k]??null])));
  const provenance=v.rows.map(r=>Object.fromEntries(columns.map(k=>[k,r.origin[k]||[]])));
  const event={kind:'view.observed',handle,columns,rows:copy(rows),provenance,versions:copy(v.versions),leaves:rows.flatMap((r,i)=>leaves(r,String(i)))};
  events.push(event);return {rows};
 }
 function validateConditions(where,columns){
  if(!Array.isArray(where)||where.length>12)throw Error('INVALID_FILTER');
  for(const c of where)if(!c||Object.keys(c).sort().join(',')!=='column,op,value'||!columns.includes(c.column)||!ops.has(c.op)||c.value===null||!['string','number','boolean'].includes(typeof c.value)||(typeof c.value==='number'&&!Number.isFinite(c.value)))throw Error('INVALID_FILTER');
 }
 function run(name,args){
  if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_ARGUMENTS');
  if(name==='execute_plan'){
   if(suppress||!Array.isArray(args.steps)||args.steps.length>6||!args.steps.length)throw Error('INVALID_LOCAL_PLAN');
   let h;suppress=true;
   try{h=run('open_table',{table:args.table});for(const step of args.steps){if(!['query','aggregate','search_text'].includes(step.op))throw Error('INVALID_LOCAL_PLAN');const {op,aggregation,...params}=step;h=run(op,{...params,...(op==='aggregate'?{op:aggregation}:{}),handle:h.handle});}}finally{suppress=false;}
   const columns=args.output_columns||h.columns;
   return {handle:h.handle,columns,...materialize(h.handle,columns)};
  }
  if(name==='open_table'){
   const t=sources[args.table];if(!t)throw Error('UNKNOWN_TABLE');
   const columns=t.schema.filter(k=>!blocked.has(k));
   return offer(t.rows.map(r=>({values:Object.fromEntries(columns.map(k=>[k,r.values[k]])),origin:Object.fromEntries(columns.map(k=>[k,r.origin[k]]))})),columns,{[args.table]:t.version},name);
  }
  const v=get(args.handle);
  if(name==='observe')return materialize(args.handle,args.columns);
  if(name==='query'){
   const columns=args.columns?.length?args.columns:v.columns;fieldsValid(columns,v.columns);
   const where=args.where||[];validateConditions(where,v.columns);
   let rows=v.rows.filter(r=>where.every(c=>match(r.values[c.column],c.op,c.value)));
   if(args.sort){if(!v.columns.includes(args.sort.column)||!['asc','desc'].includes(args.sort.direction))throw Error('INVALID_SORT');const sign=args.sort.direction==='asc'?1:-1;rows=[...rows].sort((a,b)=>(a.values[args.sort.column]<b.values[args.sort.column]?-1:a.values[args.sort.column]>b.values[args.sort.column]?1:0)*sign);}
   if(args.limit!==undefined){if(!Number.isInteger(args.limit)||args.limit<1||args.limit>maxRows)throw Error('INVALID_LIMIT');rows=rows.slice(0,args.limit);}
   return offer(rows.map(r=>({values:Object.fromEntries(columns.map(k=>[k,r.values[k]])),origin:Object.fromEntries(columns.map(k=>[k,r.origin[k]]))})),columns,v.versions,name);
  }
  if(name==='aggregate'){
   if(!['count','sum','min','max'].includes(args.op))throw Error('INVALID_AGGREGATE');
   if(args.op!=='count'&&!v.columns.includes(args.column))throw Error('INVALID_COLUMNS');
   const values=v.rows.map(r=>r.values[args.column]);
   if(args.op!=='count'&&values.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('NON_NUMERIC_AGGREGATE');
   const value=args.op==='count'?v.rows.length:args.op==='sum'?values.reduce((a,b)=>a+b,0):values.length?(args.op==='min'?Math.min(...values):Math.max(...values)):null;
   const token='derived:'+hash({operation:args.op,column:args.column,versions:v.versions,values:v.rows.map(r=>r.origin)});
   return offer([{values:{value},origin:{value:[token]}}],['value'],v.versions,name);
  }
  if(name==='search_text'){
   if(!v.columns.includes(args.column)||typeof args.query!=='string'||!args.query.trim())throw Error('INVALID_SEARCH');
   const words=[...new Set(args.query.toLowerCase().match(/[a-z]{3,}/g)||[])];
   const ranked=v.rows.map(r=>({r,score:words.reduce((s,w)=>s+(String(r.values[args.column]??'').toLowerCase().includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
   const limit=args.limit??3;if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('INVALID_LIMIT');
   return offer(ranked.slice(0,limit).map(x=>x.r),v.columns,v.versions,name);
  }
  throw Error('UNKNOWN_OPERATION');
 }
 function update(table,row,changes){const t=sources[table];if(!t||!t.rows[row])throw Error('UNKNOWN_SOURCE');t.version++;for(const [k,value]of Object.entries(changes)){if(!t.schema.includes(k))throw Error('INVALID_COLUMNS');t.rows[row].values[k]=value;t.rows[row].origin[k]=[`${table}:${row}:${k}:${t.version}`];}events.push({kind:'source.updated',table,version:t.version});}
 return {schema,run,events,update,mode};
}

export const VIEW_TOOLS=[
 {name:'open_table',description:'Open a local table. Returns a local handle and columns. A handle is not its contents.',parameters:{type:'object',properties:{table:{type:'string'}},required:['table'],additionalProperties:false}},
 {name:'query',description:'Create a filtered/projected local view. Can sort and take the first rows. Output is another handle. Local operations are exact; no values need to be disclosed to form a query.',parameters:{type:'object',properties:{handle:{type:'string'},columns:{type:'array',items:{type:'string'}},where:{type:'array',items:{type:'object',properties:{column:{type:'string'},op:{type:'string',enum:[...ops]},value:{type:['string','number','boolean']}},required:['column','op','value'],additionalProperties:false}},sort:{type:'object',properties:{column:{type:'string'},direction:{type:'string',enum:['asc','desc']}},required:['column','direction'],additionalProperties:false},limit:{type:'integer'}},required:['handle'],additionalProperties:false}},
 {name:'aggregate',description:'Compute count, sum, min or max locally over a view. Returns a new view with a value column. This is a derived disclosure if observed.',parameters:{type:'object',properties:{handle:{type:'string'},op:{type:'string',enum:['count','sum','min','max']},column:{type:'string'}},required:['handle','op'],additionalProperties:false}},
 {name:'search_text',description:'Lexically rank local text chunks by query words; produces a view. This retrieval can miss relevant passages; use further searches or observe more chunks when needed.',parameters:{type:'object',properties:{handle:{type:'string'},column:{type:'string'},query:{type:'string'},limit:{type:'integer'}},required:['handle','column','query'],additionalProperties:false}},
 {name:'observe',description:'Explicitly disclose selected columns of a local view to the current model. Prefer a query/aggregate before observing when it is sufficient. This returns the actual values.',parameters:{type:'object',properties:{handle:{type:'string'},columns:{type:'array',items:{type:'string'}}},required:['handle','columns'],additionalProperties:false}}
].map(f=>({type:'function',function:f}));

VIEW_TOOLS.push({type:'function',function:{name:'execute_plan',description:'Strong local-program tool available to EVERY method. Execute a pipeline locally and return only its final selected columns, without disclosing intermediate rows. Prefer this when the request already defines a filter/sort/aggregation or text search. For aggregate, use op=aggregate and aggregation=count/sum/min/max. No open_table call is needed.',parameters:{type:'object',properties:{table:{type:'string'},steps:{type:'array',minItems:1,maxItems:6,items:{type:'object',properties:{op:{type:'string',enum:['query','aggregate','search_text']},...VIEW_TOOLS[1].function.parameters.properties,aggregation:{type:'string',enum:['count','sum','min','max']},column:{type:'string'},query:{type:'string'}},required:['op'],additionalProperties:false}},output_columns:{type:'array',items:{type:'string'}}},required:['table','steps','output_columns'],additionalProperties:false}}});
