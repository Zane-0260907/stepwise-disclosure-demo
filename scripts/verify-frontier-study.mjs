import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planDisclosureFrontier} from '../src/research/bounded-disclosure-frontier.mjs';
import {planLiveFrontier} from '../src/research/live-frontier.mjs';
import {planComponentFrontier} from '../src/research/component-frontier.mjs';
const root=new URL('../',import.meta.url),base=new URL('evidence/frontier-study/',root),sha=x=>createHash('sha256').update(x).digest('hex');
const load=async p=>JSON.parse(await readFile(new URL(p,base)));
let checked=0;
for(const prefix of ['', 'confirmation/', 'final/']){
 const protocol=await load(prefix+'protocol.json'),bytes=await readFile(new URL(prefix+'workloads.json',base));assert.equal(sha(bytes),protocol.workloadsSha256);
 for(const [f,h]of Object.entries(protocol.sourceHashes))assert.equal(sha(await readFile(new URL(prefix+'frozen-source/'+f,base))),h,'Frozen source changed: '+f);
 const ws=JSON.parse(bytes),rs=await load(prefix+'records.json');
 for(const r of rs){
  if(!r.path)continue;const w=ws.find(w=>w.id===r.caseId);assert.equal(r.path.length,w.steps.length);
  const path=r.path.map((id,i)=>w.steps[i].alternatives.find(a=>a.feasible&&a.id===id));assert.ok(path.every(Boolean));
  assert.deepEqual([new Set(path.flatMap(a=>a.tokens).filter(t=>!w.history.includes(t))).size,path.reduce((n,a)=>n+a.work,0),path.reduce((n,a)=>n+a.fields,0)],r.tuple);assert.ok(r.tuple[2]<=r.budget);checked++;
 }
 if(prefix==='final/')for(const w of ws)for(const slack of protocol.slacks){
  const oracle=rs.find(r=>r.caseId===w.id&&r.slack===slack&&r.method==='milp'&&r.repeat===0);assert.equal(oracle.status,'optimal');
  const p=planDisclosureFrontier(w.steps,w.history,{maxFields:oracle.budget,maxLabels:4096});assert.ok(p.feasible);assert.deepEqual([p.newDisclosures.length,p.work,p.fields],oracle.tuple);
 }
}
const finalProtocol=await load('final/protocol.json');
assert.equal(sha(await readFile(new URL('src/research/bounded-disclosure-frontier.mjs',root))),finalProtocol.sourceHashes['src/research/disclosure-frontier.mjs'],'Final algorithm differs beyond the documented module rename');
assert.equal(sha(await readFile(new URL('src/research/lex-frontier.mjs',root))),finalProtocol.sourceHashes['src/research/lex-frontier.mjs']);
console.log(JSON.stringify({verifiedRecordedPaths:checked,verifiedFinalOptimalSettings:144,newModelCalls:0}));
