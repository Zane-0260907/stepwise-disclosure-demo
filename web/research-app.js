const $=s=>document.querySelector(s);
const D={
 zh:{newRun:'新建运行',scenario:'演示案例',caseTitle:'采购合同风险提示',syntheticCase:'合成输入 · 可核对记录',brand:'氢川科技',taskTitle:'检查采购合同并给出风险提示',sampleDocument:'合成样本 · 本地文件',agentIntro:'我会先在本地读取资料，按当前步骤选择执行位置；需要资料时再发起查询。',composerHint:'自动执行；点击步骤查看细节',computer:'Agent 的电脑',process:'过程',terminal:'终端',files:'文件',preview:'预览',liveRun:'开始执行',joint:'逐步执行与共享判定',full:'完整上下文',ready:'待执行',running:'执行中',completed:'已完成',failed:'未完成',blocked:'已阻止',replay:'真实记录重放',live:'现场运行',before:'查看本次执行过程',beforeText:'开始后，选择左侧步骤，即可查看执行依据、实际发送内容和接收记录。',local:'本地',cloud:'云端模型',tool:'资料查询服务',location:'执行位置',sent:'实际发送',prepared:'准备发送',retained:'留在本地',input:'本地输入',none:'无',result:'任务结果',openReport:'查看完整结果',download:'下载报告',evidence:'下载执行记录',follow:'跟随当前步骤',newStep:'运行时新增',receipt:'独立接收进程已记录',raw:'查看实际请求',recordedNote:'按真实事件顺序回放，展示间隔经过调整；耗时指标来自原始记录。',noKey:'未配置模型密钥；本地案例仍可运行。',runFirst:'先执行一次，才能重放本次记录。',lookupReason:'资料服务只需要编号和版本，不需要整份合同。',observed:'已核对接收摘要',structural:'执行完成；内容正确性需结合任务检查',localCount:'本地步骤',modelCalls:'模型调用',toolCalls:'资料查询',bytes:'发送字节',history:'近期运行',compare:'查看同案例对照',noPair:'先用另一种方法运行同一案例，再比较实际记录。',loadingPdf:'正在打开原始 PDF…',pdfError:'预览加载失败，可打开原文件查看。',openOriginal:'打开原文件',report:'结果报告',source:'输入资料',rawTrace:'原始执行记录',reason:'判定依据',checks:'发送前核验',output:'步骤输出',retainedNote:'以上为本次调用未发送的源字段，不代表此前从未发送。',receivedNote:'本机独立进程记录；资料服务为合成参考库，模型请求原样转发至配置的服务。',success:'完成',method:'方法',state:'状态',business:'业务结论',selectScenario:'运行条件',revoke:'规划后撤权',noOutgoing:'此步骤没有对外发送请求。',enNote:'原始文档及模型回复保留其原文。'},
 en:{newRun:'New run',scenario:'Demo case',caseTitle:'Contract risk review',syntheticCase:'Synthetic input · inspectable records',brand:'Hydrogen Cloud',taskTitle:'Review a purchase contract',sampleDocument:'Synthetic sample · local file',agentIntro:'I will read locally, choose an execution capability for each step, and query references only when needed.',composerHint:'Runs automatically; click a step to inspect',computer:"Agent's computer",process:'Process',terminal:'Trace',files:'Files',preview:'Preview',liveRun:'Run task',joint:'Stepwise execution',full:'Full context',ready:'Ready',running:'Running',completed:'Completed',failed:'Incomplete',blocked:'Blocked',replay:'Recorded live run',live:'Live run',before:'Inspect this execution',beforeText:'Start the task, then select a step to inspect decisions, outbound content, and receiver records.',local:'Local',cloud:'Cloud model',tool:'Reference service',location:'Execution location',sent:'Actually sent',prepared:'Prepared input',retained:'Kept local',input:'Local input',none:'None',result:'Task result',openReport:'View full result',download:'Download report',evidence:'Download trace',follow:'Follow current step',newStep:'Added at runtime',receipt:'Recorded by a separate receiver',raw:'Inspect actual request',recordedNote:'Replays recorded events with adjusted presentation intervals. Metrics use the original run.',noKey:'No model key configured; local cases can still run.',runFirst:'Complete a run before replaying its record.',lookupReason:'The reference service needs only a code and version.',observed:'Receipt digest verified',structural:'Execution completed; task correctness needs separate checks',localCount:'Local steps',modelCalls:'Model calls',toolCalls:'Reference calls',bytes:'Outbound bytes',history:'Recent runs',compare:'Compare this case',noPair:'Run the same case with another method to compare actual records.',loadingPdf:'Opening the original PDF…',pdfError:'Preview failed. Open the original file to view it.',openOriginal:'Open original',report:'Result report',source:'Input document',rawTrace:'Raw execution trace',reason:'Decision basis',checks:'Pre-send checks',output:'Step output',retainedNote:'These source fields were not sent in this call; earlier calls may differ.',receivedNote:'Logged by a local receiver process. The reference service is synthetic; model requests are forwarded unchanged.',success:'Completed',method:'Method',state:'Status',business:'Business finding',selectScenario:'Run condition',revoke:'Revoke after planning',noOutgoing:'No external request was sent in this step.',enNote:'Original documents and model responses retain their original language.'},
};
const S={lang:localStorage.getItem('demo-lang')==='en'?'en':'zh',bootstrap:null,scenario:'dynamic',caseId:'contract-21',mode:'offline',run:null,tab:'process',selected:null,follow:true,preview:'source',source:null,error:'',lastLive:localStorage.getItem('research-last-live')||null,history:[],pairs:[],showCompare:false,presentation:null};
const t=k=>D[S.lang][k]||k;
const isAccountArrears=message=>/MODEL_HTTP_400:/.test(message||'')&&/"type":"Arrearage"/.test(message);
function readableError(message){
 if(isAccountArrears(message))return S.lang==='zh'?'阿里云百炼账户欠费，云端模型暂时无法调用。请处理账户账单后再试；现在可以运行本地案例，或重放已保存的真实记录。':'The Alibaba Cloud Model Studio account is in arrears, so the cloud model cannot be called. Resolve the account billing issue, then retry. Local cases and saved run replay remain available.';
 return message;
}
const l=v=>v&&typeof v==='object'?(v[S.lang]||v.zh||JSON.stringify(v)):String(v??'');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS(n.namespaceURI,'use');u.setAttribute('href',`#i-${name}`);n.append(u);return n;}
const caseItem=()=>S.bootstrap?.cases.find(c=>c.id===(S.run?.caseId||S.caseId));
const methodName=m=>l(S.bootstrap?.methods[m]||m);
const factName=k=>({question:S.lang==='zh'?'当前问题':'Question',schema:S.lang==='zh'?'表结构（不含单元格数值）':'Table schema (without cell values)'})[k]||S.bootstrap?.labels[k]?.[S.lang==='zh'?0:1]||k;
const value=v=>S.lang==='en'&&typeof v==='string'&&S.bootstrap?.presentationTranslations?.values?.[v]?S.bootstrap.presentationTranslations.values[v]:typeof v==='object'?JSON.stringify(v):String(v??'');
const time=d=>d?new Date(d).toLocaleTimeString(S.lang==='zh'?'zh-CN':'en-GB',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
const active=run=>['queued','running'].includes(run?.status)||(run?.status==='completed'&&!run.finishedAt);
const locationName=step=>S.run?.family==='repair'&&step.location==='tool'?(S.lang==='zh'?'外部算子 · '+step.recipient:'Remote operator · '+step.recipient):S.run?.executionMode==='offline'&&step.location==='cloud'?(S.lang==='zh'?'本机规则执行器':'Local rule driver'):t(step.location);
const stepReason=step=>S.run?.executionMode==='offline'&&step.location==='cloud'?(S.lang==='zh'?'当前步骤超出本地计算规则，由本机规则执行器处理；发送前仍核验共享视图。':'The offline driver handles this step after checking the shared view.'):l(step.reason);
const stepTitle=step=>S.run?.executionMode==='offline'&&step.operation==='lookup_reference'?(S.lang==='zh'?'规则触发版本资料查询':'Rule-triggered reference lookup'):l(step.title);
const displayedReason=step=>S.run?.executionMode==='offline'&&step.operation==='lookup_reference'?(S.lang==='zh'?'本机规则执行器提出资料请求；接收进程按编号和版本查询。':'The local rule driver requested a versioned reference through the receiver.'):stepReason(step);
const callName=()=>S.run?.executionMode==='offline'?(S.lang==='zh'?'执行器调用':'Driver calls'):t('modelCalls');
const EN_ISSUES={
 NO_ISSUE:['No issue was identified under the configured checks for this synthetic case.','Retain the source clause and review it if the business context changes.'],
 PENALTY_APPLIES:['The stated formula and input values allow a penalty to be calculated.','Review the calculation against the signed contract before using it.'],
 UNDEFINED_TRIGGER:['The clause does not define a sufficiently clear trigger for liquidated damages.','Define the relevant obligation and the point at which delay begins.'],
 UNDEFINED_OBLIGATION:['The clause does not identify which obligation counts as performance.','Specify whether performance refers to delivery, acceptance, or payment.'],
 MISSING_RATE:['The clause does not state the applicable penalty rate.','Add an explicit rate before calculating an amount.'],
 MISSING_BASE:['The clause does not define the amount on which the penalty is calculated.','Specify the calculation base.'],
 MISSING_CAP:['The clause does not define a cumulative cap.','Specify the maximum cumulative penalty.'],
 MISSING_START:['The clause does not define when delay begins.','Specify the start date for the calculation.'],
 AMBIGUOUS_ACCEPTANCE:['The acceptance standard or responsible party is unclear.','Define the acceptance criteria and responsible party.'],
 CONFLICTING_TERMS:['The contract and its attachments contain inconsistent terms.','Specify which document takes precedence.'],
 MISSING_DEADLINE:['The delivery deadline is not explicit.','State the delivery date.'],
 SUPPORT_NEEDED:['The configured study rule indicates that support is needed.','Review the underlying observations before planning support.'],
 ON_TRACK:['The configured study rule does not flag a support need.','Continue monitoring the recorded indicators.'],
 PRACTICE_GAP:['The study record points to a practice gap.','Review recent exercises and follow-up work.'],
 ATTENDANCE_GAP:['The study record points to an attendance gap.','Review missed sessions and arrange follow-up support.'],
 WORKLOAD_HIGH:['The study record points to a high workload.','Review task load and scheduling.'],
 CONCEPT_GAP:['The study record points to a concept gap.','Identify the concepts that require review.'],
 CONSISTENCY_GAP:['The study record points to inconsistent performance.','Compare recent observations before selecting an intervention.'],
};
function englishFinding(run){
 const id=run?.recordedRunId||run?.id;const translated=S.bootstrap?.presentationTranslations?.runs?.[id];if(translated)return translated;
 const issue=run?.result?.issueCodes?.[0];const [base,recommendation]=EN_ISSUES[issue]||['The structured result requires further review.','Review the original evidence before acting.'];
 const amount=run?.result?.amount;return {summary:amount===null||amount===undefined?base:base+' Calculated amount: CNY '+amount.toLocaleString('en-US')+'.',recommendation};
}
const resultSummary=run=>run?.family==='repair'?l(run.result?.summary):run?.family==='finance'?(S.lang==='zh'?'计算结果：':'Computed result: ')+Number(run.result.amount.toPrecision(8)):S.lang==='zh'?run?.result?.summary||'':englishFinding(run).summary;
const resultRecommendation=run=>run?.family==='repair'?l(run.result?.recommendation):run?.family==='finance'?(S.lang==='zh'?'本地按模型提出的表达式计算；公式正确性由实验标签单独检验。':'Computed locally from the proposed expression; correctness is checked separately against benchmark labels.'):S.lang==='zh'?run?.result?.recommendation||'':englishFinding(run).recommendation;
function englishReport(run){
 if(['finance','repair'].includes(run.family))return run.report;
 const result=run.result||{};const identity=value(run.input?.identity||'synthetic parties').replace(/合成采购方(\d+)/g,'Synthetic buyer $1').replace(/合成供应方(\d+)/g,'Synthetic supplier $1');
 return ['# Contract risk review (synthetic case)','',`Parties: ${identity}`,`Run: ${run.id}`,'','## Finding',englishFinding(run).summary,'',`Issue code: ${(result.issueCodes||[]).join(', ')}`,result.amount===null||result.amount===undefined?'':`Calculated amount: CNY ${result.amount.toLocaleString('en-US')}`,'','## Recommendation',englishFinding(run).recommendation,'','## Evidence',...(result.evidenceIds||[]).map(key=>'- '+key),...(result.citations||[]).map(citation=>'- '+citation),'','## Execution record',`Local steps: ${(run.steps||[]).filter(step=>step.location==='local').length}; ${run.executionMode==='offline'?'local driver':'model'} calls: ${run.metrics?.modelCalls||0}; reference lookups: ${run.metrics?.toolCalls||0}.`,'This English presentation is derived from the saved structured result. The original model response and request bodies remain in the trace.',''].filter(line=>line!==undefined).join('\n');
}
function syncMethods(){
 const finance=caseItem()?.family==='finance',repair=caseItem()?.family==='repair';
 const list=caseItem()?.variant==='model-v8'?['live_budget_0','budget_0','repair_greedy','live_frontier','repair_frontier','restart_greedy']:repair?['selective_frontier','selective_greedy','full_restart','payload_only']:S.caseId==='finqa-47593c3344df'?['local_once','requested_cells','full_once','blind_review','conflict_review']:finance?['local_program','requested_cells','eager_allowed']:['joint','allowed_eager','numeric_prefetch','full'];
 const select=$('#method-select');if([...select.options].map(o=>o.value).join()!==list.join()){const previous=select.value;select.replaceChildren(...list.map(id=>{const o=el('option','',methodName(id));o.value=id;return o;}));select.value=list.includes(previous)?previous:list[0];}
 $('.input-adjust').hidden=finance||repair;
}
function applyText(){
 syncMethods();
 document.documentElement.lang=S.lang==='zh'?'zh-CN':'en';
 document.querySelectorAll('[data-i18n]').forEach(n=>{if(D[S.lang][n.dataset.i18n])n.textContent=t(n.dataset.i18n);});
 $('#lang-zh').classList.toggle('is-active',S.lang==='zh');$('#lang-en').classList.toggle('is-active',S.lang==='en');
 const c=caseItem();if(c?.family==='repair'){$('[data-i18n="caseTitle"]').textContent=S.lang==='zh'?'动态执行与信息共享':'Dynamic execution and disclosure';$('[data-i18n="agentIntro"]').textContent=S.lang==='zh'?'我会执行当前步骤，在条件变化后保留有效计算，并重新选择后续的执行位置和发送内容。':'I will execute the current steps, retain valid calculations after changes, and reconsider the remaining locations and inputs.';$('[data-i18n="sampleDocument"]').textContent=S.lang==='zh'?'合成业务输入 · 登记算子':'Synthetic input · registered operators';}if(c?.family==='finance'){$('[data-i18n="caseTitle"]').textContent=S.lang==='zh'?'公开财务表格计算':'Public table calculation';$('[data-i18n="agentIntro"]').textContent=S.lang==='zh'?'我会先读取表结构，让模型提出计算，再在本地核验并执行。':'I will read the schema, ask for a calculation, then validate and execute it locally.';$('[data-i18n="syntheticCase"]').textContent=S.lang==='zh'?'FinQA 公开数据 · 可核对记录':'Public FinQA data · inspectable records';$('[data-i18n="sampleDocument"]').textContent=S.lang==='zh'?'公开表格 · 阅读预览':'Public table · reading preview';}
 $('.conversation-header h1').textContent=c?l(c.title):t('taskTitle');
 $('[data-i18n="taskPrompt"]').textContent=l(S.run?.task||c?.task||'');
 $('#attachment-link strong').textContent=c?.source||'contract-21.pdf';
 $('#scenario-label').textContent=t('selectScenario');
 $('#mode-label').textContent=S.lang==='zh'?'执行方式':'Execution mode';
 $('#execution-mode').options[0].textContent=S.lang==='zh'?'本机规则执行器 · 无需密钥':'Local rule driver · no key';
 $('#execution-mode').options[1].textContent=S.lang==='zh'?'DeepSeek · 自备密钥':'DeepSeek · bring your key';
 $('#input-adjust-label').textContent=S.lang==='zh'?'调整合成输入':'Adjust synthetic inputs';
 $('#amount-label').textContent=S.lang==='zh'?'合同金额':'Contract amount';$('#days-label').textContent=S.lang==='zh'?'迟延天数':'Days late';
 $('#input-adjust-note').textContent=S.lang==='zh'?'填写的值覆盖本次运行输入；原始 PDF 保持不变。':'Values override this run only; the original PDF is unchanged.';
 $('#amount-override').placeholder=S.lang==='zh'?'保持 PDF 数值':'Keep PDF value';$('#days-override').placeholder=$('#amount-override').placeholder;
 for(const option of $('#scenario-select').options)option.textContent=l(S.bootstrap?.scenarios.find(x=>x.id===option.value)?.title||option.value);
 for(const option of $('#method-select').options)option.textContent=methodName(option.value);
 $('#method-select').title=methodName($('#method-select').value);
 $('#follow-button').textContent=t('follow');$('#follow-button').hidden=S.follow;
 $('#history-label').textContent=t('history');
 $('#featured-label').textContent=S.lang==='zh'?'真实模型记录':'Recorded model runs';
 const status=S.starting||S.run?.status==='completed'&&!S.run?.finishedAt?'running':S.run?.status||'ready';const statusText=status==='queued'?(S.lang==='zh'?'等待启动':'Queued'):t(status);$('#header-state').textContent=statusText;$('#run-state').textContent=statusText;$('#run-state').classList.toggle('is-failed',['failed','blocked'].includes(status));
 const badge=$('#source-badge');badge.hidden=!S.run;badge.textContent=S.run?`${t(S.run.source==='recorded'?'replay':'live')}${S.run.metrics?.modelCalls?` · ${S.run.model||'—'}`:''}`:'';
 const unavailable=(S.mode==='deepseek'&&!S.bootstrap?.deepseekAvailable)||(S.bootstrap?.scenarios.find(s=>s.id===S.scenario)?.requiresLive&&S.mode!=='deepseek');
 $('#live-button').disabled=active(S.run)||S.starting||unavailable;$('#live-button').title=unavailable?(S.lang==='zh'?'需在启动前配置 DEEPSEEK_API_KEY':'Set DEEPSEEK_API_KEY before starting'):'';
 $('#scenario-select').disabled=active(S.run);$('#method-select').disabled=active(S.run);$('#execution-mode').disabled=active(S.run)||c?.family==='repair';
 $('#replay-button').disabled=!S.lastLive||active(S.run);$('#replay-button').title=t('replay');$('#replay-button').setAttribute('aria-label',t('replay'));
 const note=$('#execution-note');note.textContent=S.run?.source==='recorded'?t('recordedNote'):S.run?.executionMode==='offline'?(S.lang==='zh'?'本次为新执行：本机规则执行器处理分析请求；独立接收进程记录实际请求。它不能证明 DeepSeek 的判断质量。':'Fresh run: a local rule driver handles analysis; a separate receiver records actual requests. This does not evaluate DeepSeek quality.'):S.run?.executionMode==='deepseek'?(S.lang==='zh'?'本次为 DeepSeek 现场调用；请自行配置密钥，密钥不会写入记录。':'Live DeepSeek call with your own key; the key is not recorded.'):(S.lang==='zh'?'选择案例后点击开始；可调整合成输入观察结果变化。':'Choose a case and run it; adjust synthetic inputs to inspect changes.');
 if(c?.family==='repair'){note.textContent=S.lang==='zh'?'本次使用登记算子和独立 HTTP 接收进程，实际执行并保存记录；状态变化为受控测试事件，不调用语言模型。':'Registered operators and a separate HTTP receiver execute and save fresh records. State changes are controlled test events; no language model is called.';$('#execution-mode').options[0].textContent=S.lang==='zh'?'登记算子 · 真实 HTTP 执行':'Registered operators · real HTTP execution';}
 if(c?.variant==='model-v8'){note.textContent=S.lang==='zh'?'重用已公开的真实 DeepSeek 计划；计算与 HTTP 请求在本次重新执行。变化是受控事件，新模型调用请使用仓库命令。':'Reuse a published real DeepSeek plan; computations and HTTP requests execute again. Changes are controlled. Use the repository command for new model calls.';$('#execution-mode').options[0].textContent=S.lang==='zh'?'保存的模型计划 · 重新执行':'Saved model plan · fresh execution';$('[data-i18n="sampleDocument"]').textContent=S.lang==='zh'?'公开财务表格 · 阅读预览':'Public financial table · reading preview';$('[data-i18n="syntheticCase"]').textContent=S.lang==='zh'?'FinQA 公开数据 · 真实模型计划':'Public FinQA data · real model plan';}
 if(S.presentation?.queued>0)note.textContent+=S.lang==='zh'?' 已执行事件按原始顺序放慢展示，尚有 '+S.presentation.queued+' 帧；这不是执行耗时。':' '+S.presentation.queued+' recorded event frames remain in the paced view; this is not execution time.';
 if(S.run?.startedAt&&S.run?.finishedAt)note.textContent+=S.lang==='zh'?' 实际运行耗时 '+(new Date(S.run.finishedAt)-new Date(S.run.startedAt))+' 毫秒；核心执行 '+S.run.metrics.elapsedMs.toFixed(1)+' 毫秒。':' Actual runtime '+(new Date(S.run.finishedAt)-new Date(S.run.startedAt))+' ms; execution core '+S.run.metrics.elapsedMs.toFixed(1)+' ms.';
 if(Object.keys(S.run?.overrides||{}).length)note.textContent+=S.lang==='zh'?' 本次输入已覆盖 PDF 中的对应数值，原文件未改。':' This run overrides values from the PDF; the source file is unchanged.';
 $('#request-time').textContent=time(S.run?.createdAt);$('#agent-time').textContent=time(S.run?.createdAt);
 document.title=`Agent · ${c?l(c.title):t('taskTitle')}`;
}
function selectedStep(){
 const steps=S.run?.steps||[];
 if(!steps.length)return null;
 if(!S.follow)return steps.find(s=>s.id===S.selected)||steps.at(-1);
 if(S.run.status==='completed')return [...steps].reverse().find(s=>s.location!=='local')||steps.at(-1);
 return steps.at(-1);
}
function renderSteps(){
 const list=$('#step-list');list.replaceChildren();const selected=selectedStep();
 for(const step of S.run?.steps||[]){
   const row=el('button',`task-step is-${step.invalidated?'superseded':step.status}${selected?.id===step.id?' is-selected':''}`);row.type='button';row.dataset.stepId=step.id;row.setAttribute('aria-pressed',String(selected?.id===step.id));
   const dot=el('span','step-line-icon');dot.append(icon(step.invalidated?'file':step.status==='completed'?'check':step.status==='running'?'clock':'file'));
   const glyph=el('span','step-glyph');glyph.append(icon(step.location==='cloud'?(S.run?.executionMode==='offline'?'monitor':'cloud'):step.location==='tool'?'list':'file'));
   const copy=el('span','step-copy');const title=el('span','step-title');title.append(el('strong','',stepTitle(step)));if(step.introducedAtRuntime)title.append(el('span','runtime-added',t('newStep')));if(step.invalidated)title.append(el('span','technical-note',S.lang==='zh'?'已失效 · 未发送':'Invalidated · not sent'));
   copy.append(title,el('small','',`${locationName(step)} · ${displayedReason(step)}`));row.append(dot,glyph,copy,el('span','step-time',time(step.finishedAt||step.startedAt)));
   row.onclick=()=>{S.selected=step.id;S.follow=false;S.tab='process';render();};list.append(row);
 }
 if(!S.run)list.append(el('p','technical-note',t('beforeText')));
 const box=$('#agent-result');box.replaceChildren();box.hidden=!S.run?.result&&!S.run?.error&&!S.error;
 if(S.run?.result){
   box.append(el('h3','',t('result')),el('p','',resultSummary(S.run)),el('p','',resultRecommendation(S.run)));
   const stats=el('div','run-summary');
   (S.run.family==='repair'?[[S.lang==='zh'?'新增披露':'New disclosures',S.run.repairMetrics.newDisclosures],[S.lang==='zh'?'复用计算':'Reused results',S.run.repairMetrics.reused],[S.lang==='zh'?'外部调用':'Remote calls',S.run.metrics.toolCalls],[t('bytes'),S.run.metrics.totalBytes]]:[[t('localCount'),S.run.steps.filter(s=>s.location==='local'&&s.status==='completed').length],[callName(),S.run.metrics.modelCalls],[t('toolCalls'),S.run.metrics.toolCalls],[t('bytes'),S.run.metrics.totalBytes]]).forEach(([k,v])=>{const c=el('span');c.append(el('strong','',v),el('small','',k));stats.append(c);});box.append(stats);
   if(S.run.startedAt&&S.run.finishedAt){const actual=new Date(S.run.finishedAt)-new Date(S.run.startedAt);const shown=S.presentation?.viewMs;box.append(el('small','technical-note',S.lang==='zh'?'实际运行 '+actual+' 毫秒；页面逐步展示 '+(shown===undefined?'—':shown)+' 毫秒，展示时间不计入实验耗时。':'Actual runtime '+actual+' ms; paced view '+(shown===undefined?'—':shown)+' ms. View time is excluded from experiment timing.'));}
   box.append(el('small','technical-note',t('structural')));
   const actions=el('div','result-actions');const preview=el('button','file-preview',t('openReport'));preview.onclick=()=>{S.preview='report';S.tab='preview';render();};
   const link=el('a','file-download',t('download'));link.href=S.lang==='en'?'data:text/markdown;charset=utf-8,'+encodeURIComponent(englishReport(S.run)):`/api/research/runs/${S.run.id}/report`;link.download=S.lang==='en'?'result-en.md':'result.md';actions.append(preview,link);
   const comparison=el('button','file-preview',t('compare'));comparison.onclick=()=>showComparison();actions.append(comparison);box.append(actions);
   if(S.showCompare)renderComparison(box);
 }
 if(S.error||S.run?.error){const message=S.error||S.run.error;box.append(el('div','agent-error',readableError(message)));if(isAccountArrears(message)&&S.bootstrap?.sampleRunId){const replay=el('button','file-preview',S.lang==='zh'?'重放成功记录':'Replay a completed run');replay.onclick=()=>{S.lastLive=S.bootstrap.sampleRunId;start(true);};box.append(replay);}}
}
function factsCard(title,facts,local=false){
 const card=el('section',`view-card${local?' local':''}`);const h=el('h3');h.append(icon(local?'lock':'cloud'),el('span','',title));card.append(h);
 const entries=Object.entries(facts||{}),needed=new Set(S.run?.programCertificates?.at(-1)?.dependencies.map(d=>d.field)||[]);
 if(local&&S.run?.family==='finance')entries.sort(([a],[b])=>Number(needed.has(b))-Number(needed.has(a)));
 const compact=local&&entries.length>8&&entries.every(([key])=>/^r\d+c\d+$/.test(key));
 const list=el('ul');for(const[k,v]of(compact?entries.slice(0,4):entries)){
 if(k==='schema'&&Array.isArray(v)){
  const item=el('li'),details=el('details','schema-details');details.append(el('summary','',S.lang==='zh'?`表结构：${v.length} 个单元格（查看标签）`:`Schema: ${v.length} cells (inspect labels)`));
  for(const cell of v)details.append(el('p','',`${cell.id} · ${cell.row} · ${cell.column}`));item.append(details);list.append(item);
 }else if(k==='tableStructure'&&Array.isArray(v)){
  const item=el('li'),details=el('details','schema-details');
  const heads=v.filter(row=>row.role==='header');details.append(el('summary','',S.lang==='zh'?`原始表头与位置：${heads.length} 行`:`Source headers and positions: ${heads.length} rows`));
  for(const row of heads)details.append(el('p','',row.cells.join(' | ')));item.append(details);list.append(item);
 }else list.append(el('li','',`${factName(k)}：${value(v)}`));
}if(!list.children.length)list.append(el('li','',t('none')));card.append(list);
 if(compact){const details=el('details','schema-details');details.append(el('summary','',S.lang==='zh'?`共 ${entries.length} 个数值，展开其余 ${entries.length-4} 个`:`${entries.length} values; inspect ${entries.length-4} more`));for(const[k,v]of entries.slice(4))details.append(el('p','',`${k}: ${value(v)}`));card.append(details);}
 return card;
}
function outputText(output){if(!output)return '';
 if(output.requestedTool&&S.run?.family==='finance'){
  const call=output.requestedTool.function;
  if(call?.name==='submit_calculation'){
   try{const program=JSON.parse(call.arguments).program,terms=[];for(const node of program){const args=node.args.map(a=>a.field??a.constant??terms[a.step]);const op={add:'+',subtract:'−',multiply:'×',divide:'÷'}[node.op];terms.push(op?`(${args[0]} ${op} ${args[1]})`:`${node.op}(${args.join(', ')})`);}return(S.lang==='zh'?'模型提出的本地算式：':'Proposed local expression: ')+terms.at(-1);}catch{}
  }
  return S.lang==='zh'?'模型申请所需数值单元格，等待本地授权核验。':'The model requested numeric cells, subject to local authorization.';
 }
 if(output.headerRows)return S.lang==='zh'?`已核对 ${output.headerRows.length} 行表头和 ${output.businessCells} 个业务数值单元格。年份与单位保留在表结构中；数值仍在本地。`:`Verified ${output.headerRows.length} header rows and ${output.businessCells} business cells. Years and units remain in the schema; values remain local.`;
 if(output.validCandidates!==undefined)return S.lang==='zh'?`${output.validCandidates} 个有效方案，${output.distinctPrograms} 种计算结构。${output.agreed?'结构一致，在本地计算。':'存在分歧，继续复核。'}本次补充字段：${output.fields.join(', ')||'无'}。方案一致不代表答案正确。`:`${output.validCandidates} valid proposals; ${output.distinctPrograms} distinct expressions. ${output.agreed?'Structural agreement; calculate locally.':'Disagreement; continue to review.'} Additional fields: ${output.fields.join(', ')||'none'}. Agreement does not establish correctness.`;
 if(output.proposedTool)return S.lang==='zh'?'模型提出了一个受限算式；本地核验字段依赖和计算结构。':'The model proposed a finite expression; dependencies and structure are checked locally.';
if(typeof output==='string')return output;if(S.lang==='en'){
 if(output.issueCodes||output.fileName)return resultSummary(S.run);
 if(output.requestedTool&&S.run?.family==='finance')return output.requestedTool.function?.name==='submit_calculation'?'The model proposed a finite calculation to execute locally.':'The model requested selected numeric cells.';
 if(output.requestedTool)return output.requestedTool.function?.name==='request_task_facts'?'The model requested missing business facts from the local controller.':'The model requested the specified version of the reference.';
 if(output.approvedFields)return 'Locally authorized fields: '+output.approvedFields.join(', ');
 if(output.text&&S.run?.caseId==='contract-21')return S.bootstrap?.presentationTranslations?.referenceC01||'The versioned reference was retrieved.';
 }if(output.summary)return l(output.summary);if(output.text)return output.text;return JSON.stringify(output,null,2);}
function processPane(){
 const root=el('div','inspector');const step=selectedStep();
 if(!step){const empty=el('div','empty-pane');empty.append(icon('monitor'),el('strong','',t('before')),el('p','',t('beforeText')));root.append(empty);return root;}
 const header=el('div','inspector-heading');header.append(icon('file'));const heading=el('div');heading.append(el('h2','',stepTitle(step)),el('p','',`${time(step.startedAt)} · ${t(step.status)}`));header.append(heading);root.append(header);
 const location=el('div','decision-line');location.append(el('strong','',t('location')),el('span','decision-value',locationName(step)));root.append(location,el('p','decision-reason',displayedReason(step)));
 if(S.run.awaitingDecision?.stepId===step.id){const panel=el('div','decision-prompt');panel.append(el('strong','',S.lang==='zh'?'发送前授权核验':'Authorization check before sending'));const actions=el('div','result-actions');for(const [action,zh,en] of [['allow','允许发送','Allow send'],['revoke','撤销授权','Revoke access']]){const button=el('button','file-preview',S.lang==='zh'?zh:en);button.onclick=async()=>{button.disabled=true;try{await api('/runs/'+S.run.id+'/decision',{action});}catch(error){S.error=error.message;render();}};actions.append(button);}panel.append(actions);root.append(panel);}
 const receipts=(S.run.receipts||[]).filter(r=>r.stepId===step.id);
 if(step.modelPlan){const panel=el('section','view-card'),p=step.modelPlan;panel.append(el('h3','',S.lang==='zh'?'本阶段后续方案':'Continuation for this phase'),el('p','',S.lang==='zh'?`当前预计新增 ${p.newDisclosures.length} 项；剩余数值字段预算 ${p.budget??'不限'}。`:`Planned new units: ${p.newDisclosures.length}; remaining numeric-field budget: ${p.budget??'unbounded'}.`));const names={local:['本地','Local'],source:['原始字段','Source fields'],operands:['中间值或操作数','Intermediate values or operands']};panel.append(el('p','',p.path.map(x=>names[x][S.lang==='zh'?0:1]).join(' → ')));if(p.peak!==undefined)panel.append(el('small','technical-note',S.lang==='zh'?`规划峰值 ${p.peak} 个状态；跨步骤保留 ${p.width} 类项目。完整发送历史仍保留。`:`Peak planning states: ${p.peak}; boundary items: ${p.width}. Full disclosure history is retained.`));root.append(panel);}
 if(S.run.variant==='model-v8'&&step.id==='model-schema'){const details=el('details','request-details');details.append(el('summary','',S.lang==='zh'?'查看保存的真实模型响应':'Inspect the saved real model response'),el('pre','',JSON.stringify(S.run.savedModelRecord.calls.map(c=>JSON.parse(c.responseBody)),null,2)));root.append(details);}
 if(step.repairPlan){const panel=el('section','view-card');panel.append(el('h3','',S.lang==='zh'?'当前后续方案':'Current continuation'));panel.append(el('p','',S.lang==='zh'?`此前已披露 ${step.repairPlan.history} 项；当前方案预计新增 ${step.repairPlan.newDisclosure} 项。`:`Previously disclosed: ${step.repairPlan.history}; planned additional units: ${step.repairPlan.newDisclosure}.`));const names={quote:['核算','Calculate'],cap:['上限','Apply cap'],flag:['检查','Check'],record:['汇总','Summarize']};panel.append(el('p','',step.repairPlan.path.map(id=>{const[o,k]=id.split(':');return names[o][S.lang==='zh'?0:1]+' · '+(k==='local'?(S.lang==='zh'?'本地':'Local'):k==='raw'?'A':'B');}).join(' → ')));if(step.invalidated)panel.append(el('strong','',S.lang==='zh'?'此计划已失效，没有发送。':'This plan was invalidated and not sent.'));root.append(panel);}
 if(receipts.length){const summary=el('div','receipt-line'),label=S.run.variant==='model-v8'?(S.lang==='zh'?'HTTP 接收端已记录':'Recorded by the HTTP receiver'):t('receipt');summary.append(el('strong','',`${label} · ${receipts.reduce((sum,r)=>sum+r.bytes,0)} bytes`),el('small','',` · ${time(receipts.at(-1).receivedAt)}`));root.append(summary);}
 let visibleInput=step.input;
 if(S.run.family==='finance'&&step.location==='cloud'&&receipts.length){const body=JSON.parse(JSON.parse(receipts.at(-1).rawBody).messages[1].content);visibleInput={question:body.task,schema:body.schema,...(body.tableStructure?{tableStructure:body.tableStructure}:{}),...body.facts};}
 if(Object.keys(visibleInput||{}).length){
   const columns=el('div',step.location==='local'?'local-input':'view-columns');
   const inputTitle=step.location==='local'?t('input'):S.run.executionMode==='offline'&&step.location==='cloud'?(receipts.length?(S.lang==='zh'?'发给本机执行器':'Sent to local driver'):(S.lang==='zh'?'拟交给本机执行器':'Prepared for local driver')):receipts.length?t('sent'):t('prepared');
   columns.append(factsCard(inputTitle,visibleInput));
   if(step.location!=='local'){
     const kept=step.retainedValues||Object.fromEntries((step.retained||[]).map(k=>[k,S.run.input[k]??'—']));columns.append(factsCard(t('retained'),kept,true));
   }
   root.append(columns);if(step.location!=='local')root.append(el('small','technical-note',t('retainedNote')));
 }
 for(const receipt of receipts){
   const line=el('div','receipt-line');line.append(el('code','',`SHA-256 ${receipt.sha256}`),el('small','',`${time(receipt.receivedAt)} · PID ${receipt.processId||'—'}`));
   const details=el('details','request-details');details.dataset.detailId=receipt.id;details.append(el('summary','',t('raw')),line,el('pre','',JSON.stringify(JSON.parse(receipt.rawBody),null,2)));root.append(details);
 }
 if(receipts.length)root.append(el('small','technical-note',S.run.variant==='model-v8'?(S.lang==='zh'?'实际回环 HTTP 请求；接收端与控制器运行在同一 Node 进程内。模型原始调用另存。':'Actual loopback HTTP; receiver and controller share a Node process. Original model calls are stored separately.'):S.run.family==='repair'?(S.lang==='zh'?'独立接收进程实际执行登记算子；本轮不调用云端语言模型。':'A separate receiver executes the registered operator; no cloud language model is called.'):S.run.executionMode==='offline'?(S.lang==='zh'?'本机独立接收进程记录 HTTP 请求；分析请求送往本机规则执行器，资料查询使用合成参考库。':'A separate local receiver recorded HTTP requests. Analysis used the local rule driver; lookups used the synthetic reference library.'):t('receivedNote')));
 if(step.location==='local')root.append(el('small','technical-note',t('noOutgoing')));
 if(step.error)root.append(el('div','agent-error',readableError(step.error)));
 if(step.output){const out=el('section','cloud-result');const text=S.run.executionMode==='offline'&&step.output.requestedTool?(S.lang==='zh'?'本机规则执行器请求查询指定版本资料。':'The local rule driver requested the versioned reference.'):outputText(step.output);out.append(el('h3','',t('output')),el('p','',text));root.append(out);}
 if(step.requestPlan){root.append(el('small','technical-note',S.lang==='zh'?(step.requestPlan.receiptVerified?'发送内容与核准请求一致；接收摘要已核对。':'请求已绑定当前字段与授权版本，等待发送核验。'):(step.requestPlan.receiptVerified?'Sent content matches the approved request; receiver digest verified.':'Request bound to the selected fields and policy version; awaiting send check.')));}
 const audit=el('details','request-details');audit.dataset.detailId='checks';audit.append(el('summary','',t('checks')),el('pre','',JSON.stringify({source:step.source,required:step.required,candidates:step.candidates,policyVersion:step.plannedPolicyVersion,checks:step.checks,requestPlan:step.requestPlan,trigger:step.trigger},null,2)));root.append(audit);
 const download=el('a','evidence-link',t('evidence'));download.href=`/api/research/runs/${S.run.id}/evidence`;download.download='run-evidence.json';root.append(download);
 return root;
}
function tracePane(){const box=el('div','raw-panel');box.append(el('header','',t('rawTrace')),el('pre','',JSON.stringify({runId:S.run?.id,source:S.run?.source,events:S.run?.events||[],receipts:S.run?.receipts||[]},null,2)));return box;}
function filesPane(){const root=el('div','file-list');for(const[k,name]of [['source',caseItem()?.source],...(S.run?.report?[['report',t('report')]]:[])]){const button=el('button','file-row');button.append(icon('file'),el('strong','',name||t(k)));button.onclick=()=>{S.preview=k;S.tab='preview';render();};root.append(button);}return root;}
const documents=new Map();
async function populatePdf(root,id){
 try{
   if(!documents.has(id))documents.set(id,import('/vendor/pdfjs/build/pdf.min.mjs').then(pdfjs=>{pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/build/pdf.worker.min.mjs';return pdfjs.getDocument({url:`/api/research/documents/${id}.pdf`,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'}).promise;}));
   const pdf=await documents.get(id);const fragment=document.createDocumentFragment();
   for(let i=1;i<=pdf.numPages;i++){
     const page=await pdf.getPage(i),base=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.max(240,(root.clientWidth||600)-24)/base.width*Math.min(devicePixelRatio||1,2)});
     const canvas=el('canvas','pdf-page');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('role','img');
     await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;const text=await page.getTextContent();canvas.setAttribute('aria-label',text.items.map(i=>i.str).join(' '));fragment.append(canvas);
   }
   root.querySelector('.pdf-pages').replaceChildren(fragment);root.dataset.status='ready';
 }catch(error){documents.delete(id);root.dataset.status='error';root.querySelector('.pdf-pages').replaceChildren(el('p','pdf-status',t('pdfError')));console.error(error);}
}
function previewPane(){
 if(S.preview==='report'&&S.run?.report)return el('div','report-preview',S.lang==='en'?englishReport(S.run):S.run.report);
 const id=S.run?.caseId||S.caseId;const root=el('section','pdf-preview');root.dataset.status='loading';const header=el('header');header.append(el('strong','',`${id}.pdf`));const link=el('a','',t('openOriginal'));link.href=`/api/research/documents/${id}.pdf`;link.target='_blank';link.rel='noopener';link.dataset.i18n='openOriginal';header.append(link);const pages=el('div','pdf-pages');pages.append(el('p','pdf-status',t('loadingPdf')));root.append(header,pages);populatePdf(root,id);return root;
}
function renderRuntime(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===S.tab));const content=$('#runtime-content');
 const selected=selectedStep();
 const key=S.tab==='preview'?`preview:${S.preview}:${S.run?.caseId||S.caseId}:${S.preview==='report'?S.lang+':'+S.run?.report:''}`:S.tab==='process'?JSON.stringify([S.lang,selected,S.run?.awaitingDecision,S.run?.receipts?.filter(r=>r.stepId===selected?.id)]):`${S.tab}:${S.lang}:${S.run?.events.length}`;
 if(content.dataset.renderKey===key)return;
 const sameStep=content.dataset.stepId===selected?.id;const scroll=content.scrollTop;const opened=[...content.querySelectorAll('details[open]')].map(n=>n.dataset.detailId);
 content.dataset.renderKey=key;content.dataset.stepId=selected?.id||'';content.replaceChildren(S.tab==='process'?processPane():S.tab==='terminal'?tracePane():S.tab==='files'?filesPane():previewPane());
 if(sameStep&&S.tab==='process'){content.scrollTop=scroll;content.querySelectorAll('details').forEach(n=>n.open=opened.includes(n.dataset.detailId));}else content.scrollTop=0;
}
function scrollToCurrent(){
 const scroller=$('#conversation-scroll');const row=document.querySelector('.task-step.is-selected');
 const target=S.run?.status==='running'?row:!$('#agent-result').hidden?$('#agent-result'):row;
 if(!target)return;
 const visibleTop=scroller.getBoundingClientRect().top+12;
 const visibleBottom=Math.min(scroller.getBoundingClientRect().bottom,$('.composer-shell').getBoundingClientRect().top)-12;
 const bounds=target.getBoundingClientRect();
 if(bounds.bottom>visibleBottom)scroller.scrollTop+=bounds.bottom-visibleBottom;
 else if(bounds.top<visibleTop)scroller.scrollTop+=bounds.top-visibleTop;
}
function render(){applyText();renderSteps();renderRuntime();
 if(S.follow&&S.run){const key=`${S.run.id}:${selectedStep()?.id||''}:${S.run.status}`;if(S.lastFollowKey!==key){S.lastFollowKey=key;requestAnimationFrame(scrollToCurrent);}}
}
async function api(path,body){const response=await fetch(`/api/research${path}`,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;}
function connect(id,deferred=false){
 S.source?.close();const generation=S.connectionToken=(S.connectionToken||0)+1;const source=new EventSource(`/api/research/runs/${id}/stream`);S.source=source;
 const frames=[];let presenting=false,started=false;S.presentation={queued:0,startedAt:Date.now()};
 const show=payload=>{if(S.connectionToken!==generation)return;S.run=payload.snapshot;if(S.presentation){S.presentation.queued=frames.length;if(payload.done)S.presentation.viewMs=Date.now()-S.presentation.startedAt;}render();if(payload.done){source.close();if(S.run.source==='live'&&S.run.status==='completed'){S.lastLive=S.run.id;localStorage.setItem('research-last-live',S.lastLive);}loadHistory();}};
 const drain=()=>{if(presenting||!frames.length||S.connectionToken!==generation)return;presenting=true;const payload=frames.shift();show(payload);const major=new Set(['step.started','step.completed','step.discovered','receiver.received','decision.awaiting','run.completed','run.blocked','planned','executed','state.changed','repair.required','graph.created','request.sent','node.completed']);const pause=major.has(payload.event?.type)?1250:250;setTimeout(()=>{presenting=false;drain();},pause);};
 const update=event=>{const payload=JSON.parse(event.data);if(deferred&&event.type==='snapshot'&&payload.snapshot.status==='queued'&&!started){show(payload);started=true;api('/runs/'+id+'/start',{}).catch(error=>{S.error=error.message;render();});return;}if(deferred){frames.push(payload);if(payload.done)source.close();drain();}else show(payload);};
 source.addEventListener('snapshot',update);source.addEventListener('update',update);source.onerror=()=>{if(active(S.run)&&!source.readyState){S.error=S.lang==='zh'?'连接中断，运行记录仍会保存。':'Connection interrupted; the run record is retained.';render();}};
}
async function start(replay=false){
 try{
 if(S.starting)return;S.starting=true;S.connectionToken=(S.connectionToken||0)+1;S.source?.close();S.presentation=null;S.error='';S.run=null;S.follow=true;S.lastFollowKey=null;S.selected=null;S.tab='process';S.preview='source';S.showCompare=false;render();
 const scenario=S.bootstrap.scenarios.find(s=>s.id===S.scenario);
 const overrides={};if($('#amount-override').value!=='')overrides.amount=Number($('#amount-override').value);if($('#days-override').value!=='')overrides.late_days=Number($('#days-override').value);
 const created=await api(replay?'/replay':'/runs',replay?{runId:S.lastLive}:{caseId:S.caseId,condition:scenario.condition,method:$('#method-select').value,mode:S.mode,overrides,deferStart:true});S.starting=false;connect(created.id,!replay);
 }catch(error){S.starting=false;S.error=error.message;render();}
}
function renderFeatured(){const root=$('#featured-runs');root.replaceChildren();for(const run of S.bootstrap?.featuredRuns||[]){const button=el('button','history-run featured-run',(S.lang==='zh'?'DeepSeek 重放 · ':'DeepSeek replay · ')+(run.label?l(run.label):methodName(run.method)));button.type='button';button.onclick=()=>{if(run.caseId?.startsWith('finqa-')){S.scenario=run.bundle==='corrected'?'corrected':'financial';S.caseId=run.caseId;S.mode='deepseek';$('#scenario-select').value=S.scenario;$('#execution-mode').value='deepseek';}else if(run.caseId?.startsWith('progressive-')){S.scenario='facts';S.caseId=run.caseId;S.mode='deepseek';$('#scenario-select').value='facts';$('#execution-mode').value='deepseek';}S.lastLive=run.id;start(true);};root.append(button);}}
function renderHistory(){const root=$('#run-history');root.replaceChildren();for(const run of S.history.slice(0,6)){const b=el('button','history-run',`${l(run.title)} · ${methodName(run.method)}`);b.title=`${time(run.createdAt)} · ${t(run.status)}`;b.onclick=async()=>{S.connectionToken=(S.connectionToken||0)+1;S.source?.close();S.presentation=null;S.run=await api(`/runs/${run.id}`);S.caseId=S.run.caseId;S.follow=true;S.tab='process';S.showCompare=false;render();};root.append(b);}}
async function loadHistory(){try{S.history=await api('/history');renderHistory();}catch{}}
async function showComparison(){S.showCompare=true;S.pairs=[];const candidates=S.history.filter(r=>r.caseId===S.run.caseId&&(r.condition||'normal')===(S.run.condition||'normal')&&r.id!==S.run.id&&r.method!==S.run.method);for(const candidate of candidates){const other=await api(`/runs/${candidate.id}`);if(other.executionMode===S.run.executionMode&&JSON.stringify(other.overrides||{})===JSON.stringify(S.run.overrides||{})){S.pairs=[S.run,other];break;}}render();}
function renderComparison(box){if(!S.pairs.length){box.append(el('p','technical-note',S.lang==='zh'?'请用同一案例、相同输入和执行方式，再运行另一种方法。':'Run another method with the same case, inputs, and execution mode.'));return;}const repair=S.run?.family==='repair',table=el('table','comparison-table'),head=el('tr');(repair?[t('method'),t('state'),S.lang==='zh'?'新增披露':'New units',S.lang==='zh'?'外部执行':'Remote calls',S.lang==='zh'?'复用结果':'Reused']:[t('method'),t('state'),callName(),t('toolCalls'),t('bytes')]).forEach(v=>head.append(el('th','',v)));table.append(head);for(const run of S.pairs){const row=el('tr');(repair?[methodName(run.method),t(run.status),run.repairMetrics?.newDisclosures??'—',run.metrics.toolCalls,run.repairMetrics?.reused??'—']:[methodName(run.method),t(run.status),run.metrics.modelCalls,run.metrics.toolCalls,run.metrics.totalBytes]).forEach(v=>row.append(el('td','',v)));table.append(row);}box.append(table,el('p','technical-note',S.lang==='zh'?'仅比较同一输入、同一执行方式下的两次运行；不代表批量效果。':'This compares two runs with the same input and execution mode, not aggregate effectiveness.'));}
async function init(){
 $('#lang-zh').onclick=()=>{S.lang='zh';localStorage.setItem('demo-lang','zh');render();renderFeatured();renderHistory();loadHistory();};$('#lang-en').onclick=()=>{S.lang='en';localStorage.setItem('demo-lang','en');render();renderFeatured();renderHistory();loadHistory();};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;render();});
 $('#follow-button').onclick=()=>{S.follow=true;S.lastFollowKey=null;render();};$('#attachment-link').onclick=()=>{S.tab='preview';S.preview='source';render();};
 $('#live-button').onclick=()=>start();$('#replay-button').onclick=()=>start(true);
 $('#execution-mode').onchange=()=>{S.mode=$('#execution-mode').value;render();};
 $('#replay-side').onclick=()=>{S.connectionToken=(S.connectionToken||0)+1;S.source?.close();S.presentation=null;S.run=null;S.error='';S.follow=true;S.tab='process';S.showCompare=false;render();};
 $('#task-nav').onclick=()=>{S.tab='process';render();};
 try{
   S.bootstrap=await api('/bootstrap');if(S.lastLive){try{const previous=await api(`/runs/${S.lastLive}`);if(previous.status!=='completed')S.lastLive=null;}catch{S.lastLive=null;}}S.lastLive ||= S.bootstrap.sampleRunId;$('#scenario-select').replaceChildren();for(const scenario of S.bootstrap.scenarios){const o=el('option','',l(scenario.title));o.value=scenario.id;$('#scenario-select').append(o);}$('#scenario-select').value=S.scenario;
   $('#scenario-select').onchange=()=>{S.connectionToken=(S.connectionToken||0)+1;S.source?.close();S.presentation=null;S.scenario=$('#scenario-select').value;S.caseId=S.bootstrap.scenarios.find(x=>x.id===S.scenario).caseId;if((S.scenario.startsWith('repair-')||S.scenario.startsWith('model-'))){S.mode='offline';$('#execution-mode').value='offline';}if(S.bootstrap.scenarios.find(s=>s.id===S.scenario)?.requiresLive){S.mode='deepseek';$('#execution-mode').value='deepseek';}S.run=null;S.error='';S.tab='process';S.showCompare=false;render();};
   $('#method-select').replaceChildren();for(const method of ['joint','full','pii','entry','per_step']){const o=el('option','',methodName(method));o.value=method;$('#method-select').append(o);}
   render();renderFeatured();loadHistory();
 }catch(error){S.error=error.message;render();}
}
init();
