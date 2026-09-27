"""Offline extraction into ignored data/, verifying frozen archive digests."""
import pathlib,json,hashlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1];SOURCE=ROOT/'evidence/development-v10'
index=json.loads((SOURCE/'index.json').read_text(encoding='utf-8'))
items=[('upstream-native.zip',index['upstreamBundleSha256'])]+[(r['runId']+'.zip',r['archiveSha256']) for r in index['runs']]
for filename,digest in items:
    p=SOURCE/filename;assert hashlib.sha256(p.read_bytes()).hexdigest()==digest
    with zipfile.ZipFile(p) as z:
        for info in z.infolist():
            path=(ROOT/info.filename).resolve()
            assert path.is_relative_to((ROOT/'data/research').resolve()),'Unsafe archive member'
            data=z.read(info)
            if path.exists():assert path.read_bytes()==data,'Refusing to overwrite changed evidence: '+info.filename
            else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print('Native development evidence unpacked; no model key or network was used.')
