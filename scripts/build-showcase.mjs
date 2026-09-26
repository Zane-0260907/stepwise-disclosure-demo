import { chromium } from 'playwright';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LABELS } from '../src/research/catalog.mjs';
const all=JSON.parse(await readFile(new URL('../fixtures/validation-v3/cases.json',import.meta.url),'utf8'));
const cases=all.filter(c=>['progressive-09','progressive-13'].includes(c.id)).map(c=>({...c,source:`${c.id}.pdf`,requiresLive:true,title:c.family==='contract'?{zh:'按需补充迟延天数并核算金额',en:'Request the missing delay and calculate the amount'}:{zh:'按需补充学习记录并完成筛查',en:'Request study facts and complete the screening'}}));
const out=new URL('../fixtures/showcase/',import.meta.url);await mkdir(new URL('documents/',out),{recursive:true});
await writeFile(new URL('cases.json',out),JSON.stringify(cases,null,2)+'\n');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{const page=await browser.newPage();for(const item of cases){
 await page.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial,'Microsoft YaHei',sans-serif;color:#23313e;font-size:11px;line-height:1.7}h1{font-size:20px}.meta{color:#748392;margin-bottom:18px}section{break-inside:avoid;border-top:1px solid #e1e6ec;padding:7px 0}.label{font-size:10px;color:#697685}.key{font-family:monospace;font-size:9px;color:#84929e}.value{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>逐步事实补充演示（合成输入）</h1><div class="meta">${escape(item.id)} · 所有身份与业务值均为合成</div>${Object.entries(item.facts).map(([k,v])=>`<section><div class="label">${escape(LABELS[k]?.[0]||k)}</div><div class="key">[[${k}]]</div><p class="value">${escape(JSON.stringify(v))}</p></section>`).join('')}<div class="key">[[end]]</div></html>`);
 await page.pdf({path:fileURLToPath(new URL(`documents/${item.source}`,out)),format:'A4',printBackground:true});
}}finally{await browser.close();}
console.log(JSON.stringify({showcaseCases:cases.length}));
