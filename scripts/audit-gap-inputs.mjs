import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createEvidenceSession,digest} from '../src/research/evidence-gap.mjs';

const input=await readFile('data/research/gap-inputs/inputs.json','utf8');
const cases=JSON.parse(input),rows=[];
for(const item of cases){
  const session=createEvidenceSession(item.text),initial=session.search(item.question,3);
  const evidence=initial.chunks.map(c=>({chunkId:c.id,quote:c.text}));
  const gap=session.gaps(evidence);
  rows.push({caseId:item.id,sourceGroup:item.sourceGroup,category:item.category,
    sourceCharacters:Array.from(item.text).length,chunks:session.index.chunks.length,
    initialChunkIds:initial.chunks.map(c=>c.id),initialSourceCharacters:session.disclosed,
    resolvedReferences:gap.obligations.filter(o=>o.status==='resolved').length,
    ambiguousReferences:gap.obligations.filter(o=>o.status==='ambiguous').length,
    unmatchedReferences:gap.obligations.filter(o=>o.status==='not_found').length,
    missingTargetIds:gap.missing,obligations:gap.obligations});
}
const report={kind:'source parser audit; zero model calls, no task accuracy or effect estimate',
  inputSha256:digest(input),runtimeSha256:digest(await readFile('src/research/evidence-gap.mjs')),independentSources:rows.length,modelCalls:0,
  sourcesWithResolvedInitialGap:rows.filter(r=>r.missingTargetIds.length).length,
  sourcesWithAmbiguousInitialReferences:rows.filter(r=>r.ambiguousReferences).length,
  sourcesWithUnmatchedInitialReferences:rows.filter(r=>r.unmatchedReferences).length,
  interpretation:'References are extracted from ALL initial chunks here, not model-selected answers. This is a parser opportunity audit, not evidence that the candidate would fire or help.',rows};
const directory=resolve('evidence/evidence-gap-pilot');await mkdir(directory,{recursive:true});
const target=resolve(directory,'source-audit.json'),body=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==body)throw Error('SOURCE_AUDIT_CHANGED');}
else await writeFile(target,body);
console.log(JSON.stringify({independentSources:report.independentSources,modelCalls:0,
  sourcesWithResolvedInitialGap:report.sourcesWithResolvedInitialGap,
  sourcesWithAmbiguousInitialReferences:report.sourcesWithAmbiguousInitialReferences,
  sourcesWithUnmatchedInitialReferences:report.sourcesWithUnmatchedInitialReferences}));
