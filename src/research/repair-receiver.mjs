import http from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {executeRegistered} from './repair-workloads.mjs';

// A separate process owns the receiving socket. Only the supplied view is used
// by an external operator. Synthetic services are not DeepSeek/cloud calls.
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const part of req)chunks.push(part);const raw=Buffer.concat(chunks);if(raw.length>65536)throw Error('BODY_TOO_LARGE');
  const body=JSON.parse(raw.toString('utf8'));
  if(req.method!=='POST'||req.url!=='/execute')throw Error('INVALID_ROUTE');
  if(!['raw','compact'].includes(body.kind)||!/^service-[AB]2?$/.test(body.recipient))throw Error('INVALID_EXECUTOR');
  const result=executeRegistered(body.operation,body.kind,body.view);
  const receipt={id:randomUUID(),runId:body.runId,stepId:body.stepId,recipient:body.recipient,receivedAt:new Date().toISOString(),rawBody:raw.toString('utf8'),bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({result,receipt}));
 }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
server.listen(0,'127.0.0.1',()=>process.send?.({port:server.address().port}));
process.on('message',m=>{if(m==='stop')server.close(()=>process.exit(0));});
process.on('disconnect',()=>server.close(()=>process.exit(0)));
