"""Recompute the paper's planner results from complete per-run records."""
import json,hashlib,statistics,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'evidence/frontier-study'
def load(p):return json.loads(p.read_text(encoding='utf8'))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def percentile(v,q):
    v=sorted(v);return v[min(len(v)-1,int((len(v)-1)*q))] if v else None
def analyze(folder):
    ws=load(folder/'workloads.json');rows=load(folder/'records.json');protocol=load(folder/'protocol.json');by={w['id']:w for w in ws}
    for r in rows:
        if 'path' not in r:continue
        w=by[r['caseId']];assert len(r['path'])==len(w['steps'])
        chosen=[next(a for a in s['alternatives'] if a['id']==id and a['feasible']) for s,id in zip(w['steps'],r['path'])]
        cost=[len({t for a in chosen for t in a['tokens']}-set(w['history'])),sum(a['work'] for a in chosen),sum(a['fields'] for a in chosen)]
        assert cost==r['tuple'],r['caseId'];assert cost[2]<=r['budget']
    first=[r for r in rows if r.get('repeat')==0];lookup={(r['caseId'],r.get('slack'),r['method']):r for r in first}
    methods={}
    for method in protocol['methods']:
        rs=[r for r in first if r['method']==method];ok=[r for r in rs if 'tuple' in r and r['status'] in ['optimal','optimal-candidate']]
        agree=0;wins=0;sum_d=0;sum_f=0
        for r in ok:
            oracle=lookup[(r['caseId'],r.get('slack'),'milp')]
            if oracle['status']=='optimal':
                if method!='greedy':assert r['tuple']==oracle['tuple'],(method,r['caseId'],r['tuple'],oracle['tuple'])
                agree+=r['tuple']==oracle['tuple']
            greedy=lookup[(r['caseId'],r.get('slack'),'greedy')];wins+=r['tuple'][0]<greedy['tuple'][0]
            sum_d+=r['tuple'][0];sum_f+=r['tuple'][2]
        times=[]
        for r in ok:times.append(statistics.median(x['elapsedMs'] for x in rows if x['caseId']==r['caseId'] and x.get('slack')==r.get('slack') and x['method']==method))
        methods[method]={'settings':len(rs),'completed':len(ok),'optimalMatches':agree,'fewerDisclosureSettingsThanGreedy':wins,'sumDisclosure':sum_d,'sumFields':sum_f,'medianMs':statistics.median(times) if times else None,'p95Ms':percentile(times,.95),'maxMs':max(times) if times else None,'maxPeak':max((r.get('peak',0) for r in ok),default=0),'limits':len(rs)-len(ok)}
    budgets=[]
    for slack in protocol.get('slacks',[]):
        pair=[r for r in first if r['method']=='disclosure-frontier' and r['slack']==slack];g=[lookup[(r['caseId'],slack,'greedy')] for r in pair]
        d=sum(r['tuple'][0] for r in pair if 'tuple'in r);gd=sum(r['tuple'][0] for r in g);f=sum(r['tuple'][2] for r in pair if 'tuple'in r);gf=sum(r['tuple'][2] for r in g)
        budgets.append({'slack':slack,'settings':len(pair),'disclosures':d,'greedyDisclosures':gd,'fields':f,'greedyFields':gf,'disclosureReductionPct':100*(gd-d)/gd,'fieldChangePct':100*(f-gf)/gf})
    return {'cases':len(ws),'settings':len(first)//len(protocol['methods']),'timingRepeats':protocol['repeats'],'rows':len(rows),'methods':methods,'budgets':budgets,'sources':{'workloads':digest(folder/'workloads.json'),'protocol':digest(folder/'protocol.json'),'records':digest(folder/'records.json')}}
result={'final':analyze(BASE/'final'),'scope':'Synthetic registered-choice planning. Timing repeats and budget settings do not add independent real tasks; not a semantic privacy or task-quality score.'}
timing=BASE/'final/timing.json'
if timing.exists():
    tr=load(timing);metrics={}
    for method in ['greedy','live-frontier','disclosure-frontier','milp']:
        rs=[r for r in tr['records'] if r['method']==method];groups={}
        for r in rs:groups.setdefault((r['caseId'],r['slack']),[]).append(r)
        med=[statistics.median(r['elapsedMs'] for r in group) for group in groups.values() if all(r['status'] in ['optimal','optimal-candidate'] for r in group)]
        metrics[method]={'completedSettings':len(med),'medianMs':statistics.median(med),'p95Ms':percentile(med,.95),'maxMedianMs':max(med)}
    result['serialTiming']={'description':tr['description'],'repeats':5,'methods':metrics,'sha256':digest(timing)}
if (BASE/'records.json').exists():result['development']=analyze(BASE)
integration=load(BASE/'integration-check.json');result['integration']={'runs':len(integration),'completed':sum(r['status']=='completed' for r in integration),'modelPlans':len({r['modelRecordId'] for r in integration}),'sourceTasks':len({r['caseId'] for r in integration}),'httpRequests':sum(r['metrics']['remoteCalls'] for r in integration),'newModelCalls':0,'sha256':digest(BASE/'integration-check.json')}
out=BASE/'summary.json'
if '--check' in sys.argv:assert load(out)==result
else:out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(json.dumps(result,ensure_ascii=False))
