import { chromium } from 'playwright';
import { readFile,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LABELS } from '../src/research/catalog.mjs';
const cases=JSON.parse(await readFile(new URL('../fixtures/research/cases.json',import.meta.url),'utf8'));
const out=new URL('../fixtures/research/documents/',import.meta.url);await mkdir(out,{recursive:true});
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{
  const page=await browser.newPage();
  for(const item of cases){
    await page.setContent(`<!doctype html><html lang="zh"><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial,'Microsoft YaHei',sans-serif;color:#23313e;font-size:11px;line-height:1.7}h1{font-size:20px;font-weight:600;margin:0 0 6px}.meta{color:#748392;margin-bottom:18px;font-size:10px}section{break-inside:avoid;border-top:1px solid #e1e6ec;padding:7px 0}.label{font-size:10px;color:#697685}.key{font-family:monospace;font-size:9px;color:#84929e}.value{margin:2px 0;white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:12px;font-size:10px;color:#7b8792}</style><h1>${item.family==='contract'?'采购合同资料':'学习分析资料'}（合成样本）</h1><div class="meta">${escape(item.id)} · 研究演示输入 · 所有身份与业务数据均为合成</div>${Object.entries(item.facts).map(([k,v])=>`<section><div class="label">${escape(LABELS[k]?.[0]||k)}</div><div class="key">[[${k}]]</div><p class="value">${escape(JSON.stringify(v))}</p></section>`).join('')}<div class="key">[[end]]</div><footer>该文件用于核对本地执行与信息共享过程。</footer></html>`);
    await page.pdf({path:fileURLToPath(new URL(item.source,out)),format:'A4',printBackground:true});
  }
  console.log(`Built ${cases.length} source PDFs.`);
}finally{await browser.close();}
