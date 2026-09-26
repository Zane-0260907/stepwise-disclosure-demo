import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createTransport } from './transport.mjs';
import { getCase as getFrozenCase, loadCases as loadFrozenCases, METHODS, METHOD_NAMES, publicCase, LABELS } from './catalog.mjs';
import { createRun, acceptReceipt } from './engine.mjs';
import { executeAdaptiveRun as executeRun } from './adaptive-execution.mjs';
import { readCaseDocument as readFrozenDocument } from './documents.mjs';
import { showcaseCases,readShowcaseDocument } from './showcase.mjs';
import { OFFLINE_MODEL } from './offline-driver.mjs';
import { addEvent } from './engine.mjs';

const root=new URL('../../data/research/runs/',import.meta.url);
const bundled=new URL('../../evidence/research/sample-run.json',import.meta.url);
const featuredRoot=new URL('../../evidence/research/deepseek-live-20260926/',import.meta.url);
const progressiveRoot=new URL('../../evidence/progressive-showcase/',import.meta.url);
const featuredDirectory=entry=>entry.bundle==='progressive'?new URL(`${entry.method}/`,progressiveRoot):new URL(`${entry.method}/`,featuredRoot);
const getCase=async id=>(await showcaseCases()).find(c=>c.id===id)||getFrozenCase(id);
const loadCases=async()=>[...await loadFrozenCases(),...await showcaseCases()];
const readCaseDocument=id=>id.startsWith('progressive-')?readShowcaseDocument(id):readFrozenDocument(id);
const runs=new Map(),clients=new Map(),frames=new Map(),pending=new Map(),decisions=new Map();
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
let transportPromise;
function notify(run,event){
  const snapshot=structuredClone(run);
  if(frames.has(run.id))frames.get(run.id).push({at:Date.now(),snapshot});
  const packet=`event: update\ndata: ${JSON.stringify({snapshot,event,done:!['queued','running'].includes(run.status)&&Boolean(run.finishedAt)})}\n\n`;
  for(const res of clients.get(run.id)||[])res.write(packet);
}
async function transport(){
  transportPromise ||= createTransport((receipt)=>{
    const run=runs.get(receipt.runId);const step=run?.steps.find(s=>s.id===receipt.stepId);
    if(run&&step)acceptReceipt(run,step,receipt,notify);
  });
  return transportPromise;
}
async function save(run){
  const dir=new URL(`${run.id}/`,root);await mkdir(dir,{recursive:true});
  await writeFile(new URL('trace.json',dir),JSON.stringify(run,null,2));
  if(run.report)await writeFile(new URL('result.md',dir),run.report);
  if(frames.has(run.id))await writeFile(new URL('frames.json',dir),JSON.stringify(frames.get(run.id)));
}
async function featured(){
 try{const original=JSON.parse(await readFile(new URL('manifest.json',featuredRoot),'utf8'));
  try{const added=JSON.parse(await readFile(new URL('manifest.json',progressiveRoot),'utf8'));original.runs.push(...added.runs.map(r=>({...r,bundle:'progressive'})));}catch(e){if(e.code!=='ENOENT')throw e;}
  return original;}
 catch(error){if(error.code==='ENOENT')return {runs:[]};throw error;}
}
async function findRun(id){
  if(!/^[a-f0-9-]{36}$/.test(id))return null;
  if(runs.has(id))return runs.get(id);
  try{return JSON.parse(await readFile(new URL(`${id}/trace.json`,root),'utf8'));}catch{
    const item=(await featured()).runs.find(entry=>entry.id===id);
    if(item)return JSON.parse(await readFile(new URL('trace.json',featuredDirectory(item)),'utf8'));
    try{const sample=JSON.parse(await readFile(bundled,'utf8'));return sample.id===id?sample:null;}catch{return null;}
  }
}
async function input(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw new Error('Request too large');}return JSON.parse(body||'{}');}
function overridesOf(raw){
 const out={};if(raw===undefined)return out;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['amount','late_days'].includes(k)))throw new Error('Invalid input overrides');
 for(const [key,value] of Object.entries(raw)){
  if(value===''||value===null||value===undefined)continue;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0||number>1e9||(key==='late_days'&&!Number.isInteger(number)))throw new Error(`Invalid ${key}`);
  out[key]=number;
 }
 return out;
}
function normalizeOfflineReport(run){
 if(run.executionMode==='offline'&&run.report)run.report=run.report.replace('模型调用：','本机规则执行器调用：').replace('本机独立接收进程记录请求，不是云厂商独立回执。','本机独立接收进程记录请求；本次分析由本机规则执行器完成，不涉及外部模型。');
}
function launch(run,options){
 if(run.status!=='queued')return false;
 run.status='running';run.startedAt=new Date().toISOString();notify(run,{type:'run.started'});
 const task=async()=>{
  try{
   const parse={id:`step-${run.steps.length+1}`,operation:'parse_document',title:{zh:'读取并核对合成 PDF',en:'Read and verify synthetic PDF'},reason:{zh:'本地提取文档字段并核对文件摘要。',en:'Extract local fields and verify the file digest.'},location:'local',status:'running',startedAt:new Date().toISOString(),input:{caseId:run.caseId},retained:[],receipts:[],output:null,checks:[]};
   run.steps.push(parse);addEvent(run,'step.started',{stepId:parse.id},notify);
   const item=await readCaseDocument(run.caseId);
   const changed=overridesOf(options.overrides);
   for(const [key,value] of Object.entries(changed)){
    if(!(key in item.facts))throw new Error(`Input field ${key} is not present in this case`);
    item.facts[key]=value;
   }
   run.overrides=changed;run.input=structuredClone(item.facts);run.document=item.document;
   parse.source=item.document;parse.output={document:item.document,overrides:changed,fieldCount:Object.keys(item.facts).length};parse.status='completed';parse.finishedAt=new Date().toISOString();addEvent(run,'step.completed',{stepId:parse.id},notify);
   const recordEvent=(current,event)=>{normalizeOfflineReport(current);notify(current,event);};
   await executeRun(run,item,await transport(),{notify:recordEvent,hook:async(stage,context)=>{
    if(stage!=='beforeSend'||run.condition!=='guided_revoke'||run.decisionUsed||context.step.operation!=='analyze')return;
    run.decisionUsed=true;run.awaitingDecision={stepId:context.step.id,recipient:context.step.recipient,preparedAt:new Date().toISOString()};
    addEvent(run,'decision.awaiting',{stepId:context.step.id},notify);
    await new Promise(resolve=>decisions.set(run.id,resolve));
   }});
   normalizeOfflineReport(run);
  }catch(error){run.status='failed';run.error=error.message;run.finishedAt=new Date().toISOString();addEvent(run,'run.error',{message:error.message},notify);}
  finally{pending.delete(run.id);decisions.delete(run.id);await save(run);}
 };
 task().catch(error=>{run.error=error.message;run.status='failed';notify(run,{type:'run.error'});});
 return true;
}
export async function researchApi(req,res,pathname){
  if(!pathname.startsWith('/api/research/'))return false;
  try{
    const route=pathname.slice('/api/research'.length);
    if(req.method==='GET'&&route==='/bootstrap'){
      const featuredRuns=(await featured()).runs;
      let presentationTranslations={};try{presentationTranslations=JSON.parse(await readFile(new URL('translations.json',featuredRoot),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      try{const extra=JSON.parse(await readFile(new URL('translations.json',progressiveRoot),'utf8'));presentationTranslations.runs={...presentationTranslations.runs,...extra.runs};presentationTranslations.values={...presentationTranslations.values,...extra.values};}catch(e){if(e.code!=='ENOENT')throw e;}
      let sampleRunId=featuredRuns.find(entry=>entry.method==='joint')?.id||null;try{sampleRunId ||=JSON.parse(await readFile(bundled,'utf8')).id;}catch{}
      return json(res,200,{protocol:'research-v1',offlineAvailable:true,deepseekAvailable:process.env.DEMO_DEEPSEEK_AVAILABLE==='true',liveAvailable:process.env.DEMO_DEEPSEEK_AVAILABLE==='true',sampleRunId,featuredRuns:featuredRuns.map(({id,method,model,createdAt,label,caseId})=>({id,method,model,createdAt,label,caseId})),presentationTranslations,methods:METHOD_NAMES,labels:LABELS,cases:(await loadCases()).filter(c=>c.split==='evaluation'||c.requiresLive).map(publicCase),defaultCase:'contract-21',scenarios:[{id:'facts',caseId:'progressive-09',condition:'normal',requiresLive:true,title:{zh:'补充必要事实 · DeepSeek',en:'Request missing facts · DeepSeek'}},{id:'local',caseId:'contract-01',condition:'normal',title:{zh:'标准条款 · 本地完成',en:'Standard clause · local'}},{id:'dynamic',caseId:'contract-21',condition:'normal',title:{zh:'引用条款 · 动态查询',en:'Cited clause · dynamic lookup'}},{id:'revoked',caseId:'contract-21',condition:'guided_revoke',title:{zh:'发送前人工撤权',en:'Revoke before sending'}}]});
    }
    if(req.method==='GET'&&route==='/history'){
      const visible=new Map([...runs.values()].filter(r=>r.source==='live'&&r.uiVisible&&!r.caseId.startsWith('dev-')).map(r=>[r.id,r]));
      const entries=await readdir(root,{withFileTypes:true}).catch(()=>[]);
      for(const entry of entries){if(!entry.isDirectory()||visible.has(entry.name))continue;const r=await findRun(entry.name);if(r?.uiVisible&&r.source==='live'&&!r.caseId.startsWith('dev-'))visible.set(r.id,r);}
      const list=[...visible.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12).map(r=>({id:r.id,caseId:r.caseId,condition:r.condition||'normal',title:r.title,method:r.method,status:r.status,createdAt:r.createdAt}));
      return json(res,200,list);
    }
    if(req.method==='POST'&&route==='/runs'){
      const options=await input(req);
      if(!METHODS.includes(options.method||'joint')||!['normal','revoke_after_plan','guided_revoke'].includes(options.condition||'normal'))return json(res,400,{error:'Invalid method or condition'});
      const mode=options.mode||'offline';if(!['offline','deepseek'].includes(mode))return json(res,400,{error:'Invalid execution mode'});
      if(mode==='deepseek'&&process.env.DEMO_DEEPSEEK_AVAILABLE!=='true')return json(res,409,{error:'DeepSeek API key is not configured'});
      const overrides=overridesOf(options.overrides);
      const item=await getCase(options.caseId||'contract-21');
      if(item.requiresLive&&mode!=='deepseek')return json(res,409,{error:'This scenario requires a live model. Use its saved DeepSeek replay without a key.'});
      const run=createRun(item,{...options,model:mode==='offline'?OFFLINE_MODEL:'deepseek-flash'});run.status='queued';run.executionMode=mode;run.uiVisible=options.captureFrames!==false;runs.set(run.id,run);
      if(options.captureFrames!==false)frames.set(run.id,[]);
      pending.set(run.id,{...options,overrides});
      if(options.deferStart!==true)launch(run,pending.get(run.id));
      return json(res,201,{id:run.id});
    }
    if(req.method==='POST'&&route==='/replay'){
      const options=await input(req);const original=await findRun(options.runId||'');
      if(!original)return json(res,404,{error:'先完成一次现场运行，才能重放该次记录。'});
      let recorded;
      try{recorded=JSON.parse(await readFile(new URL(`${original.id}/frames.json`,root),'utf8'));}catch{
        try{const item=(await featured()).runs.find(entry=>entry.id===original.id);if(item)recorded=JSON.parse(await readFile(new URL('frames.json',featuredDirectory(item)),'utf8'));else{const sample=JSON.parse(await readFile(bundled,'utf8'));if(sample.id!==original.id)throw new Error('Not a bundled run');recorded=JSON.parse(await readFile(new URL('../../evidence/research/sample-frames.json',import.meta.url),'utf8'));}}catch{return json(res,404,{error:'该运行没有界面回放记录。'});}
      }
      const id=randomUUID();const initial={...structuredClone(recorded[0]?.snapshot||original),id,source:'recorded',recordedRunId:original.id,status:'running'};runs.set(id,initial);
      (async()=>{
        for(let i=0;i<recorded.length;i++){
          await new Promise(resolve=>setTimeout(resolve,Math.min(1800,Math.max(850,i?recorded[i].at-recorded[i-1].at:850))));
          const run={...structuredClone(recorded[i].snapshot),id,source:'recorded',recordedRunId:original.id};runs.set(id,run);notify(run,{type:'replay.frame'});
        }
      })().catch(error=>{initial.status='failed';initial.error=error.message;notify(initial,{type:'run.error'});});
      return json(res,201,{id});
    }
    const documentMatch=/^\/documents\/([a-z0-9-]+)\.pdf$/.exec(route);
    if(req.method==='GET'&&documentMatch){
      const item=await getCase(documentMatch[1]);const data=await readFile(new URL(`../../fixtures/${item.requiresLive?'showcase':'research'}/documents/${item.source}`,import.meta.url));
      res.writeHead(200,{'content-type':'application/pdf','content-length':data.length,'cache-control':'no-store'});res.end(data);return true;
    }
    const match=/^\/runs\/([a-f0-9-]{36})(?:\/(stream|report|evidence|source|revoke|start|decision))?$/.exec(route);
    if(match){
      const run=await findRun(match[1]);if(!run)return json(res,404,{error:'Run not found'});
      if(req.method==='POST'&&match[2]==='start'){
        if(!pending.has(run.id)||!launch(run,pending.get(run.id)))return json(res,409,{error:'Run has already started'});
        return json(res,202,{id:run.id,status:'running'});
      }
      if(req.method==='POST'&&match[2]==='decision'){
        const body=await input(req);if(!['allow','revoke'].includes(body.action)||!run.awaitingDecision||!decisions.has(run.id))return json(res,409,{error:'No decision is pending'});
        if(body.action==='revoke')run.policy={allowed:false,version:run.policy.version+1};
        run.decision={action:body.action,at:new Date().toISOString(),stepId:run.awaitingDecision.stepId};run.awaitingDecision=null;
        addEvent(run,'decision.made',run.decision,notify);const resolve=decisions.get(run.id);decisions.delete(run.id);resolve();return json(res,200,run.decision);
      }
      if(req.method==='POST'&&match[2]==='revoke'){
        if(run.source!=='live'||run.status!=='running')return json(res,409,{error:'Run is not active'});
        run.policy={allowed:false,version:run.policy.version+1};notify(run,{type:'policy.changed'});return json(res,200,run.policy);
      }
      if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
      if(match[2]==='stream'){
        res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform',connection:'keep-alive'});
        res.write(`event: snapshot\ndata: ${JSON.stringify({snapshot:run,done:!['queued','running'].includes(run.status)&&Boolean(run.finishedAt)})}\n\n`);
        if(!['queued','running'].includes(run.status)){res.end();return true;}
        if(!clients.has(run.id))clients.set(run.id,new Set());clients.get(run.id).add(res);
        req.on('close',()=>clients.get(run.id)?.delete(res));return true;
      }
      if(match[2]==='source')return json(res,200,{caseId:run.caseId,task:run.task,facts:run.input});
      if(match[2]==='evidence'){
        res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="run-evidence.json"','cache-control':'no-store'});res.end(JSON.stringify(run,null,2));return true;
      }
      if(match[2]==='report'){
        if(!run.report)return json(res,404,{error:'No report'});
        res.writeHead(200,{'content-type':'text/markdown; charset=utf-8','content-disposition':'attachment; filename="result.md"'});res.end(run.report);return true;
      }
      return json(res,200,run);
    }
    return json(res,404,{error:'Endpoint not found'});
  }catch(error){return json(res,400,{error:error.message});}
}
