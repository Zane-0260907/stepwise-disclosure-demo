import { readFile,writeFile,mkdir,readdir,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { evaluateRun } from '../src/research/evaluate.mjs';

const [jointId,fullId]=process.argv.slice(2);
if(![jointId,fullId].every(id=>/^[a-f0-9-]{36}$/.test(id||''))||jointId===fullId)throw new Error('Usage: node scripts/package-deepseek-records.mjs <joint-run-id> <full-run-id>');
const out=new URL('../evidence/research/deepseek-live-20260926/',import.meta.url);
try{await stat(out);throw new Error('Evidence directory already exists; preserve the recorded evidence.');}catch(error){if(error.code!=='ENOENT')throw error;}
const sha=data=>createHash('sha256').update(data).digest('hex');
const readJson=async url=>JSON.parse(await readFile(url,'utf8'));
const providerRoot=new URL('../data/research/provider-egress/',import.meta.url);
const providerFiles=await readdir(providerRoot);
const providerRecords=[];
for(const name of providerFiles){if(name.endsWith('.json'))providerRecords.push(await readJson(new URL(name,providerRoot)));}
const prepared=[];
for(const [method,id] of [['joint',jointId],['full',fullId]]){
 const source=new URL(`../data/research/runs/${id}/`,import.meta.url);
 const run=await readJson(new URL('trace.json',source));
 const frames=await readJson(new URL('frames.json',source));
 const report=await readFile(new URL('result.md',source),'utf8');
 if(run.id!==id||run.caseId!=='contract-21'||run.method!==method||run.model!=='deepseek-flash'||run.executionMode!=='deepseek'||run.status!=='completed')throw new Error(`Unexpected ${method} run`);
 if(frames.at(-1)?.snapshot?.status!=='completed')throw new Error(`Incomplete ${method} frames`);
 if(run.receipts.length!==3||run.metrics.modelCalls!==2||run.metrics.toolCalls!==1)throw new Error(`Unexpected ${method} execution path`);
 const matched=[];
 for(const receipt of run.receipts.filter(r=>r.recipient==='cloud-model')){
  if(sha(receipt.rawBody)!==receipt.sha256)throw new Error('Receiver digest mismatch');
  const provider=providerRecords.find(p=>p.receiverBodySha256===receipt.sha256&&p.responseSha256===receipt.responseSha256);
  if(!provider||provider.model!=='deepseek-flash'||provider.responseStatus!==200||sha(provider.providerBody)!==provider.providerBodySha256)throw new Error('Provider egress record mismatch');
  matched.push(provider);
 }
 if(matched.length!==2||new Set(matched.map(p=>p.id)).size!==2)throw new Error('Missing provider egress records');
 const score=await evaluateRun(run);
 if(!score.structuredTaskSuccess||!score.receiptIntegrity)throw new Error(`${method} run did not pass structural checks`);
 for(const content of [JSON.stringify(run),JSON.stringify(frames),report,JSON.stringify(matched)])if(/sk-[a-z0-9]{30,}/i.test(content))throw new Error('Credential-shaped text detected in evidence');
 prepared.push({method,id,run,frames,report,providers:matched,score});
}
await mkdir(out,{recursive:true});
const manifest={protocol:'research-v1',recordType:'fresh-deepseek-api-runs',caseId:'contract-21',requestedModel:'deepseek-flash',syntheticInputs:true,claimScope:'Two individual runs, one per method; not a batch experiment or a model-quality estimate.',runs:[]};
for(const entry of prepared){
 const dir=new URL(`${entry.method}/`,out);await mkdir(dir,{recursive:true});
 await writeFile(new URL('trace.json',dir),JSON.stringify(entry.run,null,2));
 await writeFile(new URL('frames.json',dir),JSON.stringify(entry.frames));
 await writeFile(new URL('result.md',dir),entry.report);
 await writeFile(new URL('provider-egress.json',dir),JSON.stringify(entry.providers,null,2));
 await writeFile(new URL('evaluation.json',dir),JSON.stringify(entry.score,null,2));
 manifest.runs.push({id:entry.id,method:entry.method,createdAt:entry.run.createdAt,model:entry.run.model,status:entry.run.status,elapsedMs:entry.run.metrics.elapsedMs,bytes:entry.run.metrics.totalBytes,modelCalls:entry.run.metrics.modelCalls,toolCalls:entry.run.metrics.toolCalls,receipts:entry.run.receipts.length,frames:entry.frames.length,structuredTaskSuccess:entry.score.structuredTaskSuccess,forbiddenFactTransmissions:entry.score.forbiddenFactTransmissions,unnecessaryFactTransmissions:entry.score.unnecessaryFactTransmissions});
}
manifest.pair={sameCase:true,sameRequestedModel:true,jointBytes:prepared[0].run.metrics.totalBytes,fullBytes:prepared[1].run.metrics.totalBytes,byteDifference:prepared[1].run.metrics.totalBytes-prepared[0].run.metrics.totalBytes};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2));
await writeFile(new URL('README.md',out),'# DeepSeek 现场运行记录\n\n这里保存同一份合成合同的两次真实 DeepSeek API 运行：`joint` 为逐步执行与共享判定，`full` 为完整上下文对照。每项都包含原始运行轨迹、页面事件帧、生成报告、模型出口请求摘要与正文、结构化评价。出口记录不包含 Authorization 请求头或 API 密钥。\n\n这只是两个独立运行，不构成统计实验。模型请求由 `deepseek-flash` 处理；资料查询通过本机独立接收进程访问合成参考库。`evaluation.json` 是既有结构化指标，不是人工文本质量评审。可用 `node scripts/verify-deepseek-records.mjs` 复核文件摘要、接收记录和评价。\n');
console.log(JSON.stringify({directory:out.pathname,runs:manifest.runs.map(r=>({id:r.id,method:r.method,bytes:r.bytes,structuredTaskSuccess:r.structuredTaskSuccess})),pair:manifest.pair}));
