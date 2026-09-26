import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),commit='0f16e2867befa6840783e58be38c9efb9229d742';
const source=new URL('data/research/finqa-source/',root),out=new URL('fixtures/finqa-v4/',root);
await mkdir(source,{recursive:true});await mkdir(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const origins={};
async function fetchSource(file){
  const url=`https://raw.githubusercontent.com/czyssrs/FinQA/${commit}/${file==='LICENSE'?file:'dataset/'+file}`;
  let data;try{data=await readFile(new URL(file,source));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!data?.length){const res=await fetch(url);if(!res.ok)throw Error(`download ${res.status}`);data=Buffer.from(await res.arrayBuffer());await writeFile(new URL(file,source),data);}
  origins[file]={url,sha256:sha(data),bytes:data.length};return data.toString('utf8');
}
function number(raw){
 const s=String(raw).replace(/<[^>]+>/g,'').replace(/[$,%\s]/g,'');
 if(/^\(\d+(?:\.\d+)?\)$/.test(s))return -Number(s.slice(1,-1));
 if(/^-?\d+(?:\.\d+)?$/.test(s))return Number(s);
 return null;
}
const reasonCounts={};
function convert(x){
 const qa=x.qa;if(!Number.isFinite(qa.exe_ans)||qa.ann_text_rows?.length||!qa.ann_table_rows?.length)return null;
 const table=x.table_ori||x.table, cells=[],facts={};
 for(let row=1;row<table.length;row++)for(let column=1;column<table[row].length;column++){
  const value=number(table[row][column]);if(value===null)continue;
  const id=`r${row}c${column}`;facts[id]=value;cells.push({id,row:String(table[row][0]).replace(/<[^>]+>/g,''),column:String(table[0][column]||`column ${column}`),unitHint:String(table[0][0]||'')});
 }
 if(cells.length<3||cells.length>80)return null;
 const operations=[...qa.program.matchAll(/([a-z_]+)\(([^()]*)\)/g)];
 if(!operations.length||operations.length>8||operations.map(m=>m[0]).join(', ')!==qa.program)return null;
 const dependencies=new Set();
 for(const [i,op]of operations.entries()){
  if(!['add','subtract','multiply','divide'].includes(op[1]))return null;
  const args=op[2].split(',').map(s=>s.trim());if(args.length!==2)return null;
  for(const arg of args){
   if(/^#\d+$/.test(arg)){if(Number(arg.slice(1))>=i)return null;continue;}
   if(/^const_(?:\d+|m1)$/.test(arg))continue;
   const value=Number(arg);if(!Number.isFinite(value))return null;
   const matches=Object.keys(facts).filter(k=>facts[k]===value);
   // Unique numeric operands make gold-cell exposure auditable. No model is used.
   if(matches.length!==1)return null;dependencies.add(matches[0]);
  }
 }
 if(dependencies.size<2)return null;
 return {item:{id:'finqa-'+sha(x.id).slice(0,12),sourceId:x.id,sourceFile:x.filename,family:'finance',
   title:{zh:'公开财务表格数值问答',en:'Public financial-table question'},task:{zh:qa.question,en:qa.question},question:qa.question,
   schema:cells,facts,source:`FinQA/${x.id}`},label:{sourceId:x.id,expected:qa.exe_ans,answer:qa.answer,
   program:qa.program,goldCells:[...dependencies],tolerance:0.00005,sourceFile:x.filename}};
}
const labels={},selected=[],development=[];
for(const [split,count]of [['dev',6],['test',40]]){
 const rows=JSON.parse(await fetchSource(split+'.json')),eligible=rows.map(convert).filter(Boolean);
 const ordered=eligible.sort((a,b)=>sha('stepwise-v4-20260927/'+a.item.sourceId).localeCompare(sha('stepwise-v4-20260927/'+b.item.sourceId)));
 const seen=new Set(),chosen=[];
 for(const row of ordered){if(seen.has(row.item.sourceFile))continue;seen.add(row.item.sourceFile);chosen.push(row);if(chosen.length===count)break;}
 if(chosen.length!==count)throw Error(`Insufficient ${split} cases: ${chosen.length}`);
 reasonCounts[split]={total:rows.length,eligible:eligible.length,selected:chosen.length,distinctSourceFiles:seen.size};
 for(const row of chosen){row.item.split=split;labels[row.item.id]=row.label;(split==='test'?selected:development).push(row.item);}
}
const license=await fetchSource('LICENSE');await writeFile(new URL('LICENSE.FinQA',out),license);
for(const [name,value]of Object.entries({'cases.json':selected,'development.json':development,'labels.json':labels,
 'provenance.json':{source:'https://github.com/czyssrs/FinQA',commit,origins,selection:reasonCounts,seed:'stepwise-v4-20260927',
   rule:'Table-only annotated questions; 3–80 parseable cells; 1–8 add/subtract/multiply/divide steps; >=2 uniquely locatable gold operands; one question per source page; SHA256 order. Selection never uses a model response.',
   limitation:'A restricted table-only subset, not the full FinQA benchmark. Public data may occur in model training. Gold annotations are used only for eligibility and scoring, never for model inputs.'}}))await writeFile(new URL(name,out),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify(reasonCounts));
