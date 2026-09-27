"""Deterministic task selection before any model calls; labels stay separate."""
import json,pathlib,hashlib,re,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data/research/v9-sources/tau/data/tau2/domains'
OUT=ROOT/'data/research/v10-inputs';OUT.mkdir(parents=True,exist_ok=True)
cases=[];labels={};groups=set();manifest=[]
for domain in ['retail','airline']:
    tasks=json.loads((DATA/domain/'tasks.json').read_text(encoding='utf-8'))
    train=set(json.loads((DATA/domain/'split_tasks.json').read_text(encoding='utf-8'))['train'])
    # Only development tasks with state-changing reference actions, no custom
    # initialization, and a unique customer scenario; no outcome-based filtering.
    candidates=[t for t in tasks if t['id'] in train and not t.get('initial_state') and t['evaluation_criteria'].get('actions')]
    candidates.sort(key=lambda t:hashlib.sha256(('native-v10-dev:'+domain+':'+t['id']).encode()).hexdigest())
    selected=0
    for task in candidates:
        info=task['user_scenario']['instructions'];group=domain+':'+str(info.get('known_info'))
        if group in groups:continue
        actions=task['evaluation_criteria']['actions']
        writes=[a for a in actions if not a['name'].startswith(('get_','find_','search_','list_')) and a['name'] not in ['calculate','think','transfer_to_human_agents']]
        if not writes:continue
        groups.add(group);selected+=1;cid=domain+'-native-'+task['id']
        cases.append({'id':cid,'domain':domain,'originalTaskId':task['id'],'sourceGroup':hashlib.sha256(group.encode()).hexdigest(),
                      'userScenario':task['user_scenario']})
        labels[cid]=task['evaluation_criteria']
        manifest.append({'id':cid,'originalTaskId':task['id'],'split':'train','sourceSha256':hashlib.sha256((DATA/domain/'tasks.json').read_bytes()).hexdigest(),'selection':'sha256 order, unique known_info group, nonempty state-changing reference actions; before model outcomes'})
        if selected==3:break
guidelines=ROOT/'data/research/v10-upstream/user-simulation-guidelines.md'
if guidelines.exists():(OUT/'user-simulation-guidelines.md').write_bytes(guidelines.read_bytes())
else:
    with zipfile.ZipFile(ROOT/'data/research/v10-upstream/upstream.zip') as z:
        name=next(n for n in z.namelist() if n.endswith('/data/tau2/user_simulator/simulation_guidelines.md'))
        (OUT/'user-simulation-guidelines.md').write_bytes(z.read(name))
for name,value in [('cases.json',cases),('labels.json',labels),('manifest.json',manifest)]:
    (OUT/name).write_bytes(json.dumps(value,ensure_ascii=False,indent=2).encode('utf-8'))
print(json.dumps({'tasks':[c['id'] for c in cases],'labelsSeparated':True}))
