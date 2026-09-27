import json,pathlib,shutil,zipfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'evidence/development-v9';OUT.mkdir(parents=True,exist_ok=True)
providers=[json.loads(f.read_text(encoding='utf-8')) for f in (ROOT/'data/research/v8-session/provider-egress').glob('*.json')]
used=set()
for name in ['dev-v9-canary-01','dev-v9-strong-02']:
    run=ROOT/'data/research/v9-runs'/name;dest=run/'provider-egress';dest.mkdir(exist_ok=True)
    count=0
    for f in sorted(run.glob('*--*.json')):
        record=json.loads(f.read_text(encoding='utf-8'))
        for c in record['calls']:
            matches=[p for p in providers if p['id'] not in used and p['receiverBodySha256']==c['requestSha256'] and p['responseSha256']==c['responseSha256'] and p['responseStatus']==c['status']]
            if not matches:raise ValueError('Missing distinct provider record: '+f.name)
            p=sorted(matches,key=lambda p:p['at'])[0];used.add(p['id']);count+=1
            (dest/(p['id']+'.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    shutil.copy2(run/'scores.json',OUT/(name+'-scores.json'))
    shutil.copy2(run/'protocol.json',OUT/(name+'-protocol.json'))
    scorer=ROOT/'scripts/score-v9-development.py'
    shutil.copy2(scorer,run/'frozen/score-v9-development.py')
    evaluation={'timing':'Post-run development scoring snapshot; not a prospective evaluation registration.',
                'scorerSha256':hashlib.sha256(scorer.read_bytes()).hexdigest(),
                'labelsSha256':hashlib.sha256((run/'frozen/labels.json').read_bytes()).hexdigest()}
    (run/'evaluation-snapshot.json').write_text(json.dumps(evaluation,indent=2),encoding='utf-8')
    with zipfile.ZipFile(OUT/(name+'-records.zip'),'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for f in sorted(run.rglob('*')):
            if f.is_file():archive.write(f,f.relative_to(ROOT))
    print(name,count,'provider calls',flush=True)
shutil.copy2(ROOT/'data/research/v9-sources/manifest.json',OUT/'source-manifest.json')
shutil.copy2(ROOT/'data/research/v9-sources/tau/LICENSE',OUT/'LICENSE.tau-bench')
# Git checks out public text with LF on every OS. Archives preserve original bytes.
for p in OUT.glob('*.json'):
    p.write_bytes(p.read_text(encoding='utf-8').encode('utf-8'))
manifest={p.name:{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(OUT.glob('*')) if p.is_file() and p.name!='FILES.json'}
(OUT/'FILES.json').write_bytes(json.dumps(manifest,indent=2).encode('utf-8'))
