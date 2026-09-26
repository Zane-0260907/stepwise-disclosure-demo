import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { evaluateRun } from '../src/research/evaluate.mjs';
const id=process.argv[2]||'frozen-v1-20260925';
if(!/^[\w.-]+$/.test(id))throw new Error('Invalid experiment ID');
const dir=new URL(`../data/research/experiments/${id}/`,import.meta.url);
const scores=(await readFile(new URL('scores.jsonl',dir),'utf8')).trim().split('\n').map(JSON.parse);
let receipts=0;
for(const score of scores){
 const run=JSON.parse(await readFile(new URL(`${score.runId}.json`,dir),'utf8'));
 const rebuilt=JSON.parse(JSON.stringify({...await evaluateRun(run),repetition:score.repetition}));
 assert.deepEqual(rebuilt,score,`Recorded score differs: ${score.runId}`);
 receipts+=run.receipts.length;
}
const result={experiment:id,runs:scores.length,receipts,allScoresRecomputed:true,modelCallsMade:0};
await writeFile(new URL('../evidence/research/offline-score-check.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
