import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { scoreValidation } from '../src/research/validation-score.mjs';
const root=new URL('../',import.meta.url),dir=new URL('evidence/progressive-showcase/',root);
const json=async path=>JSON.parse(await readFile(new URL(path,dir),'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const manifest=await json('manifest.json'),translations=await json('translations.json');
const labels=JSON.parse(await readFile(new URL('fixtures/validation-v3/labels.json',root),'utf8'));
for(const meta of manifest.runs){
 const run=await json(`${meta.method}/trace.json`),frames=await json(`${meta.method}/frames.json`),providers=await json(`${meta.method}/provider-egress.json`),score=await json(`${meta.method}/score.json`);
 assert.equal(run.id,meta.id);assert.equal(run.status,'completed');assert.equal(run.result.amount,1150);
 assert.deepEqual(score,scoreValidation(run,labels[run.caseId]));
 assert.equal(run.factRequests.length,1);assert.equal(run.receipts.length,2);assert.equal(providers.length,2);
 assert.equal(frames.at(-1).snapshot.status,'completed');
 for(const receipt of run.receipts){
  assert.equal(sha(receipt.rawBody),receipt.sha256);
  const provider=providers.find(p=>p.receiverBodySha256===receipt.sha256&&p.responseSha256===receipt.responseSha256);
  assert.ok(provider);assert.equal(sha(provider.providerBody),provider.providerBodySha256);
  assert.deepEqual(JSON.parse(provider.providerBody),{...JSON.parse(receipt.rawBody),thinking:{type:'disabled'}});
 }
 for(const key of ['summary','recommendation'])assert.doesNotMatch(translations.runs[run.id][key],/[\u3400-\u9fff]/u);
}
console.log('Progressive showcase: scores, actual request bytes, provider adaptation and translations verified.');
