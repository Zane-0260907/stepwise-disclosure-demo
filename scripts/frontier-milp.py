"""Independent binary union-cost oracle; JSONL over stdio, no model calls."""
import json,sys,time
import numpy as np
import scipy
from scipy.optimize import milp,Bounds,LinearConstraint
from scipy.sparse import csc_matrix

def solve(request):
    began=time.perf_counter()
    w=request['workload']; hist=set(w['history'])
    choices=[[(a['id'],a) for a in s['alternatives'] if a['feasible']] for s in w['steps']]
    if any(not c for c in choices): return {'status':'infeasible','elapsedMs':(time.perf_counter()-began)*1000}
    flat=[a for group in choices for _,a in group]; nx=len(flat)
    tokens=sorted({t for a in flat for t in a['tokens']} - hist); ti={t:nx+i for i,t in enumerate(tokens)}
    nv=nx+len(tokens)
    if not nv: return {'status':'optimal','tuple':[0,0,0],'path':[],'elapsedMs':0}
    max_fields=sum(max(a['fields'] for _,a in group) for group in choices)
    max_work=sum(max(a['work'] for _,a in group) for group in choices)
    ww=max_fields+1; wd=(max_work+1)*ww
    objective=np.array([a['work']*ww+a['fields'] for a in flat]+[wd]*len(tokens),dtype=float)
    rows=[];lower=[];upper=[];index=0
    for group in choices:
        row={j:1 for j in range(index,index+len(group))};index+=len(group)
        rows.append(row);lower.append(1);upper.append(1)
    for i,a in enumerate(flat):
        for t in set(a['tokens'])-hist:
            rows.append({i:1,ti[t]:-1});lower.append(-np.inf);upper.append(0)
    rows.append({i:a['fields'] for i,a in enumerate(flat)});lower.append(-np.inf);upper.append(request['budget'])
    rr=[];cc=[];vv=[]
    for i,row in enumerate(rows):
        for j,v in row.items(): rr.append(i);cc.append(j);vv.append(v)
    matrix=csc_matrix((vv,(rr,cc)),shape=(len(rows),nv))
    result=milp(objective,integrality=np.ones(nv),bounds=Bounds(np.zeros(nv),np.ones(nv)),constraints=LinearConstraint(matrix,lower,upper),options={'time_limit':request['timeLimitMs']/1000,'mip_rel_gap':0})
    record={'status':{0:'optimal',1:'time-limit',2:'infeasible'}.get(result.status,'error'),'solverStatus':int(result.status),'message':result.message,'elapsedMs':(time.perf_counter()-began)*1000,'scipy':scipy.__version__}
    if result.x is not None:
        selected=[];i=0
        for group in choices:
            chosen=[]
            for _,a in group:
                if result.x[i]>0.5:chosen.append(a)
                i+=1
            if len(chosen)!=1:raise ValueError('Non-integral oracle output')
            selected.extend(chosen)
        revealed={t for a in selected for t in a['tokens']}-hist
        fields=sum(a['fields'] for a in selected); work=sum(a['work'] for a in selected)
        if fields>request['budget']:raise ValueError('Oracle budget violated')
        record.update(tuple=[len(revealed),work,fields],path=[a['id'] for a in selected],newDisclosures=sorted(revealed),gap=float(getattr(result,'mip_gap',0)))
    return record

if __name__=='__main__':
    for line in sys.stdin:
        try:print(json.dumps(solve(json.loads(line))),flush=True)
        except Exception as e:print(json.dumps({'status':'error','error':str(e)}),flush=True)
