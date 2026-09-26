import { readFile, mkdir, writeFile } from 'node:fs/promises';

// Prospective, author-created robustness set. These are not independently
// collected enterprise documents or a new domain. No evaluation result is read.
const originals=JSON.parse(await readFile(new URL('../fixtures/research/cases.json',import.meta.url),'utf8'));
const oldLabels=JSON.parse(await readFile(new URL('../fixtures/research/ground-truth.json',import.meta.url),'utf8'));
const cases=[],labels={};
function add(sourceId,stratum,edit,label){
  const item=structuredClone(originals.find(x=>x.id===sourceId));
  item.id=`validation-${String(cases.length+1).padStart(2,'0')}`;
  item.source=`${item.id}.json`;item.split='prospective-robustness';item.stratum=stratum;
  item.title={zh:`补充验证 ${cases.length+1}`,en:`Validation case ${cases.length+1}`};
  item.facts.identity=`合成主体-验证-${cases.length+1}`;
  item.facts.contact=`合成联系人-${cases.length+1}`;
  item.facts.account=`SYNTHETIC-VALIDATION-${cases.length+1}`;
  item.facts.internal_note=`只在本地保留的预算备注-${cases.length+1}`;
  item.facts.unrelated_record=`不相关档案-${cases.length+1}`;
  edit(item);
  labels[item.id]={...structuredClone(oldLabels[sourceId]),...label,group:stratum,
    labelProvenance:'Author-created before model calls; independent human validation pending'};
  cases.push(item);
}

// Numerical changes within supported templates: two domains, six cases.
for(const [i,days] of [1,4,9].entries())add('contract-03','supported-parameters',c=>{
  c.facts.clause='迟延交货每天计收 175 元违约金。';c.facts.late_days=days;c.facts.amount=73210+i*3000;
},{expectedCodes:['PENALTY_APPLIES'],acceptableCodeSets:[['PENALTY_APPLIES']],expectedAmount:days*175,analysisNecessary:['clause','late_days']});
for(const [scores,homework,absences] of [[[61,62,64],78,1],[[82,88,86],68,1],[[74,78,76],88,3]]){
 const code=homework<70||absences>2?'SUPPORT_NEEDED':'ON_TRACK';
 add('study-01','supported-parameters',c=>Object.assign(c.facts,{scores,homework,absences}),{expectedCodes:[code],acceptableCodeSets:[[code]],expectedAmount:null,analysisNecessary:['observations','scores','homework','absences']});
}
// New formulations of calculable rules: language is deliberately not the
// registered local template. The necessary-field labels are declared here,
// independently of neededFacts(); omission counts even if no extra fact leaks.
const paraphrases=[
 '货物每晚到一天，供货方须支付175元；迟延天数记录在late_days字段。',
 '以实际晚交的天数乘以175元，作为本次应付的违约金额。',
 '本条采用固定日额：每日175元，按late_days记载的延误天数累计。'
];
for(const [i,clause] of paraphrases.entries())add('contract-03','unseen-rule-wording',c=>Object.assign(c.facts,{clause,late_days:i+3,amount:97650}),
 {expectedCodes:['PENALTY_APPLIES'],acceptableCodeSets:[['PENALTY_APPLIES']],expectedAmount:(i+3)*175,analysisNecessary:['clause','late_days'],expectedLocal:false});
const studyRules=[
 '依次核对三项：scores的均值是否不足60、homework是否不足70、absences是否大于2；任一成立即SUPPORT_NEEDED，否则ON_TRACK。',
 '支持条件采用逻辑或：平均成绩小于60分，作业完成百分比低于70，缺勤次数超过2。全部不成立则ON_TRACK。',
 '请应用这一筛查判据：均分达到60、作业完成率达到70%且缺勤不超过2次才标记ON_TRACK，其余标记SUPPORT_NEEDED。'
];
for(const [i,observations] of studyRules.entries())add('study-01','unseen-rule-wording',c=>Object.assign(c.facts,{observations,scores:[66,70,74],homework:i===1?65:85,absences:i===2?3:1}),
 {expectedCodes:[i===0?'ON_TRACK':'SUPPORT_NEEDED'],acceptableCodeSets:[[i===0?'ON_TRACK':'SUPPORT_NEEDED']],expectedAmount:null,analysisNecessary:['observations','scores','homework','absences'],expectedLocal:false});

