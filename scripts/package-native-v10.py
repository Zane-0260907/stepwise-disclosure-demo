"""Package complete development evidence without credentials or model replay claims."""
import hashlib,json,pathlib,shutil,zipfile,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
RUNS=ROOT/'data/research/v10-runs';OUT=ROOT/'evidence/development-v10';OUT.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
write=lambda p,x:p.write_bytes(json.dumps(x,ensure_ascii=False,indent=2).encode('utf-8'))
secret=re.compile(rb'(?:sk-[a-zA-Z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})')
def clean(data,name):
    if secret.search(data):raise ValueError('Potential credential in '+name)
    return data
def archive(paths,target):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in sorted(paths):z.writestr(p.relative_to(ROOT).as_posix(),clean(p.read_bytes(),p.name))
providers={}
for p in (ROOT/'data/research/v8-session/provider-egress').glob('*.json'):
    x=json.loads(p.read_text(encoding='utf-8'));key=(x.get('receiverBodySha256'),x.get('responseSha256'),x.get('responseStatus'))
    providers.setdefault(key,[]).append(p)
used=set();index=[]
for directory in sorted(RUNS.glob('dev-v10-*')):
    if (directory/'RUNNING.lock').exists():raise ValueError('Batch still running: '+directory.name)
    protocol=json.loads((directory/'protocol.json').read_text(encoding='utf-8'))
    target=directory/'provider-egress';target.mkdir(exist_ok=True);paths=[];calls=0
    for cid in protocol['caseIds']:
        record=json.loads((directory/(cid+'.json')).read_text(encoding='utf-8'))
        for call in record['calls']:
            key=(call['requestSha256'],call['responseSha256'],call['status'])
            match=next((p for p in providers.get(key,[]) if p not in used),None)
            assert match is not None,(directory.name,cid,call['index'],'No distinct provider record')
            used.add(match);data=clean(match.read_bytes(),match.name);destination=target/match.name
            if destination.exists():assert destination.read_bytes()==data
            else:destination.write_bytes(data)
            paths.append(destination);calls+=1
    evaluator=directory/'frozen/audit-native-v10.py'
    evaluator.write_bytes((ROOT/'scripts/audit-native-v10.py').read_bytes())
    # These are explicitly POST-RUN audit snapshots, not prospective registration.
    check_files=['frozen/labels.json','frozen/audit-native-v10.py','state-audit.json']+[c+'.json' for c in protocol['caseIds']]
    write(directory/'post-run-audit.json',{'kind':'post-run-audit-snapshot','files':{p:sha((directory/p).read_bytes()) for p in check_files}})
    files=[p for p in directory.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='RUNNING.lock']
    target_zip=OUT/(directory.name+'.zip');archive(files,target_zip)
    index.append({'runId':directory.name,'attempts':len(protocol['caseIds']),'calls':calls,'archiveSha256':sha(target_zip.read_bytes())})

# A small offline bundle holds the original upstream Python source and the two
# original domain datasets. Check every byte against the pinned source archive.
upstream=ROOT/'data/research/v10-upstream';manifest=json.loads((upstream/'source-manifest.json').read_text(encoding='utf-8'))
upstream_files=[]
with zipfile.ZipFile(upstream/'upstream.zip') as z:
    prefix=z.namelist()[0].split('/')[0]+'/'
    for name,digest in manifest['files'].items():
        p=upstream/name;assert sha(p.read_bytes())==digest;assert p.read_bytes()==z.read(prefix+name);upstream_files.append(p)
    upstream_files.append(upstream/'source-manifest.json')
    for domain in ['retail','airline']:
        for filename in ['db.json','policy.md','tasks.json','split_tasks.json']:
            relative='data/tau2/domains/'+domain+'/'+filename
            p=ROOT/'data/research/v9-sources/tau'/relative
            assert p.read_bytes()==z.read(prefix+relative);upstream_files.append(p)
    licence=OUT/'LICENSE.tau2-bench';licence.write_bytes(z.read(prefix+'LICENSE'))
    guide=upstream/'user-simulation-guidelines.md';guide.write_bytes(z.read(prefix+'data/tau2/user_simulator/simulation_guidelines.md'));upstream_files.append(guide)
archive(upstream_files,OUT/'upstream-native.zip')
write(OUT/'index.json',{'scope':'Development only. No held-out benchmark or independently adjudicated conversation score. Every diagnostic and failed run is retained.','upstream':{k:manifest[k] for k in ['repository','revision','archiveSha256']},'runs':index,'upstreamBundleSha256':sha((OUT/'upstream-native.zip').read_bytes())})
print(json.dumps({'runs':len(index),'attempts':sum(r['attempts'] for r in index),'providerCalls':len(used),'archivesBytes':sum(p.stat().st_size for p in OUT.glob('*.zip'))}))
