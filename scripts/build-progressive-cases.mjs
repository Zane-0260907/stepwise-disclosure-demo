import { readFile,writeFile,mkdir } from 'node:fs/promises';
const originals=JSON.parse(await readFile(new URL('../fixtures/research/cases.json',import.meta.url),'utf8'));
const old=JSON.parse(await readFile(new URL('../fixtures/research/ground-truth.json',import.meta.url),'utf8'));
const cases=[],labels={};
function add(source,group,edit,truth){
 const c=structuredClone(originals.find(x=>x.id===source));c.id=`progressive-${String(cases.length+1).padStart(2,'0')}`;
 c.title={zh:`逐步补充验证 ${cases.length+1}`,en:`Progressive validation ${cases.length+1}`};
 c.source=`${c.id}.json`;c.split='prospective-v3';c.stratum=group;
 Object.assign(c.facts,{identity:`合成验证对象-${c.id}`,contact:`合成联系人-${c.id}`,account:`SYNTHETIC-${c.id}`,internal_note:`本地预算-${c.id}`,unrelated_record:`其他业务-${c.id}`});edit(c);
 labels[c.id]={...structuredClone(old[source]),...truth,group,labelProvenance:'Author-defined and frozen before v3 model runs; independent human validation pending'};cases.push(c);
}
for(const [clause,days,amount,penalty,required] of [
 ['迟延交货一次按合同总额 1.5% 计收违约金。',6,142000,2130,['clause','amount','late_days']],
 ['迟延交货享有 4 天宽限期，超出部分每天计收 260 元违约金。',7,88500,780,['clause','late_days']],
 ['迟延交货每天按合同总额 0.2% 计收违约金，累计不超过合同总额 0.7%。',6,54000,378,['clause','amount','late_days']],
 ['迟延交货超过 5 天时一次计收 1350 元违约金。',8,71500,1350,['clause','late_days']]
])add('contract-01','supported-parameters',c=>Object.assign(c.facts,{clause,late_days:days,amount}),{expectedCodes:['PENALTY_APPLIES'],acceptableCodeSets:[['PENALTY_APPLIES']],expectedAmount:penalty,analysisNecessary:required});
for(const [scores,homework,absences] of [[[57,59,61],82,1],[[71,75,78],69,0],[[79,80,82],90,4],[[60,64,68],71,2]]){
 const support=scores.reduce((a,b)=>a+b)/3<60||homework<70||absences>2,code=support?'SUPPORT_NEEDED':'ON_TRACK';
 add('study-01','supported-parameters',c=>Object.assign(c.facts,{scores,homework,absences}),{expectedCodes:[code],acceptableCodeSets:[[code]],expectedAmount:null,analysisNecessary:['observations','scores','homework','absences']});
}
const calculations=[
 ['若发生交付延误，日额为230元。请以台账中的延误日数计算应付金额。',5,61000,1150,['clause','late_days']],
 ['货物实际晚到超过两日后，从第三日起每日支付410元。具体晚到几日在本地台账中。',6,83000,1640,['clause','late_days']],
 ['超过约定送货时间即一次性支付价款的百分之一点二。价款与迟延天数均以本地记录为准。',3,125000,1500,['clause','amount','late_days']],
 ['计费标准为每延误一天按价款的千分之一，但累计最多按价款的千分之四。请按台账核算。',7,92000,368,['clause','amount','late_days']]
];
for(const [clause,days,amount,penalty,necessary] of calculations)add('contract-03','new-computable-wording',c=>Object.assign(c.facts,{clause,late_days:days,amount}),{expectedCodes:['PENALTY_APPLIES'],acceptableCodeSets:[['PENALTY_APPLIES']],expectedAmount:penalty,analysisNecessary:necessary,expectedLocal:false});
const screening=[
 '只在以下三项同时满足时输出ON_TRACK：平均成绩不低于60、作业完成率至少70%、缺勤次数至多2。否则输出SUPPORT_NEEDED。',
 '依学校的筛查办法，成绩均分不及60分、作业完成率不到70%或缺课超过两次，任意一项都应标记SUPPORT_NEEDED；其余为ON_TRACK。',
 '筛查只按数值判定：先对全部成绩取算术平均，再查看作业百分比和缺勤次数。均分<60或完成率<70或缺勤>2时须支持，否则正常。',
 '标记条件为三选一：成绩平均值低于60；homework低于70；absences大于2。触发时用SUPPORT_NEEDED，否则用ON_TRACK。'
];
for(const [i,observations] of screening.entries()){
 const scores=i===0?[64,68,72]:i===1?[52,57,59]:[77,82,84],homework=i===2?62:84,absences=i===3?4:1;
 const code=i===0?'ON_TRACK':'SUPPORT_NEEDED';
 add('study-01','new-computable-wording',c=>Object.assign(c.facts,{observations,scores,homework,absences}),{expectedCodes:[code],acceptableCodeSets:[[code]],expectedAmount:null,analysisNecessary:['observations','scores','homework','absences'],expectedLocal:false});
}
const semantics=[
 ['contract-12','货物交付迟延后的赔付，以双方将来商定的比例计算；目前合同中的比例栏尚未填写。','MISSING_RATE'],
 ['contract-13','条款指定按5%赔付，计算所依据的金额却没有出现，也没有指向其他金额条款。','MISSING_BASE'],
 ['contract-16','验收合格才可结款，不过谁负责确认以及按什么标准确认均留待以后协商。','AMBIGUOUS_ACCEPTANCE'],
 ['contract-17','合同一处将付款期写为验收后三十日，另一处写为六十日，未给出冲突解决顺序。','CONFLICTING_TERMS'],
 ['study-11','能正确解释基础知识，课堂提问也表现良好，但是独立练习长期未按计划完成。','PRACTICE_GAP'],
 ['study-12','此前基础扎实，近期因连续不到课错过新章节；目前困难集中在这些未参加的课程。','ATTENDANCE_GAP'],
 ['study-13','多个课程的交付集中碰撞，估计工作总量高于可用时间，积压越来越多。','WORKLOAD_HIGH'],
 ['study-14','作业提交完整，投入时间充足，但把数学命题的充分性与必要性反复混为一谈。','CONCEPT_GAP']
];
for(const [source,text,code] of semantics)add(source,'new-semantic-wording',c=>{c.facts[c.family==='contract'?'clause':'observations']=text;},{expectedCodes:[code],acceptableCodeSets:[[code]],analysisNecessary:[source.startsWith('contract')?'clause':'observations']});
for(const family of ['contract','study'])for(let n=27;n<=30;n++)add(`${family}-${n}`,'new-reference-wrapper',c=>{
 const field=family==='contract'?'clause':'observations';
 c.facts[field]=family==='contract'?`风险审阅针对资料编号${c.facts.reference_code}的条文，请先取得${c.facts.reference_version}版本原文。本地不附正文，不能用其他版本替代。`:`本次学习支持复核使用资源${c.facts.reference_code}，要求版本${c.facts.reference_version}；应查询资源中列出的记录后确定主要困难。`;
},{analysisNecessary:[family==='contract'?'clause':'observations','reference_code','reference_version']});
if(cases.length!==32)throw new Error('Unexpected count');
const out=new URL('../fixtures/validation-v3/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('cases.json',out),JSON.stringify(cases,null,2)+'\n');
await writeFile(new URL('labels.json',out),JSON.stringify(labels,null,2)+'\n');
console.log(JSON.stringify({cases:cases.length,groups:4}));
