import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out=new URL('../evidence/progressive-showcase/ui/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{
 const page=await browser.newPage({baseURL:process.env.DEMO_BASE||'http://127.0.0.1:4793',viewport:{width:1440,height:850},deviceScaleFactor:1.5});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.DEMO_BASE||'http://127.0.0.1:4793',{waitUntil:'networkidle'});
 await page.locator('.featured-run').filter({hasText:'补充必要事实'}).click();
 await page.waitForFunction(()=>document.querySelector('#header-state').textContent==='已完成'&&document.querySelector('#agent-result').textContent.includes('页面逐步展示'),null,{timeout:90000});
 const run=await(await page.request.get('/api/research/runs/83fd687d-6783-4e0f-ab9a-4064fb359d12')).json();
 assert.equal(run.result.amount,1150);assert.equal(run.factRequests.length,1);
 assert.deepEqual(run.factRequests[0].fields,['late_days','amount']);
 assert.equal(run.receipts.length,2);
 const analysis=run.steps.filter(s=>s.operation==='analyze').at(-1);
 await page.locator(`button[data-step-id="${analysis.id}"]`).click();
 await page.locator('#agent-result').scrollIntoViewIfNeeded();
 await page.screenshot({path:fileURLToPath(new URL('progressive.zh-CN.png',out))});
 // A browser-captured detail for the manuscript. Only neutral panel numbers
 // are added; the recorded result and fields are unchanged.
 await page.evaluate(()=>{for(const [selector,label]of [['.task-step.is-selected','①'],['.view-columns','②'],['#agent-result','③']]){const node=document.querySelector(selector);if(node){node.style.position='relative';const tag=document.createElement('span');tag.className='paper-callout';tag.textContent=label;tag.style.cssText='position:absolute;left:-18px;top:0;background:white;color:#111;font:700 20px Arial;z-index:8';node.append(tag);}}});
 await page.screenshot({path:fileURLToPath(new URL('paper-detail.zh-CN.png',out)),clip:{x:285,y:85,width:1145,height:650}});
 await page.locator('.paper-callout').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
 await page.locator('#lang-en').click();
 assert.doesNotMatch(await page.locator('#agent-result').innerText(),/[\u3400-\u9fff]/u);
 await page.screenshot({path:fileURLToPath(new URL('progressive.en.png',out))});
 await page.locator('#agent-result .file-preview').first().click();
 await page.waitForSelector('.report-preview');
 assert.doesNotMatch(await page.locator('.report-preview').innerText(),/[\u3400-\u9fff]/u);
 assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',out),JSON.stringify({runId:run.id,amount:1150,factRequests:run.factRequests.length,receipts:run.receipts.length,languages:['zh-CN','en'],errors},null,2));
 console.log('Progressive replay, displayed results and English report verified.');
}finally{await browser.close();}
