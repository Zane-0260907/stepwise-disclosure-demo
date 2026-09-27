"""Descriptive paired development audit, not a held-out significance test."""
import json,pathlib,sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
RUN=ROOT/'data/research/v9-runs/dev-v9-strong-02'
data=json.loads((RUN/'scores.json').read_text(encoding='utf-8'))
grouped={}
for row in data['rows']:
    grouped.setdefault(row['caseId'],{})[row['method']]=row
assert len(grouped)==24
paired=[]
first_actions={}
for case_id,methods in sorted(grouped.items()):
    assert set(methods)=={'full','eager','deferred'}
    baseline,candidate=methods['eager'],methods['deferred']
    paired.append({'caseId':case_id,'family':candidate['family'],
        'baselineStatus':baseline['status'],'candidateStatus':candidate['status'],
        'baselineScore':baseline['score'],'candidateScore':candidate['score'],
        'baselineSourceCells':baseline['sourceCells'],'candidateSourceCells':candidate['sourceCells'],
        'cellDifference':candidate['sourceCells']-baseline['sourceCells'],
        'callDifference':candidate['modelCalls']-baseline['modelCalls']})
    for method in methods:
        record=json.loads((RUN/(case_id+'--'+method+'.json')).read_text(encoding='utf-8'))
        first=record['actions'][0]['name'] if record['actions'] else 'none'
        first_actions.setdefault(method,{}).setdefault(first,0)
        first_actions[method][first]+=1
summary={}
for family in ['retail','airline','contract','all']:
    rows=[r for r in paired if family=='all' or r['family']==family]
    b=sum(r['baselineSourceCells'] for r in rows)
    c=sum(r['candidateSourceCells'] for r in rows)
    summary[family]={'cases':len(rows),'baselineSourceCells':b,'candidateSourceCells':c,
        'descriptiveRelativeReduction':1-c/b if b else None,
        'fewerCells':sum(r['cellDifference']<0 for r in rows),
        'sameCells':sum(r['cellDifference']==0 for r in rows),
        'moreCells':sum(r['cellDifference']>0 for r in rows)}
out={'scope':'Development only; no independent repetitions, human adjudication, unnecessary-disclosure labels or confirmatory confidence interval. Negative values mean more disclosure by the candidate.',
     'gate':'not passed; no held-out study started','firstActions':first_actions,'summary':summary,'pairs':paired}
target=ROOT/'evidence/development-v9/paired-audit.json'
if '--check' in sys.argv:
    assert out==json.loads(target.read_text(encoding='utf-8')),'Paired audit changed'
else:target.write_bytes(json.dumps(out,ensure_ascii=False,indent=2).encode('utf-8'))
print(json.dumps({'gate':out['gate'],'summary':summary},indent=2))
