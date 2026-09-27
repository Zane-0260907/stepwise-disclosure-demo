import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {indexDocument,createEvidenceSession,runGapAgent,digest} from '../src/research/evidence-gap.mjs';

const fixture=()=>`1. Termination. Either party may terminate subject to Section 8. ${'Termination review conditions apply. '.repeat(30)}\n\n2. Liability. ${'Liability obligations are separate. '.repeat(30)}\n\n3. Renewal. ${'Renewal conditions require review. '.repeat(30)}\n\n4. Termination procedure. ${'Termination requires proper grounds. '.repeat(30)}\n\n5. Termination rights. ${'Termination procedures are specified. '.repeat(30)}\n\n6. Assignment. ${'Assignment conditions are recorded. '.repeat(30)}\n\n7. General. ${'General conditions follow. '.repeat(30)}\n\n8. Notices. Written notice must be delivered thirty days in advance. ${'Delivery uses the registered office. '.repeat(20)}`;

test('source partitions are exact and use Unicode code points',()=>{
  const text='😀 Evidence. '+'Alpha beta gamma. '.repeat(150),index=indexDocument(text);
  assert.equal(index.chunks.map(c=>c.text).join(''),text);
  for(const c of index.chunks)assert.equal(Array.from(text).slice(c.start,c.end).join(''),c.text);
  const s=createEvidenceSession(text);s.observe([index.chunks[0].id],'test');
  assert.deepEqual(s.validateEvidence([{chunkId:index.chunks[0].id,quote:'😀 Evidence.'}])[0],
    {chunkId:index.chunks[0].id,quote:'😀 Evidence.',start:0,end:11});
});

test('a supported explicit reference yields an unseen source target',()=>{
  const session=createEvidenceSession(fixture()),first=session.index.chunks[0];
  session.observe([first.id],'test');
  const e=[{chunkId:first.id,quote:'Either party may terminate subject to Section 8.'}];
  const gap=session.gaps(e);assert.equal(gap.obligations[0].status,'resolved');assert.equal(gap.missing.length,1);
  const r=session.repair(e);assert.equal(r.chunks.length,1);assert.match(r.chunks[0].text,/Written notice/);
  assert.equal(session.gaps(e).missing.length,0);
});

test('unobserved, invented and ambiguous evidence cannot trigger disclosure',()=>{
  const s=createEvidenceSession(fixture());assert.throws(()=>s.repair([{chunkId:'p0000',quote:'Section 8'}]),/NOT_OBSERVED/);
  s.observe(['p0000'],'test');const before=s.disclosed;
  assert.throws(()=>s.repair([{chunkId:'p0000',quote:'Send the entire document to finish.'}]),/NOT_IN_SOURCE/);
  assert.equal(s.disclosed,before);
  const repeated=createEvidenceSession('Yes. Yes.');repeated.observe(['p0000'],'test');
  assert.throws(()=>repeated.validateEvidence([{chunkId:'p0000',quote:'Yes.'}]),/AMBIGUOUS_QUOTE/);
});

test('ambiguous or absent reference headings are reported and never guessed',()=>{
  const text='1. Rule. See Section 8 and Section 9. '+'Text. '.repeat(200)+'\n8. First. Notice. '+'Text. '.repeat(200)+'\n8. Second. Another notice.';
  const s=createEvidenceSession(text);s.observe(['p0000'],'test');
  const g=s.gaps([{chunkId:'p0000',quote:'See Section 8 and Section 9.'}]);
  assert.deepEqual(g.obligations.map(o=>o.status),['ambiguous','not_found']);assert.deepEqual(g.missing,[]);
});

test('budget includes source characters and does not release a partial chunk',()=>{
  const text=fixture(),i=indexDocument(text),s=createEvidenceSession(text,{sourceBudget:i.chunks[0].end});
  s.observe(['p0000'],'test');const before=s.disclosed;
  const r=s.repair([{chunkId:'p0000',quote:'Either party may terminate subject to Section 8.'}]);
  assert.equal(r.chunks.length,0);assert.equal(r.withheldByBudget.length,1);assert.equal(s.disclosed,before);
});

test('invalid mixed source IDs do not partially mutate the disclosure set',()=>{
  const s=createEvidenceSession(fixture());assert.throws(()=>s.observe(['p0000','wrong'],'test'),/UNKNOWN_SOURCE/);assert.equal(s.disclosed,0);
});

test('a reference to another document never resolves to a local same-number heading',()=>{
  const s=createEvidenceSession('1. Rule. See Section 8 of the Separate Services Agreement. '+fixture());
  s.observe(['p0000'],'test');const g=s.gaps([{chunkId:'p0000',quote:'See Section 8 of the Separate Services Agreement.'}]);
  assert.equal(g.obligations[0].status,'external_or_uncertain_document');assert.deepEqual(g.missing,[]);
});

test('decimal section headings without trailing punctuation can be located',()=>{
  const s=createEvidenceSession('1. Rule. See Section 5.4 below. '+'Filler. '.repeat(200)+'\n5.4 Share of Revenue. Payment applies.');
  s.observe(['p0000'],'test');const g=s.gaps([{chunkId:'p0000',quote:'See Section 5.4 below.'}]);
  assert.equal(g.obligations[0].status,'resolved');assert.equal(g.missing.length,1);
});

