"""Separate evaluator: labels are not imported by the agent/runtime."""
import sys,json,pathlib,re,collections,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv)<2 or not re.fullmatch(r'dev-v9-[a-z0-9-]+',sys.argv[1]):
    raise SystemExit('Usage: python scripts/score-v9-development.py dev-v9-... [--check]')
run=ROOT/'data/research/v9-runs'/sys.argv[1]
label_bytes=(run/'frozen/labels.json').read_bytes()
labels=json.loads(label_bytes)
def ordered_sum(values):
    # Preserve the original Python 3.10 left-to-right accumulation. Python 3.12
    # changed float sum(), which otherwise changes the last bit of a mean.
    total=0
    for value in values:total+=value
    return total

def normalize(s):return re.sub(r'\b(a|an|the)\b',' ',re.sub(r'[^a-z0-9 ]',' ',str(s).lower())).split()
def f1(a,b):
    aa=collections.Counter(normalize(a));bb=collections.Counter(normalize(b));n=sum((aa&bb).values())
    return 2*n/(sum(aa.values())+sum(bb.values())) if aa or bb else 1
rows=[]
for path in sorted(run.glob('*--*.json')):
    r=json.loads(path.read_text(encoding='utf-8'));l=labels[r['caseId']];result=r.get('result')
    score=0
    if r['status']=='completed' and isinstance(result,dict):
        if l['kind']=='exact-object':score=float(any(result==v for v in l['acceptable']))
        else:
            predicted=result.get('answers',[])
            if isinstance(predicted,list) and all(isinstance(x,str) for x in predicted):
                if l['impossible']:score=float(len(predicted)==0)
                elif predicted:score=ordered_sum(max(f1(p,g['text']) for p in predicted) for g in l['answers'])/len(l['answers'])
    rows.append({'id':r['id'],'caseId':r['caseId'],'family':r['family'],'method':r['method'],'status':r['status'],'score':score,'error':r.get('error'),**r['metrics']})
summary={}
for method in sorted({r['method'] for r in rows}):
    a=[r for r in rows if r['method']==method];summary[method]={'runs':len(a),'completed':sum(r['status']=='completed' for r in a),'families':{}}
    for family in ['retail','airline','contract']:
        b=[r for r in a if r['family']==family]
        summary[method]['families'][family]={'n':len(b),'meanScore':ordered_sum(r['score'] for r in b)/len(b) if b else None}
    for metric in ['modelCalls','totalTokens','sourceCells','derivedValues','materializedCells','repeatedObservationCells','providerRequestBytes']:
        summary[method][metric]=sum(r[metric] for r in a)
out={'scope':'Exploratory development only. Exact match for database tasks; CUAD mean gold-span token F1 is not expert legal correctness or official CUAD scoring. No independent necessity annotations.','labelsSha256':hashlib.sha256(label_bytes).hexdigest(),'summary':summary,'rows':rows}
if '--check' in sys.argv:
    expected=json.loads((run/'scores.json').read_text(encoding='utf-8'))
    if out!=expected:raise SystemExit('Frozen scores differ from recomputed results')
else:
    (run/'scores.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
