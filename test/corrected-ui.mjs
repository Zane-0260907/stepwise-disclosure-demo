import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = new URL('../evidence/corrected-showcase/ui/', import.meta.url); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
try {
 const page = await browser.newPage({ baseURL: process.env.DEMO_BASE || 'http://127.0.0.1:4793', viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/', {waitUntil:'networkidle'}); await page.selectOption('#scenario-select','corrected');
 assert.deepEqual(await page.locator('#method-select option').evaluateAll(ns=>ns.map(n=>n.value)),['local_once','requested_cells','full_once','blind_review','conflict_review']);
 await page.locator('.featured-run').filter({hasText:'结构核对 · 本地计算'}).click();
 await page.waitForFunction(()=>document.querySelector('#header-state').textContent==='已完成'&&document.querySelector('#agent-result').textContent.includes('页面逐步展示'),null,{timeout:90000});
 const run=await(await page.request.get('/api/research/runs/8f0c808d-6e8d-46aa-9e92-6c7ac58a8dd9')).json();
 assert.equal(run.status,'completed');assert.equal(run.receipts.length,1);
 const content=JSON.parse(JSON.parse(run.receipts[0].rawBody).messages[1].content);
 assert.deepEqual(content.facts,{});assert.equal(content.tableStructure[1].cells[1],'2016');
 await page.locator('button[data-step-id="step-1"]').click();
 assert.match(await page.locator('#runtime-content').innerText(),/表头/);
 const modelStep=run.steps.find(s=>s.location==='cloud');await page.locator(`button[data-step-id="${modelStep.id}"]`).click();
 await page.locator('#agent-result').scrollIntoViewIfNeeded();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('corrected.zh-CN.png',out))});
 await page.locator('#lang-en').click();
 assert.doesNotMatch(await page.locator('#agent-result').innerText(),/[\u3400-\u9fff]|CNY/u);
 await page.screenshot({path:fileURLToPath(new URL('corrected.en.png',out))});
 await page.locator('#attachment-link').click();await page.waitForSelector('canvas.pdf-page');
 await page.waitForTimeout(1200);assert.equal(await page.locator('canvas.pdf-page').count(),1);
 await page.locator('[data-tab="process"]').click();await page.locator('#lang-zh').click();
 await page.addStyleTag({content:'.user-message {display:none}'});
 await page.locator('#agent-result').scrollIntoViewIfNeeded();
 // Publication annotation layer over the real page; no data or execution state is changed.
 await page.evaluate(()=>{
  for(const [selector,number]of [['#step-list','1'],['.view-columns','2'],['#agent-result','3']]){
   const target=document.querySelector(selector);if(!target)continue;const rect=target.getBoundingClientRect();
   const marker=document.createElement('div');marker.textContent=number;marker.style.cssText=`position:fixed;left:${Math.max(0,rect.left-19)}px;top:${Math.max(85,rect.top+5)}px;width:19px;height:19px;border:1px solid #111;border-radius:50%;background:white;color:#111;display:grid;place-items:center;font:bold 13px Arial;z-index:9999`;document.body.append(marker);
  }
 });
 const left=await page.locator('.conversation-pane').boundingBox();
 await page.screenshot({path:fileURLToPath(new URL('../paper-ui.png',out)),clip:{x:left.x,y:95,width:1600-left.x,height:790}});
 assert.deepEqual(errors,[]);
 await writeFile(new URL('verification.json',out),JSON.stringify({runId:run.id,receipts:1,businessValuesSent:0,headerYear:'2016',languages:['zh','en'],overflow:false,errors},null,2)+'\n');
 console.log('Corrected table replay, source-year roles, bilingual result, layout and stable PDF preview verified.');
} finally {await browser.close();}
