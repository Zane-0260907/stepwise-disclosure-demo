import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url),dir=new URL('data/research/validation/prospective-v3-20260926/',root);
const rows=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').map(JSON.parse);
const cases=JSON.parse(await readFile(new URL('fixtures/validation-v3/cases.json',root),'utf8'));
// Post-experiment, systematic selection: first case of each domain in each
// stratum, repeat 0, three predefined mechanism comparisons. No success filter.
const ids=[1,5,9,13,17,21,25,29].map(n=>`progressive-${String(n).padStart(2,'0')}`);
const selected=rows.filter(r=>ids.includes(r.caseId)&&r.repetition===0&&['joint','no_acquisition','placement_full'].includes(r.method));
selected.sort((a,b)=>createHash('sha256').update('review-order-v1'+a.jobId).digest('hex').localeCompare(createHash('sha256').update('review-order-v1'+b.jobId).digest('hex')));
const out=new URL('data/research/human-review-v3/',root);await mkdir(out,{recursive:true});
// Preserve any completed or partially completed ratings on a repeated command.
for(const who of ['a','b']){
 try{await readFile(new URL(`reviewer-${who}.csv`,out));throw new Error('Review packet already exists; preserve its ratings and use a new directory for another review.');}
 catch(error){if(error.code!=='ENOENT')throw error;}
}
const mapping=[],sections=[];
const references=JSON.parse(await readFile(new URL('fixtures/research/references.json',root),'utf8'));
for(const [index,row]of selected.entries()){
 const id=`R${String(index+1).padStart(2,'0')}`,run=JSON.parse(await readFile(new URL(`${row.runId}.json`,dir),'utf8')),item=cases.find(c=>c.id===row.caseId);
 const reference=references.find(r=>r.code===item.facts.reference_code&&r.version===item.facts.reference_version);
 mapping.push({reviewId:id,jobId:row.jobId,runId:row.runId,method:row.method});
 sections.push(`## 样本 ${id}\n\n任务：${item.task.zh}\n\n输入业务事实：\n\n\`\`\`json\n${JSON.stringify(Object.fromEntries(Object.entries(item.facts).filter(([k])=>!['identity','contact','account','internal_note','unrelated_record'].includes(k))),null,2)}\n\`\`\`\n${reference?`\n参考资料原文：${reference.text}\n`:''}\n系统解释：${run.result?.summary||'未产生结果'}\n\n系统建议：${run.result?.recommendation||'未产生结果'}\n\n结构化输出：${JSON.stringify({issueCodes:run.result?.issueCodes,amount:run.result?.amount,citations:run.result?.citations})}\n`);
}
const rubric=`# 自由文本结果盲审\n\n状态：待真人填写。两位评阅者分别评分，提交前不讨论答案；这是作者内部盲评，不等同于独立领域专家评价。不要访问解盲映射或按文本搜索运行记录。输出措辞可能暴露执行方式，因此盲法并不完美。\n\n共有24个结果，按固定案例位置选取，不依据结果好坏筛选。选择在实验之后制定，属于补充评价。\n\n每项0至2分：\n\n- 结论正确性：0=错误或无法完成；1=部分正确且有实质遗漏；2=与输入事实一致。\n- 依据充分性：0=核心依据捏造或明显不支持；1=依据不完整；2=主要判断均可追溯到输入或给出的资料。\n- 建议适用性：0=与问题不符或可能误导；1=相关但笼统；2=具体且不越出输入能支持的范围。\n\n发现编造事实，在 hallucination 列填 yes，并在 notes 中抄录有问题的句子及理由；未发现填 no。不要因为文风流畅额外加分。没有系统结果的条目仍须保留，按0分记录。不评判真实法律效力或对真实学生作诊断。\n\n完成后分别返回 reviewer-a.csv 与 reviewer-b.csv。必须填完所有行；分歧讨论在两份原始评分保存后进行，并保留初始评分。\n\n`;
await writeFile(new URL('盲审样本与评分说明.md',out),rubric+sections.join('\n'));
const csv='\uFEFFreview_id,correctness_0_2,evidence_0_2,actionability_0_2,hallucination_yes_no,notes\n'+mapping.map(r=>`${r.reviewId},,,,,`).join('\n')+'\n';
for(const who of ['a','b'])await writeFile(new URL(`reviewer-${who}.csv`,out),csv);
await writeFile(new URL('解盲映射_评分完成前勿阅.json',out),JSON.stringify(mapping,null,2));
console.log(JSON.stringify({packets:mapping.length,directory:out.pathname,humanRatings:'pending'}));
