import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { researchApi } from './research/api.mjs';
import { configureModelRouter } from './research/model-router.mjs';

const liveProvider=await configureModelRouter();
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const WEB=path.join(ROOT,'web');const host=process.env.DEMO_HOST||'127.0.0.1';const port=Number(process.env.DEMO_PORT||4793);
const send=async(res,file,mime)=>{const data=await readFile(file);res.writeHead(200,{'content-type':mime,'content-length':data.length,'cache-control':'no-store'});res.end(data);};
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
 try{
   const pathname=decodeURIComponent(new URL(req.url||'/',`http://${host}:${port}`).pathname);
   if(pathname.startsWith('/api/research/'))return await researchApi(req,res,pathname);
   if(req.method==='GET'&&pathname==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,protocol:'research-v4-matched-controls',liveProvider:liveProvider.provider,liveModel:liveProvider.model,offlineAvailable:true,deepseekAvailable:liveProvider.deepseekAvailable}));return;}
   const asset=/^\/vendor\/pdfjs\/(build\/(?:pdf|pdf\.worker)\.min\.mjs|cmaps\/[\w.-]+\.bcmap|standard_fonts\/[\w.-]+\.(?:ttf|pfb)|wasm\/[\w.-]+\.wasm)$/.exec(pathname);
   if(req.method==='GET'&&asset)return await send(res,path.join(ROOT,'node_modules','pdfjs-dist',asset[1]),asset[1].endsWith('.mjs')?'text/javascript':asset[1].endsWith('.wasm')?'application/wasm':'application/octet-stream');
   const file=path.resolve(WEB,pathname==='/'?'index.html':pathname.slice(1));
   if(req.method!=='GET'||!file.startsWith(WEB+path.sep)||!MIME[path.extname(file)]){res.writeHead(404);res.end('Not found');return;}
   await send(res,file,MIME[path.extname(file)]);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:500,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}
}).listen(port,host,()=>console.log(`Research demo: http://${host}:${port}`));
