import http from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const MODEL='deepseek-flash';
const ENDPOINT='https://api.deepseek.com/chat/completions';
const sha=data=>createHash('sha256').update(data).digest('hex');
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};

// The frozen research receiver records its input unchanged. This local adapter
// records the exact provider payload separately and adds DeepSeek's non-thinking
// setting, which the frozen Qwen request format did not contain.
export async function startDeepSeekProxy({key,endpoint=ENDPOINT,recordDirectory=new URL('../../data/research/provider-egress/',import.meta.url)}){
 if(!key)throw new Error('A DeepSeek API key is required');
 const internalToken=randomBytes(32).toString('hex');
 await mkdir(recordDirectory,{recursive:true});
 const server=http.createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/chat/completions'||req.headers.authorization!==`Bearer ${internalToken}`)return json(res,403,{error:{message:'Forbidden'}});
  try{
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>262144)throw new Error('Request too large');chunks.push(chunk);}
   const received=Buffer.concat(chunks);const payload=JSON.parse(received.toString('utf8'));
   if(payload.model!==MODEL)throw new Error('Unexpected model');
   payload.thinking={type:'disabled'};
   const providerBody=JSON.stringify(payload);
   const upstream=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:providerBody,signal:AbortSignal.timeout(90000)});
   const responseBody=await upstream.text();
   const record={id:randomUUID(),at:new Date().toISOString(),provider:'deepseek',model:MODEL,endpoint,receiverBodySha256:sha(received),providerBodySha256:sha(providerBody),providerBody,responseStatus:upstream.status,responseSha256:sha(responseBody)};
   await writeFile(new URL(`${record.id}.json`,recordDirectory),JSON.stringify(record,null,2));
   res.writeHead(upstream.status,{'content-type':'application/json; charset=utf-8'});res.end(responseBody);
  }catch(error){json(res,502,{error:{message:error.message,type:'ProviderTransport'}});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/chat/completions`,internalToken,close:()=>new Promise(resolve=>server.close(resolve))};
}

export async function configureDeepSeekLive(){
 const key=process.env.DEEPSEEK_API_KEY?.trim();
 delete process.env.DEEPSEEK_API_KEY;
 // A previously inherited DashScope credential must never select the provider.
 delete process.env.DASHSCOPE_API_KEY;
 delete process.env.DEMO_MODEL_URL;
 process.env.RESEARCH_MODEL=MODEL;
 if(!key)return {provider:'deepseek',model:MODEL,available:false};
 const proxy=await startDeepSeekProxy({key});
 // The frozen receiver uses this legacy variable for the *local adapter token*.
 // It never contains or forwards the DeepSeek account key.
 process.env.DASHSCOPE_API_KEY=proxy.internalToken;
 process.env.DEMO_MODEL_URL=proxy.url;
 return {provider:'deepseek',model:MODEL,available:true,close:proxy.close};
}
