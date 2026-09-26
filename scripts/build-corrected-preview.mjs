import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {correctedCases} from '../src/research/corrected-showcase.mjs';
const out=new URL('../fixtures/corrected-showcase/documents/',import.meta.url);await mkdir(out,{recursive:true});
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{const page=await browser.newPage();for(const item of await correctedCases()){
 await page.setContent(`<html><meta charset="utf-8"><style>@page{size:A4 landscape;margin:20mm}body{font:12px/1.7 Arial,'Microsoft YaHei',sans-serif;color:#1b2933}h1{font-size:19px}table{border-collapse:collapse;width:100%}td,th{padding:9px;text-align:left;border-bottom:1px solid #dfe4e8}small{color:#60717f}</style><h1>FinQA · 公开表格 / Public table</h1><p>${esc(item.question)}</p><p>${esc(item.task.zh)}</p><table>${item.originalTable.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</table><p>Source: ${esc(item.datasetSource)}</p><small>Readable preview of the structured public-data fixture. Execution loads development.json; this PDF is not the original corporate report. 数值执行读取结构化数据，本页为预览，并非原始年报。FinQA: MIT license.</small></html>`);
 await page.pdf({path:fileURLToPath(new URL(item.source,out)),format:'A4',landscape:true,printBackground:true});
}}finally{await browser.close();}
