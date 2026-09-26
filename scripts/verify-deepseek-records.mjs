import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { evaluateRun } from '../src/research/evaluate.mjs';

const root=new URL('../evidence/research/deepseek-live-20260926/',import.meta.url);
const json=async url=>JSON.parse(await readFile(url,'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=await json(new URL('manifest.json',root));
const translations=await json(new URL('translations.json',root));
assert.equal(manifest.runs.length,2);
for(const meta of manifest.runs){
 const translation=translations.runs[meta.id];assert.ok(translation,`Missing English presentation for ${meta.id}`);
 for(const field of ['summary','recommendation']){assert.ok(translation[field]);assert.doesNotMatch(translation[field],/[\u3400-\u9fff]/u);}
}
assert.ok(translations.referenceC01);assert.doesNotMatch(translations.referenceC01,/[\u3400-\u9fff]/u);
for(const meta of manifest.runs){
 const dir=new URL(`${meta.method}/`,root);
 const run=await json(new URL('trace.json',dir));
 const frames=await json(new URL('frames.json',dir));
 const providers=await json(new URL('provider-egress.json',dir));
 const recordedScore=await json(new URL('evaluation.json',dir));
 const recalculated=await evaluateRun(run);
 assert.equal(run.id,meta.id);assert.equal(run.model,'deepseek-flash');assert.equal(run.executionMode,'deepseek');assert.equal(run.status,'completed');
 assert.equal(run.receipts.length,3);assert.equal(run.metrics.modelCalls,2);assert.equal(run.metrics.toolCalls,1);
 assert.equal(frames.at(-1)?.snapshot?.status,'completed');assert.equal(providers.length,2);
 assert.deepEqual(recordedScore,recalculated);assert.equal(recalculated.structuredTaskSuccess,true);
 for(const receipt of run.receipts){assert.equal(sha(receipt.rawBody),receipt.sha256);if(receipt.recipient==='cloud-model'){
  const provider=providers.find(p=>p.receiverBodySha256===receipt.sha256);
  assert.ok(provider);assert.equal(provider.responseSha256,receipt.responseSha256);assert.equal(sha(provider.providerBody),provider.providerBodySha256);assert.equal(provider.responseStatus,200);
 }}
}
for(const entry of await readdir(root,{withFileTypes:true})){
 const files=entry.isDirectory()?await readdir(new URL(`${entry.name}/`,root)):[];
 for(const name of entry.isDirectory()?files:[entry.name]){const content=await readFile(new URL(entry.isDirectory()?`${entry.name}/${name}`:name,root),'utf8');assert.doesNotMatch(content,/sk-[a-z0-9]{30,}/i);assert.doesNotMatch(content,/Bearer\s+sk-/i);}
}
console.log(JSON.stringify({records:2,englishPresentations:2,requestedModel:'deepseek-flash',allReceiverDigestsMatch:true,allProviderEgressDigestsMatch:true,allScoresRecomputed:true,credentialPatternFound:false}));
