import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const references = JSON.parse(await readFile(new URL('../../fixtures/research/references.json', import.meta.url),'utf8'));
const root = new URL('../../data/research/receipts/', import.meta.url);
await mkdir(root, { recursive: true });
const send = (res,status,data) => { res.writeHead(status,{'content-type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
const server = http.createServer(async(req,res)=>{
  if (req.method !== 'POST' || !['/model','/reference'].includes(req.url) || req.headers['x-receiver-token'] !== process.env.RECEIVER_TOKEN) return send(res,403,{error:'Forbidden'});
  let receipt;
  try {
    const chunks=[]; let size=0;
    for await(const chunk of req) { size+=chunk.length; if(size>262144) throw new Error('Request too large'); chunks.push(chunk); }
    const bytes=Buffer.concat(chunks); const body=JSON.parse(bytes.toString('utf8'));
    const runId=String(req.headers['x-run-id']||''); if(!/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Invalid run ID');
    receipt={ id:randomUUID(),runId,stepId:String(req.headers['x-step-id']||''),recipient:req.url==='/model'?'cloud-model':'reference-service',receivedAt:new Date().toISOString(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),rawBody:bytes.toString('utf8'),processId:process.pid };
    const save=async()=>writeFile(new URL(`${receipt.id}.json`,root),JSON.stringify(receipt,null,2));
    await save(); process.send?.({type:'receipt',receipt});
    let response, status=200;
    if(req.url==='/reference') {
      const found=references.find((r)=>r.code===body.code && r.version===body.version);
      if(!found){status=404;response={error:'指定版本资料不存在'};} else response=found;
    } else {
      if(!process.env.DASHSCOPE_API_KEY) throw new Error('No model key configured');
      const upstream=await fetch(process.env.DEMO_MODEL_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',{
        method:'POST',headers:{authorization:`Bearer ${process.env.DASHSCOPE_API_KEY}`,'content-type':'application/json'},body:bytes,signal:AbortSignal.timeout(90000),
      });
      status=upstream.status;
      const text=await upstream.text();
      try{response=JSON.parse(text);}catch{response={error:'Upstream returned non-JSON',status};}
      receipt.responseSha256=createHash('sha256').update(text).digest('hex');
      receipt.usage=response.usage || null; receipt.providerId=response.id || null;
    }
    receipt.status=status; receipt.finishedAt=new Date().toISOString(); await save();
    send(res,200,{receipt,status,response});
  }catch(error){send(res,502,{error:error.message,receipt});}
});
server.listen(0,'127.0.0.1',()=>process.send?.({type:'ready',port:server.address().port}));
process.on('disconnect',()=>server.close(()=>process.exit(0)));
