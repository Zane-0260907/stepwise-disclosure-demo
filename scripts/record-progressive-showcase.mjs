import { mkdir,readFile,writeFile,readdir } from 'node:fs/promises';
import { createRun } from '../src/research/engine.mjs';
import { executeAdaptiveRun } from '../src/research/adaptive-execution.mjs';
import { readShowcaseDocument } from '../src/research/showcase.mjs';
import { createTransport } from '../src/research/transport.mjs';
import { startDeepSeekProxy } from '../src/research/deepseek-live.mjs';
import { scoreValidation } from '../src/research/validation-score.mjs';
const key=process.env.DEEPSEEK_API_KEY?.trim();delete process.env.DEEPSEEK_API_KEY;if(!key)throw new Error('DEEPSEEK_API_KEY required');
const out=new URL('../evidence/progressive-showcase/',import.meta.url),dir=new URL('joint/',out);
try{await readFile(new URL('manifest.json',out));throw new Error('Preserve the existing showcase; use another bundle for a new recording.');}catch(e){if(e.code!=='ENOENT')throw e;}
const temporary=new URL('../data/research/showcase-egress/',import.meta.url);
const proxy=await startDeepSeekProxy({key,recordDirectory:temporary});process.env.DASHSCOPE_API_KEY=proxy.internalToken;process.env.DEMO_MODEL_URL=proxy.url;
const transport=await createTransport();
try{
 const item=await readShowcaseDocument('progressive-09'),run=createRun(item,{model:'deepseek-flash'});
 run.executionMode='deepseek';run.startedAt=new Date().toISOString();run.document=item.document;
 const frames=[];await executeAdaptiveRun(run,item,transport,{notify:(r)=>frames.push({at:Date.now(),snapshot:structuredClone(r)})});
 const labels=JSON.parse(await readFile(new URL('../fixtures/validation-v3/labels.json',import.meta.url),'utf8'));
 const score=scoreValidation(run,labels[item.id]);
 if(!score.structuredSuccess||run.factRequests.length!==1||run.receipts.length!==2)throw new Error(`Unexpected showcase: ${run.error}`);
 await mkdir(dir,{recursive:true});
 const providers=[];for(const name of await readdir(temporary))if(name.endsWith('.json')){const p=JSON.parse(await readFile(new URL(name,temporary),'utf8'));if(run.receipts.some(r=>r.sha256===p.receiverBodySha256&&r.responseSha256===p.responseSha256))providers.push(p);}
 if(providers.length!==2)throw new Error('Missing provider records');
 await writeFile(new URL('trace.json',dir),JSON.stringify(run,null,2));
 await writeFile(new URL('frames.json',dir),JSON.stringify(frames));
 await writeFile(new URL('provider-egress.json',dir),JSON.stringify(providers,null,2));
 await writeFile(new URL('result.md',dir),run.report);await writeFile(new URL('score.json',dir),JSON.stringify(score,null,2));
 await writeFile(new URL('manifest.json',out),JSON.stringify({protocol:run.protocol,scope:'One additional real DeepSeek run for demonstration; not part of the 448 frozen tasks.',runs:[{id:run.id,caseId:run.caseId,method:'joint',model:run.model,createdAt:run.createdAt,label:{zh:'补充必要事实',en:'Request missing facts'}}]},null,2));
 // Translate each new provider response manually and preserve its errors; never reuse another run's prose.
 console.log(JSON.stringify({id:run.id,amount:run.result.amount,receipts:run.receipts.length,frames:frames.length,requests:run.factRequests}));
}finally{transport.close();await proxy.close();}
