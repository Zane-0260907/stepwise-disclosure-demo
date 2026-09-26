import { randomUUID } from 'node:crypto';

export const OFFLINE_MODEL='offline-rule-driver-v1';

function classifyContract(facts){
 const text=facts.reference_text||facts.clause||'';
 const rules=[
  [/履约.*(?:未说明|具体义务|指交货)/,'UNDEFINED_OBLIGATION','明确“履约”对应的具体义务和触发节点。'],
  [/比例(?:尚未|未)(?:约定|填写)/,'MISSING_RATE','补充违约金比例。'],
  [/计算基数/,'MISSING_BASE','明确违约金的计算基数。'],
  [/累计上限/,'MISSING_CAP','明确累计违约金上限。'],
  [/从哪个日期|起算日/,'MISSING_START','明确计算起始日期。'],
  [/验收标准|验收责任人/,'AMBIGUOUS_ACCEPTANCE','明确验收标准和责任人。'],
  [/优先顺序|约定不一致/,'CONFLICTING_TERMS','明确正文和附件的优先顺序。'],
  [/交货日|约定交付日/,'MISSING_DEADLINE','填写明确的交付日期。'],
 ];
 const match=rules.find(([pattern])=>pattern.test(text));
 const issue=match?.[1]||'UNDEFINED_TRIGGER';
 const citation=facts.reference_citation;
 return {issueCodes:[issue],amount:null,summary:`已核对当前条款${citation?'及指定版本资料':''}；${match?match[2]:'触发条件尚不明确，需要人工复核。'}`,recommendation:match?.[2]||'明确触发条件后再核算。',evidenceIds:[facts.reference_text?'reference_text':'clause'],citations:citation?[citation]:[]};
}

function classifyStudy(facts){
 const observation=facts.observations||'';
 const issue=/缺勤|缺课/.test(observation)?'ATTENDANCE_GAP':/作业|练习/.test(observation)?'PRACTICE_GAP':/任务|压力/.test(observation)?'WORKLOAD_HIGH':'CONCEPT_GAP';
 return {issueCodes:[issue],amount:null,summary:`根据当前学习记录识别主要问题：${observation.slice(0,75)}`,recommendation:'根据记录安排下一步支持，并复核后续变化。',evidenceIds:['observations'],citations:facts.reference_citation?[facts.reference_citation]:[]};
}

export function executeOfflineRequest(body){
 if(body.model!==OFFLINE_MODEL)throw new Error('Unexpected offline model');
 const prompt=JSON.parse(body.messages.find(message=>message.role==='user').content);
 const facts=prompt.facts||{};
 if(facts.reference_code&&!facts.reference_text){
  const call={id:`call_${randomUUID().replaceAll('-','')}`,type:'function',function:{name:'lookup_reference',arguments:JSON.stringify({code:facts.reference_code,version:facts.reference_version})}};
  return {id:randomUUID(),model:OFFLINE_MODEL,usage:{prompt_tokens:0,completion_tokens:0},choices:[{message:{role:'assistant',content:null,tool_calls:[call]}}]};
 }
 const result=facts.observations?classifyStudy(facts):classifyContract(facts);
 return {id:randomUUID(),model:OFFLINE_MODEL,usage:{prompt_tokens:0,completion_tokens:0},choices:[{message:{role:'assistant',content:JSON.stringify(result)}}]};
}
