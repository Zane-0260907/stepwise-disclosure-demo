import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createRun} from '../src/research/engine.mjs';
import {executeAdaptiveFinancial,ADAPTIVE_METHODS} from '../src/research/adaptive-financial-v6.mjs';
import {readCorrectedCase,correctedCases} from '../src/research/corrected-showcase.mjs';
import {createTransport} from '../src/research/transport.mjs';
import {startDeepSeekProxy} from '../src/research/deepseek-live.mjs';
const out=new URL('../evidence/corrected-showcase/',import.meta.url);
try{await readFile(new URL('manifest.json',out));throw Error('Existing showcase is preserved; do not overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}
const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw Error('DEEPSEEK_API_KEY required');
const temporary=new URL('../data/research/corrected-showcase-egress/',import.meta.url),proxy=await startDeepSeekProxy({key,recordDirectory:temporary});
process.env.DASHSCOPE_API_KEY=proxy.internalToken;process.env.DEMO_MODEL_URL=proxy.url;
const transport=await createTransport(),manifest={scope:'Three additional runs of the documented year-header development case, excluded from all batch counts. No success-based choice.',runs:[]};
try{
 for(const mode of ['local_once','full_once','conflict_review']){
  const item=await readCorrectedCase((await correctedCases())[0].id),run=createRun(item,{model:'deepseek-flash'});run.method=mode;run.executionMode='deepseek';run.startedAt=new Date().toISOString();run.document=item.document;
  const frames=[];await executeAdaptiveFinancial(run,item,transport,{notify:r=>frames.push({at:Date.now(),snapshot:structuredClone(r)})});
  frames.push({at:Date.now(),snapshot:structuredClone(run)});
  const dir=new URL(mode+'/',out);await mkdir(dir,{recursive:true});
  const providers=[];for(const file of await readdir(temporary)){const p=JSON.parse(await readFile(new URL(file,temporary),'utf8'));if(run.receipts.some(r=>r.sha256===p.receiverBodySha256&&r.responseSha256===p.responseSha256))providers.push(p);}
  for(const [file,obj]of Object.entries({'trace.json':run,'frames.json':frames,'provider-egress.json':providers}))await writeFile(new URL(file,dir),JSON.stringify(obj,null,2));
  if(run.report)await writeFile(new URL('result.md',dir),run.report);
  const labels={conflict_review:{zh:'结构核对 · 分歧补充',en:'Structure check · conflict view'},full_once:{zh:'结构核对 · 全数值对照',en:'Structure check · all values'},requested_cells:{zh:'公开表格 · 按需单元格',en:'Public table · selected cells'},local_once:{zh:'结构核对 · 本地计算',en:'Structure check · local calculation'}};
  manifest.runs.push({id:run.id,caseId:run.caseId,method:mode,model:run.model,createdAt:run.createdAt,label:labels[mode]});
  console.log(JSON.stringify({mode,id:run.id,status:run.status,amount:run.result?.amount}));
 }
 await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
}finally{transport.close();await proxy.close();}
