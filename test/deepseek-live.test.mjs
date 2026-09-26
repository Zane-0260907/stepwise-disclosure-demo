import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { startDeepSeekProxy } from '../src/research/deepseek-live.mjs';

test('live adapter sends a DeepSeek request with the provider key and records its transformed body',async()=>{
 const requests=[];
 const upstream=http.createServer(async(req,res)=>{
  const raw=Buffer.concat(await Array.fromAsync(req)).toString('utf8');
  requests.push({authorization:req.headers.authorization,body:JSON.parse(raw)});
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:'{}'}}]}));
 });
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 const recordDirectory=new URL(`../data/research/test-provider-egress/${randomUUID()}/`,import.meta.url);
 await mkdir(recordDirectory,{recursive:true});
 const proxy=await startDeepSeekProxy({key:'test-deepseek-key',endpoint:`http://127.0.0.1:${upstream.address().port}/chat/completions`,recordDirectory});
 try{
  const denied=await fetch(proxy.url,{method:'POST',body:'{}'});assert.equal(denied.status,403);
  const body={model:'deepseek-flash',messages:[{role:'user',content:'请输出 JSON'}],response_format:{type:'json_object'}};
  const raw=JSON.stringify(body);
  const response=await fetch(proxy.url,{method:'POST',headers:{authorization:`Bearer ${proxy.internalToken}`,'content-type':'application/json'},body:raw});
  assert.equal(response.status,200);assert.equal((await response.json()).model,'deepseek-flash');
  assert.equal(requests.length,1);assert.equal(requests[0].authorization,'Bearer test-deepseek-key');
  assert.deepEqual(requests[0].body,{...body,thinking:{type:'disabled'}});
  assert.deepEqual(JSON.parse(raw),body);
  const files=await readdir(recordDirectory);assert.equal(files.length,1);
  const record=JSON.parse(await readFile(new URL(files[0],recordDirectory),'utf8'));
  assert.equal(record.provider,'deepseek');assert.equal(record.receiverBodySha256,createHash('sha256').update(raw).digest('hex'));
  assert.deepEqual(JSON.parse(record.providerBody),requests[0].body);
  assert.doesNotMatch(JSON.stringify(record),/test-deepseek-key/);
 }finally{await proxy.close();await new Promise(resolve=>upstream.close(resolve));}
});
