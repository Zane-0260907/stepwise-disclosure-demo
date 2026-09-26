import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=['src/research/engine.mjs','src/research/policy.mjs','src/research/catalog.mjs','src/research/checked-execution.mjs','src/research/adaptive-execution.mjs','src/research/validation-score.mjs','src/research/transport.mjs','src/research/receiver-worker.mjs','src/research/deepseek-live.mjs','fixtures/validation-v3/cases.json','fixtures/validation-v3/labels.json','fixtures/research/references.json','scripts/run-progressive.mjs','package-lock.json'];
const hashes={};for(const file of files)hashes[file]=createHash('sha256').update(await readFile(new URL(`../${file}`,import.meta.url))).digest('hex');
const protocol={id:'prospective-v3-20260926',frozenAt:new Date().toISOString(),model:'deepseek-flash',temperature:0,maxTokens:650,
 cases:32,repetitions:2,methods:['full','pii','entry','per_step','joint','no_acquisition','placement_full'],jobs:448,concurrency:4,
 primary:'strict structured-task success; all planned jobs in denominator',
 comparisons:['joint vs no_acquisition: progressive field requests','joint vs per_step: local execution','joint vs placement_full: disclosure with matched local execution'],
 secondary:['extra facts transmitted','necessary facts missing from final analysis request','model calls','tokens','elapsed time'],
 unit:'Average repetitions within case; paired bootstrap 2000 draws, descriptive for this synthetic set; four strata also reported separately. No multiplicity-adjusted confirmatory significance claim.',
 development:'The v2 36-case set exposed missing inputs and was used for development. It is not a holdout for this mechanism. Three v2 cases are a live smoke pilot.',
 provenance:'Author-created new inputs in the same two domains. Eight cases per stratum: supported parameter changes, new calculable formulations, new semantic formulations, new wrappers of existing reference corpus. No real-document or new-domain generalization claim.',
 ablation:'All methods share model, instructions, schemas and output evaluator. no_acquisition removes only the fact-request tool while retaining joint local routing; placement_full uses the same local rule and full context on external steps.',
 failures:'No silent retries, relabeling or post-result source changes. Resume unexecuted job IDs only.',
 humanReview:'Pending actual author assessments; authors are not independent external experts.',hashes};
const dir=new URL('../evidence/validation-v3/',import.meta.url);await mkdir(dir,{recursive:true});
await writeFile(new URL('protocol.json',dir),JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({id:protocol.id,jobs:protocol.jobs,frozenAt:protocol.frozenAt}));
