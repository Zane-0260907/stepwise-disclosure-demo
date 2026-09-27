import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=new URL('../evidence/model-showcase-v8/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{
 const page=await browser.newPage({baseURL:process.env.DEMO_BASE||'http://127.0.0.1:4793',viewport:{width:1600,height:1000},deviceScaleFactor:1.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'networkidle'});await page.selectOption('#scenario-select','model-capability-withdrawn');await page.selectOption('#method-select','budget_0');assert.equal(await page.locator('#method-select').inputValue(),'budget_0');
 let id;page.on('response',async r=>{if(r.request().method()==='POST'&&r.url().endsWith('/api/research/runs'))id=(await r.json()).id;});
 await page.click('#live-button');await page.waitForFunction(()=>document.querySelector('#header-state').textContent==='已完成'&&document.querySelector('#agent-result').textContent.includes('页面逐步展示'),null,{timeout:90000});
 const run=await(await page.request.get('/api/research/runs/'+id)).json();assert.equal(run.status,'completed',run.error);assert.equal(run.metrics.modelCalls,0);assert.equal(run.savedModelRecord.calls.length,2);assert.equal(run.repairEvidence.metrics.reused,1);assert.equal(run.receipts.length,2);
 const step=run.steps.findLast(s=>s.receipts.length);assert.ok(!('r7c1'in step.retainedValues));assert.equal(step.input.r7c1,1203);await page.locator(`button[data-step-id="${step.id}"]`).click();assert.match(await page.locator('#runtime-content').innerText(),/本阶段后续方案/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.locator('#agent-result').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('model.zh-CN.png',out))});
 await page.click('#lang-en');assert.doesNotMatch(await page.locator('#agent-result').innerText(),/[\u3400-\u9fff]/u);assert.doesNotMatch(await page.locator('#runtime-content').innerText(),/[\u3400-\u9fff]/u);await page.screenshot({path:fileURLToPath(new URL('model.en.png',out))});
 await page.click('[data-tab="preview"]');await page.waitForSelector('#runtime-content canvas');assert.equal(await page.locator('#runtime-content canvas').count(),1);
 await page.click('#lang-zh');await page.click('[data-tab="process"]');await page.locator(`button[data-step-id="${step.id}"]`).click();
 await page.evaluate(()=>{const rows=[...document.querySelectorAll('.task-step')],marks=[rows.find(x=>x.innerText.includes('从模型回复创建')),rows.find(x=>x.innerText.includes('条件改变')),document.querySelector('.inspector .view-columns')];marks.forEach((n,i)=>{if(!n)return;n.style.position='relative';const b=document.createElement('span');b.textContent=String(i+1);b.style.cssText='position:absolute;right:5px;top:3px;border:1.5px solid #2677ad;border-radius:50%;width:23px;height:23px;text-align:center;background:white;color:#2677ad;font:bold 16px/23px Arial;z-index:5';n.append(b);});});
 const bounds=await page.locator('.conversation-pane').boundingBox();await page.screenshot({path:fileURLToPath(new URL('paper-ui.png',out)),clip:{x:bounds.x,y:140,width:1600-bounds.x,height:720}});
 await writeFile(new URL('ui-verification.json',out),JSON.stringify({id,errors,overflow:false,receipts:run.receipts.length,savedModelCalls:2,freshModelCalls:0,languages:['zh','en'],preview:true},null,2)+'\n');
 await writeFile(new URL('trace.json',out),JSON.stringify(run,null,2)+'\n');assert.deepEqual(errors,[]);
 for(const viewport of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(viewport);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 console.log(JSON.stringify({id,errors,receipts:run.receipts.length}));
}finally{await browser.close();}
