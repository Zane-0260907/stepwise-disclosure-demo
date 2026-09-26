import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=['src/research/engine.mjs','src/research/policy.mjs','src/research/catalog.mjs','src/research/checked-execution.mjs','src/research/validation-score.mjs','src/research/transport.mjs','src/research/receiver-worker.mjs','src/research/deepseek-live.mjs','fixtures/validation-v2/cases.json','fixtures/validation-v2/labels.json','fixtures/research/references.json','scripts/run-validation.mjs','package-lock.json'];
const dir=new URL('../evidence/validation-v2/',import.meta.url);await mkdir(dir,{recursive:true});
const hashes={};for(const file of files)hashes[file]=createHash('sha256').update(await readFile(new URL(`../${file}`,import.meta.url))).digest('hex');
const protocol={id:'prospective-v2-20260926',frozenAt:new Date().toISOString(),model:'deepseek-flash',temperature:0,maxTokens:650,
 cases:36,repetitions:2,methods:['full','pii','entry','per_step','joint','placement_full'],jobs:432,concurrency:4,
 primary:'strict structured outcome',secondary:['missing necessary facts per task','extra facts per task','model calls','tokens','latency'],
 analysis:'Average repeats within case; report all four predefined strata. Paired case bootstrap is descriptive for this author-designed synthetic set, not a population estimate. No model or label tuning after freeze.',
 comparisons:['joint vs per_step: effect of local execution','joint vs placement_full: same local rule, different external views','joint vs full: combined effect'],
 missingAndErrors:'All planned runs remain in denominator; no silent retries. Resume only unexecuted job IDs.',
 provenance:'Author-created prospective robustness set in the same two domains. Six cases vary supported parameters, six rephrase computable rules, twelve rephrase semantic cases, twelve wrap existing reference content. Not independently collected data, unseen domains, or a blind human benchmark.',
 humanReview:'Pending. No quality claim until real ratings exist.',hashes};
await writeFile(new URL('protocol.json',dir),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({id:protocol.id,jobs:protocol.jobs,frozenAt:protocol.frozenAt}));
