import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { startDeepSeekProxy } from './deepseek-live.mjs';
import { OFFLINE_MODEL, executeOfflineRequest } from './offline-driver.mjs';

const respond=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};

export async function configureModelRouter(){
 const providerKey=process.env.DEEPSEEK_API_KEY?.trim();
 delete process.env.DEEPSEEK_API_KEY;
 delete process.env.DASHSCOPE_API_KEY;
 delete process.env.DEMO_MODEL_URL;
 const deepseek=providerKey?await startDeepSeekProxy({key:providerKey}):null;
 const token=randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/chat/completions'||req.headers.authorization!==`Bearer ${token}`)return respond(res,403,{error:{message:'Forbidden'}});
  try{
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>262144)throw new Error('Request too large');chunks.push(chunk);}
   const body=Buffer.concat(chunks);const payload=JSON.parse(body.toString('utf8'));
   if(payload.model===OFFLINE_MODEL)return respond(res,200,executeOfflineRequest(payload));
   if(payload.model!=='deepseek-flash'||!deepseek)return respond(res,503,{error:{message:'DeepSeek is not configured'}});
   const upstream=await fetch(deepseek.url,{method:'POST',headers:{authorization:`Bearer ${deepseek.internalToken}`,'content-type':'application/json'},body,signal:AbortSignal.timeout(95000)});
   const reply=await upstream.text();res.writeHead(upstream.status,{'content-type':'application/json; charset=utf-8'});res.end(reply);
  }catch(error){respond(res,502,{error:{message:error.message}});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 process.env.DASHSCOPE_API_KEY=token; // frozen receiver's legacy variable: only a local router token
 process.env.DEMO_MODEL_URL=`http://127.0.0.1:${server.address().port}/chat/completions`;
 process.env.RESEARCH_MODEL=OFFLINE_MODEL;
 process.env.DEMO_DEEPSEEK_AVAILABLE=String(Boolean(deepseek));
 return {provider:'offline',model:OFFLINE_MODEL,deepseekAvailable:Boolean(deepseek),close:async()=>{await new Promise(resolve=>server.close(resolve));await deepseek?.close();}};
}
