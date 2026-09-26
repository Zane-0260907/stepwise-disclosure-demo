import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
function number(raw){
 const s=String(raw).replace(/<[^>]+>/g,'').replace(/[$,%\s]/g,'');
 if(/^\(\d+(?:\.\d+)?\)$/.test(s))return -Number(s.slice(1,-1));
 if(/^-?\d+(?:\.\d+)?$/.test(s))return Number(s);
 return null;
}

export function convert(x){
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
