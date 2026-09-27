import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {convert} from './finqa-conversion.mjs';
import {buildTableView} from '../src/research/table-view.mjs';
import {subgraph} from '../src/research/model-repair-v8.mjs';
import {evaluateLocalProgram} from '../src/research/local-program.mjs';
const root=new URL('../',import.meta.url),out=new URL('fixtures/model-repair-v8/',root);
const load=async p=>JSON.parse(await readFile(new URL(p,root)));
try{await readFile(new URL('evidence/validation-v8/protocol.json',root));throw Error('ALREADY_FROZEN');}catch(e){if(e.code!=='ENOENT')throw e;}
const prior=[];
for(const v of ['v4','v5','v6'])for(const n of ['cases','development'])try{prior.push(...await load(`fixtures/finqa-${v}/${n}.json`));}catch(e){if(e.code!=='ENOENT')throw e;}
const report=x=>x.sourceFile.split('/').slice(0,2).join('/'),excluded=new Set(prior.map(report));
const sha=x=>createHash('sha256').update(x).digest('hex');
function parse(raw,split){
  const row=convert(raw);if(!row)return null;
  const view=buildTableView(raw.table_ori||raw.table,row.item.facts);
  if(row.label.goldCells.some(id=>!Object.hasOwn(view.facts,id)))return null;
  const operations=[...row.label.program.matchAll(/([a-z]+)\(([^()]*)\)/g)];
  const gold=operations.map(([,op,args])=>({op,args:args.split(',').map(x=>{
    const arg=x.trim();if(arg.startsWith('#'))return {step:Number(arg.slice(1))};
    if(arg.startsWith('const_'))return {constant:arg==='const_m1'?-1:Number(arg.slice(6))};
    return {field:Object.keys(view.facts).find(k=>view.facts[k]===Number(arg))};
  })}));
  const reachable=subgraph(gold,gold.length-1);
  const value=evaluateLocalProgram(reachable,view.facts,Object.keys(view.facts)).value;
  if(Math.abs(value-row.label.expected)>row.label.tolerance*Math.max(1,Math.abs(row.label.expected)))return null;
  return {item:{...row.item,originalTable:raw.table_ori||raw.table,legacyFacts:row.item.facts,...view,datasetSplit:split,sourceOperationCount:reachable.length},label:{...row.label,gold:reachable}};
}
const pools={};for(const split of ['test','dev'])pools[split]=(await load(`data/research/finqa-source/${split}.json`)).map(x=>parse(x,split)).filter(Boolean);
const seen=new Set(),cases=[],labels={};
for(const [split,minimum,target]of [['test',2,12],['dev',3,12]]){
 const eligible=pools[split].filter(x=>!excluded.has(report(x.item))&&x.item.sourceOperationCount>=minimum).sort((a,b)=>sha('model-repair-v8/'+a.item.sourceId).localeCompare(sha('model-repair-v8/'+b.item.sourceId)));
 let count=0;for(const row of eligible){if(seen.has(report(row.item)))continue;seen.add(report(row.item));cases.push({...row.item,split:'test'});labels[row.item.id]=row.label;if(++count===target)break;}
 if(count!==target)throw Error(`INSUFFICIENT_DISTINCT_REPORTS:${split}:${count}`);
}
const developmentIds=new Set((await load('fixtures/finqa-v6/development.json')).map(x=>x.id));
const development=Object.values(pools).flat().filter(x=>developmentIds.has(x.item.id)).slice(0,4).map(x=>{labels[x.item.id]=x.label;return {...x.item,split:'development'};});
await mkdir(out,{recursive:true});
const provenance={source:'https://github.com/czyssrs/FinQA',commit:'0f16e2867befa6840783e58be38c9efb9229d742',selection:'Fixed SHA order; one page per previously unused company-year report. 12 original test cases with >=2 gold operations plus 12 original dev cases with >=3. Compatibility and header checks precede model runs.',excludedReports:[...excluded].sort(),cases:cases.length,reports:seen.size,development:development.length,limitation:'Restricted public benchmark, not production/customer data. Gold annotations select compatible tasks and score results; they are not provided to the executor. Source dev split is retained in metadata.'};
for(const [name,value]of Object.entries({cases,development,labels,provenance}))await writeFile(new URL(name+'.json',out),JSON.stringify(value,null,2)+'\n');
await writeFile(new URL('LICENSE.FinQA',out),await readFile(new URL('fixtures/finqa-v6/LICENSE.FinQA',root)));
console.log(JSON.stringify({cases:cases.length,reports:seen.size,depths:cases.map(c=>c.sourceOperationCount),development:development.length}));
