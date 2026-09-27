"""Package every canary, including failures; credentials are never selected."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence/evidence-gap-pilot'
NAMES = ['gap-canary-01', 'gap-canary-02', 'gap-canary-03']
SECRET = re.compile(rb'sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def data(path):
    return json.loads(path.read_text(encoding='utf-8'))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    providers = [data(p) for p in (ROOT / 'data/research/v8-session/provider-egress').glob('*.json')]
    used, summaries = set(), []
    for name in NAMES:
        run = ROOT / 'data/research/gap-runs' / name
        entries = {}
        allowed_top = {'protocol.json','manifest.json','input-manifest.json','scores.json','verification.json','intervention.json'}
        for p in run.iterdir():
            if p.is_file() and (p.name in allowed_top or re.fullmatch(r'gap-dev-\d+--(?:full|static|on_demand|gap_repair)\.json',p.name)):
                entries[str(p.relative_to(ROOT)).replace('\\','/')] = p.read_bytes()
        for p in (run / 'frozen').iterdir():
            if p.suffix in ['.json','.py','.mjs','.md']:
                entries[str(p.relative_to(ROOT)).replace('\\','/')] = p.read_bytes()
        labels = ROOT / 'data/research/gap-inputs/evaluation-only.json'
        entries['data/research/gap-inputs/evaluation-only.json'] = labels.read_bytes()
        calls = tokens = completed = attempts = 0
        for p in sorted(run.glob('gap-dev-*--*.json')):
            record = data(p)
            if record['status'] == 'not_started':
                continue
            attempts += 1
            completed += record['status'] == 'completed'
            for call in record['calls']:
                calls += 1
                tokens += (call.get('usage') or {}).get('total_tokens',0)
                if call.get('transportError'):
                    continue
                matches = [x for x in providers if x['id'] not in used and x['receiverBodySha256'] == call['requestSha256']
                           and x['responseSha256'] == call['responseSha256'] and x['responseStatus'] == call['status']]
                if not matches:
                    raise ValueError('Missing distinct provider record: ' + p.name)
                selected = sorted(matches,key=lambda x:x['at'])[0]
                used.add(selected['id'])
                raw = (json.dumps(selected,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
                entries[f'data/research/gap-runs/{name}/provider-egress/{selected["id"]}.json'] = raw
        for path, raw in entries.items():
            if SECRET.search(raw):
                raise ValueError('Potential credential pattern in ' + path)
        entries['CUAD-NOTICE.txt'] = (
            'CUAD v1: The Atticus Project; Dan Hendrycks, Collin Burns, Anya Chen and Spencer Ball.\n'
            'https://www.atticusprojectai.org/cuad/ ; https://arxiv.org/abs/2103.06268\n'
            'Dataset license: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/\n'
            'Public original contracts/questions are selected and partitioned into source chunks.\n'
            'Model responses, runtime decisions and diagnostic scores are author-generated, not upstream annotations.\n'
            'Selection, source hashes and changes are recorded in the included protocol and manifest.\n').encode()
        entries['ARCHIVE.sha256.json'] = (json.dumps({p:sha(raw) for p,raw in sorted(entries.items())},indent=2)+'\n').encode()
        target = OUT / (name + '-records.zip')
        with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for path,raw in sorted(entries.items()):
                info=zipfile.ZipInfo(path,(2026,9,28,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
                archive.writestr(info,raw)
        for namepart in ['protocol.json','scores.json','verification.json','intervention.json']:
            source = run / namepart
            if source.exists():
                (OUT / (name + '-' + namepart)).write_bytes(source.read_bytes())
        summaries.append({'runId':name,'attempts':attempts,'completed':completed,'modelCalls':calls,'tokens':tokens,
                          'archiveBytes':target.stat().st_size,'archiveSha256':sha(target.read_bytes())})
    summary = {'scope':'development records, not independent test results','independentSourceTasks':4,
               'batches':summaries,'modelCalls':sum(x['modelCalls'] for x in summaries),
               'tokens':sum(x['tokens'] for x in summaries),'matchedDistinctProviderRecords':len(used),
               'candidateGate':'not passed: no controller effect on the eight final paired trajectories'}
    (OUT / 'batches.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
