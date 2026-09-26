import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRun} from '../src/research/engine.mjs';
import {executeFinancialRun,FINANCIAL_METHODS} from '../src/research/financial-execution.mjs';
import {readFinancialCase,financialCases} from '../src/research/financial-showcase.mjs';
import {createTransport} from '../src/research/transport.mjs';
import {startDeepSeekProxy} from '../src/research/deepseek-live.mjs';
const out=new URL('../evidence/financial-showcase/',import.meta.url);
try{await readFile(new URL('manifest.json',out));throw Error('Existing showcase is preserved; do not overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw Error('DEEPSEEK_API_KEY required');
const temporary=new URL('../data/research/financial-showcase-egress/',import.meta.url),proxy=await startDeepSeekProxy({key,recordDirectory:temporary});
process.env.DASHSCOPE_API_KEY=proxy.internalToken;process.env.DEMO_MODEL_URL=proxy.url;
const transport=await createTransport(),manifest={scope:'Three additional runs of the first deterministic development case, excluded from all batch counts. No success-based choice.',runs:[]};
try{
 for(const mode of FINANCIAL_METHODS){
  const item=await readFinancialCase((await financialCases())[0].id),run=createRun(item,{model:'deepseek-flash'});run.method=mode;run.executionMode='deepseek';run.startedAt=new Date().toISOString();run.document=item.document;
  const frames=[];await executeFinancialRun(run,item,transport,{notify:r=>frames.push({at:Date.now(),snapshot:structuredClone(r)})});
  const dir=new URL(mode+'/',out);await mkdir(dir,{recursive:true});
  const providers=[];for(const file of await readdir(temporary)){const p=JSON.parse(await readFile(new URL(file,temporary),'utf8'));if(run.receipts.some(r=>r.sha256===p.receiverBodySha256&&r.responseSha256===p.responseSha256))providers.push(p);}
  for(const [file,obj]of Object.entries({'trace.json':run,'frames.json':frames,'provider-egress.json':providers}))await writeFile(new URL(file,dir),JSON.stringify(obj,null,2));
  if(run.report)await writeFile(new URL('result.md',dir),run.report);
  const labels={eager_allowed:{zh:'公开表格 · 全数值对照',en:'Public table · all values'},requested_cells:{zh:'公开表格 · 按需单元格',en:'Public table · selected cells'},local_program:{zh:'公开表格 · 本地计算',en:'Public table · local calculation'}};
  manifest.runs.push({id:run.id,caseId:run.caseId,method:mode,model:run.model,createdAt:run.createdAt,label:labels[mode]});
  console.log(JSON.stringify({mode,id:run.id,status:run.status,amount:run.result?.amount}));
 }
 await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
}finally{transport.close();await proxy.close();}
