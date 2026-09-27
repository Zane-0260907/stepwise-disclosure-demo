import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=new URL('../evidence/repair-showcase/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try{
 const page=await browser.newPage({baseURL:process.env.DEMO_BASE||'http://127.0.0.1:4793',viewport:{width:1600,height:1000},deviceScaleFactor:1.5});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'networkidle'});await page.selectOption('#scenario-select','repair-limit');
 assert.deepEqual(await page.locator('#method-select option').evaluateAll(x=>x.map(n=>n.value)),['selective_frontier','selective_greedy','full_restart','payload_only']);
 let runId;page.on('response',async response=>{if(response.request().method()==='POST'&&response.url().endsWith('/api/research/runs'))runId=(await response.json()).id;});
 await page.click('#live-button');await page.waitForFunction(()=>document.querySelector('#header-state').textContent==='已完成'&&document.querySelector('#agent-result').textContent.includes('页面逐步展示'),null,{timeout:90000});
 const run=await(await page.request.get('/api/research/runs/'+runId)).json();assert.equal(run.repairEvidence.evaluation.success,true);assert.ok(run.repairEvidence.metrics.repaired>0);assert.ok(run.repairEvidence.metrics.reused>0);assert.equal(run.metrics.modelCalls,0);
 assert.ok(run.steps.every(s=>s.status!=='running'));const rejected=run.steps.find(s=>s.invalidated);assert.ok(rejected);assert.equal(run.receipts.filter(r=>r.stepId===rejected.id).length,0);
 const sent=run.steps.findLast(s=>run.receipts.some(r=>r.stepId===s.id));await page.locator(`button[data-step-id="${sent.id}"]`).click();
 assert.match(await page.locator('#runtime-content').innerText(),/当前后续方案/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#agent-result').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('repair.zh-CN.png',out))});
 await page.click('#lang-en');assert.doesNotMatch(await page.locator('#agent-result').innerText(),/[\u3400-\u9fff]/u);assert.match(await page.locator('#runtime-content').innerText(),/Current continuation/);await page.screenshot({path:fileURLToPath(new URL('repair.en.png',out))});
 await page.click('[data-tab="preview"]');await page.waitForSelector('#runtime-content canvas');assert.equal(await page.locator('#runtime-content canvas').count(),1);await page.waitForTimeout(500);assert.equal(await page.locator('#runtime-content canvas').count(),1);
 for(const scenario of ['repair-capability-lost','repair-recipient-revoked','repair-new-step']){
  const created=await(await page.request.post('/api/research/runs',{data:{caseId:scenario,method:'selective_frontier',mode:'offline',captureFrames:false}})).json();let value;
  for(let i=0;i<60;i++){value=await(await page.request.get('/api/research/runs/'+created.id)).json();if(value.finishedAt)break;await page.waitForTimeout(100);}
  assert.equal(value.repairEvidence?.evaluation.success,true,scenario+':'+value.error);
 }
 await page.click('#lang-zh');await page.click('[data-tab="process"]');
 await page.locator(`button[data-step-id="${sent.id}"]`).click();
 await page.evaluate(()=>{const rows=[...document.querySelectorAll('.task-step')];const marks=[rows.find(x=>x.innerText.includes('执行条件发生变化')),rows.find(x=>x.innerText.includes('旧请求失效')),document.querySelector('.inspector .view-columns')];marks.forEach((n,i)=>{if(!n)return;n.style.position='relative';const badge=document.createElement('span');badge.textContent=String(i+1);badge.style.cssText='position:absolute;right:5px;top:3px;border:1.5px solid #2677ad;border-radius:50%;width:23px;height:23px;text-align:center;background:white;color:#2677ad;font:bold 16px/23px Arial;z-index:5';n.append(badge);});});
 const bounds=await page.locator('.conversation-pane').boundingBox();
 await page.screenshot({path:fileURLToPath(new URL('paper-ui.png',out)),clip:{x:bounds.x,y:140,width:1600-bounds.x,height:730}});
 assert.deepEqual(errors,[]);await writeFile(new URL('ui-verification.json',out),JSON.stringify({runId,executionRecordId:run.executionRecordId,receipts:run.receipts.length,repair:run.repairMetrics,errors,overflow:false,languages:['zh','en']},null,2)+'\n');
 await writeFile(new URL('trace.json',out),JSON.stringify(run,null,2)+'\n');
 await page.selectOption('#method-select','full_restart');
 await page.click('#live-button');await page.waitForFunction(()=>document.querySelector('#header-state').textContent==='已完成'&&document.querySelector('#agent-result').textContent.includes('页面逐步展示'),null,{timeout:90000});
 await page.getByRole('button',{name:'查看同案例对照',exact:true}).click();
 await page.waitForSelector('.comparison-table');const comparison=await page.locator('.comparison-table').innerText();assert.match(comparison,/新增披露/);assert.match(comparison,/复用结果/);assert.doesNotMatch(comparison,/模型调用/);assert.equal(await page.locator('.comparison-table tr').count(),3);
 await page.click('#lang-en');assert.match(await page.locator('.comparison-table').innerText(),/Reused/);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({runId:run.id,errors,receipts:run.receipts.length,comparison:true}));
}finally{await browser.close();}