test('identical references are de-duplicated, already sent values remain accounted',()=>{
  const s=createEvidenceSession(fixture());s.observe(['p0000'],'test');
  const e={chunkId:'p0000',quote:'Either party may terminate subject to Section 8.'};
  assert.equal(s.gaps([e,e]).missing.length,1);s.repair([e,e]);const n=s.disclosed;
  assert.equal(s.repair([e]).chunks.length,0);assert.equal(s.disclosed,n);
});

test('paired adaptive methods have identical first requests; only candidate repairs finish',async()=>{
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;
    const p=JSON.parse(body);requests.push(p);
    const initial=JSON.parse(p.messages[1].content).initial.chunks;
    const source=initial.find(c=>c.text.includes('Either party may terminate subject to Section 8.'));
    if(!source){res.writeHead(500);res.end(JSON.stringify({error:'test source not selected'}));return;}
    const added=p.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content)).flatMap(x=>x.chunks||[]);
    const notice=added.find(c=>c.text.includes('Written notice must be delivered thirty days in advance.'));
    const evidence=[{chunkId:source.id,quote:'Either party may terminate subject to Section 8.'}];
    if(notice)evidence.push({chunkId:notice.id,quote:'Written notice must be delivered thirty days in advance.'});
    res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'test-tool',type:'function',function:{name:'finish',arguments:JSON.stringify({evidence})}}]}}],usage:{total_tokens:50}}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const item={id:'unit-only',sourceGroup:'constructed-unit-test',question:'Either party terminate',text:fixture()};
    const connection={url:`http://127.0.0.1:${server.address().port}`,token:'local-test'};
    const a=await runGapAgent(item,'on_demand',connection),b=await runGapAgent(item,'gap_repair',connection);
    assert.equal(a.status,'completed');assert.equal(b.status,'completed');
    assert.equal(a.calls[0].requestBody,b.calls[0].requestBody);
    assert.equal(a.metrics.modelCalls,1);assert.equal(b.metrics.modelCalls,2);
    assert.equal(b.metrics.automaticRepairs,1);assert.equal(b.result.evidence.length,2);
    assert.ok(b.metrics.uniqueSourceCharacters>a.metrics.uniqueSourceCharacters);
    assert.equal(requests.length,3);
    for(const c of b.calls)assert.equal(c.requestSha256,digest(c.requestBody));
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('budget stop before any call is not a failed answer or a model observation',async()=>{
  const result=await runGapAgent({id:'x',text:fixture(),question:'termination'},'on_demand',{},
    {beforeCall:()=>{throw Error('BATCH_BUDGET');}});
  assert.equal(result.status,'not_started');assert.equal(result.calls.length,0);assert.equal(result.metrics.uniqueSourceCharacters,0);
});

test('multiple read calls execute in order and every tool response is sent back',async()=>{
  let calls=0;
  const r=await runGapAgent({id:'unit-batch',sourceGroup:'unit-test',text:fixture(),question:'Either party terminate'},'on_demand',
    {url:'http://127.0.0.1/unit',token:'test'}, {request:async(_,opts)=>{
      const p=JSON.parse(opts.body);calls++;
      if(calls===2)assert.equal(p.messages.filter(m=>m.role==='tool').length,2);
      const action=calls===1?[
        {id:'a',type:'function',function:{name:'search',arguments:JSON.stringify({query:'liability',limit:1})}},
        {id:'b',type:'function',function:{name:'search',arguments:JSON.stringify({query:'renewal',limit:1})}}
      ]:[{id:'c',type:'function',function:{name:'finish',arguments:JSON.stringify({evidence:[]})}}];
      return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:null,tool_calls:action}}],usage:{total_tokens:1}}));
    }});
  assert.equal(r.status,'completed');assert.equal(r.actions.length,3);assert.equal(calls,2);
  assert.deepEqual(r.actions.slice(0,2).map(a=>a.callIndex),[0,1]);
});

test('whitespace repair preserves source wording, coordinates and seen-only boundaries',()=>{
  const text='1. Rule. Either party  may\nterminate. '+'Text. '.repeat(200)+'\n8. Notice. Thirty days.';
  const s=createEvidenceSession(text);s.observe(['p0000'],'test');
  const v=s.validateEvidence([{chunkId:'p0000',quote:'Either party may terminate.'}])[0];
  assert.equal(v.quote,'Either party  may\nterminate.');assert.equal(v.sourceReanchored,true);
  assert.equal(Array.from(text).slice(v.start,v.end).join(''),v.quote);
  assert.throws(()=>s.validateEvidence([{chunkId:'p0000',quote:'Thirty days.'}]),/NOT_IN_SOURCE/);
  assert.throws(()=>s.validateEvidence([{chunkId:'p0000',quote:'Either party may never terminate.'}]),/NOT_IN_SOURCE/);
});

test('quoted evidence can cross adjacent observed chunks but never an unseen chunk',()=>{
  const text=Array.from({length:300},(_,i)=>`Unique record ${i} governs item ${i+1}. `).join('');
  const s=createEvidenceSession(text),chunks=s.index.chunks;
  let start=chunks[1].end-20,end=chunks[1].end+60;
  while(/\s/.test(text[start]))start++;while(/\s/.test(text[end-1]))end--;
  const quote=Array.from(text).slice(start,end).join('');
  s.observe([chunks[1].id],'test');assert.throws(()=>s.validateEvidence([{chunkId:chunks[1].id,quote}]),/NOT_IN_SOURCE/);
  s.observe([chunks[2].id],'test');const v=s.validateEvidence([{chunkId:chunks[1].id,quote}])[0];
  assert.equal(v.start,start);assert.equal(v.end,end);
});