const contractTexts=[
 ['contract-12','交货日晚于约定时买方可以索赔，但文本把罚金比例留空，其他计算条件已经约定。','MISSING_RATE'],
 ['contract-13','晚交的罚款比例定为百分之五，条文没有交代这百分之五应乘哪个金额。','MISSING_BASE'],
 ['contract-15','每延误一日需支付200元，起算日既未列出也未指定确定办法。','MISSING_START'],
 ['contract-16','付款取决于验收合格，然而合格的判断标准与负责验收的一方都没有写明。','AMBIGUOUS_ACCEPTANCE'],
 ['contract-17','正文要求验收后30日内付款，补充页改为60日；文件之间谁优先适用没有约定。','CONFLICTING_TERMS'],
 ['contract-18','交付要求只有“尽早送达”，没有明确日期，也没有可计算的交付期限。','MISSING_DEADLINE']
];
for(const [id,clause,code] of contractTexts)add(id,'unseen-semantic-wording',c=>{c.facts.clause=clause;},
 {expectedCodes:[code],acceptableCodeSets:[[code]],analysisNecessary:['clause']});
const studyTexts=[
 ['study-11','口头问答和随堂小测均能掌握概念，但独立练习长期只完成一小部分。','PRACTICE_GAP'],
 ['study-12','已经提交的作业表现良好，近期三次没有到课导致新增章节未学。','ATTENDANCE_GAP'],
 ['study-13','五项课程任务集中在同一周到期，完成所需时间超过每天可用时段。','WORKLOAD_HIGH'],
 ['study-14','练习提交齐全且学习时间充足，却反复把必要条件和充分条件的含义颠倒。','CONCEPT_GAP'],
 ['study-15','一段时间连续复习，随后多日完全中断；相近难度测试的表现随之大幅起伏。','CONSISTENCY_GAP'],
 ['study-16','理解讲解且能复述步骤，但独立演练明显不足，练习册多处没有作答。','PRACTICE_GAP']
];
for(const [id,observations,code] of studyTexts)add(id,'unseen-semantic-wording',c=>{c.facts.observations=observations;},
 {expectedCodes:[code],acceptableCodeSets:[[code]],analysisNecessary:['observations']});

// New wrappers around the EXISTING reference corpus; retrieval content is not
// held out. This distinction is recorded in the protocol and paper.
for(const family of ['contract','study'])for(let i=0;i<6;i++){
 const id=`${family}-${21+i}`;
 add(id,'new-reference-wrapper',c=>{
   const key=family==='contract'?'clause':'observations';
   c.facts[key]=family==='contract'
     ?`本页只给出交叉引用 ${c.facts.reference_code}，适用版本为 ${c.facts.reference_version}。应以资料服务返回的条款正文复核风险，勿凭编号推定内容。`
     :`请先取得 ${c.facts.reference_code} 的 ${c.facts.reference_version} 版资源，结合资源中记载的学习表现确定主要支持方向。`;
 },{analysisNecessary:[family==='contract'?'clause':'observations','reference_code','reference_version']});
}
if(cases.length!==36)throw new Error('Unexpected case count');
const out=new URL('../fixtures/validation-v2/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('cases.json',out),JSON.stringify(cases,null,2)+'\n');
await writeFile(new URL('labels.json',out),JSON.stringify(labels,null,2)+'\n');
console.log(JSON.stringify({cases:cases.length,groups:Object.fromEntries([...new Set(cases.map(c=>c.stratum))].map(s=>[s,cases.filter(c=>c.stratum===s).length]))}));
