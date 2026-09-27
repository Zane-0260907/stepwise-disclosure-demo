"""Fetch pinned public development sources. No benchmark labels enter a model request."""
import hashlib, json, pathlib, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/research/v9-sources'
TAU = 'b7ea9074c1cba482b30687fecdb5c8425fd6f619'
CUAD = '67faa0e6023b04fcaae6cc09497ab00e5d63a2a2'
OUT.mkdir(parents=True, exist_ok=True)
records=[]
reference=ROOT/'evidence/development-v9/source-manifest.json'
expected={(r['repo'],r['commit'],r['path']):r for r in json.loads(reference.read_text(encoding='utf-8'))} if reference.exists() else {}
files=[('sierra-research/tau2-bench',TAU,p) for p in ['LICENSE'] + [f'data/tau2/domains/{d}/{p}' for d in ['retail','airline'] for p in ['db.json','tasks.json','policy.md','split_tasks.json']] + [f'src/tau2/domains/{d}/{p}' for d in ['retail','airline'] for p in ['tools.py','data_model.py']]]
files += [('The-Atticus-Project/cuad',CUAD,'readme.md'),('The-Atticus-Project/cuad',CUAD,'data.zip')]
for repo,rev,path in files:
    target=OUT/('cuad' if 'cuad' in repo else 'tau')/path
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():
        url=f'https://raw.githubusercontent.com/{repo}/{rev}/{path}'
        with urllib.request.urlopen(url,timeout=120) as r: target.write_bytes(r.read())
    blob=target.read_bytes()
    record={'repo':repo,'commit':rev,'path':path,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob)}
    if expected and record!=expected.get((repo,rev,path)):
        raise ValueError('Source bytes do not match the published manifest: '+path)
    records.append(record)
    print(path,len(blob),flush=True)
(OUT/'manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
with zipfile.ZipFile(OUT/'cuad/data.zip') as archive:
    print('CUAD archive:',archive.namelist()[:35])
