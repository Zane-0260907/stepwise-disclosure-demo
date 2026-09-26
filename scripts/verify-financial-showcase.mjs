import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hash,evaluateLocalProgram} from '../src/research/local-program.mjs';
const root=new URL('../evidence/financial-showcase/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
let requests=0;
for(const entry of manifest.runs){
 const dir=new URL(entry.method+'/',root),run=JSON.parse(await readFile(new URL('trace.json',dir),'utf8'));
 const providers=JSON.parse(await readFile(new URL('provider-egress.json',dir),'utf8'));
 const frames=JSON.parse(await readFile(new URL('frames.json',dir),'utf8'));
 assert.equal(run.id,entry.id);assert.deepEqual(frames.at(-1).snapshot,run);
 assert.deepEqual(run.programCertificates.at(-1),evaluateLocalProgram(run.programCertificates.at(-1).program,run.input,Object.keys(run.input)));
 for(const receipt of run.receipts){
  assert.equal(hash(receipt.rawBody),receipt.sha256);
  const p=providers.find(p=>p.receiverBodySha256===receipt.sha256&&p.responseSha256===receipt.responseSha256);assert.ok(p);
  assert.equal(hash(p.providerBody),p.providerBodySha256);
  assert.deepEqual(JSON.parse(p.providerBody),{...JSON.parse(receipt.rawBody),thinking:{type:'disabled'}});requests++;
 }
}
console.log(JSON.stringify({financialShowcaseRuns:manifest.runs.length,verifiedProviderRequests:requests}));
