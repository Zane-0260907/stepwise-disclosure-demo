import {readFile} from 'node:fs/promises';
import {hash} from './local-program.mjs';
export async function financialCases(){
 const rows=JSON.parse(await readFile(new URL('../../fixtures/finqa-v4/development.json',import.meta.url),'utf8'));
 return rows.slice(0,1).map(item=>({...item,requiresLive:true,source:`${item.id}.pdf`,datasetSource:item.source,
  title:{zh:'公开财务表格 · 在本地完成计算',en:'Public financial table · calculate locally'},
  task:{zh:'根据公开财报表格，计算参数上升 1 个百分点时，服务与利息成本变动占其他退休福利义务变动的比例。',en:item.question}}));
}
export async function readFinancialCase(id){
 const item=(await financialCases()).find(c=>c.id===id);if(!item)throw Error('Unknown financial case');
 const source=await readFile(new URL('../../fixtures/finqa-v4/development.json',import.meta.url),'utf8');
 return {...item,document:{file:item.source,sourceArtifact:'fixtures/finqa-v4/development.json',sha256:hash(source),bytes:Buffer.byteLength(source),pages:1}};
}
