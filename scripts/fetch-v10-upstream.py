"""Fetch a pinned upstream source tree without modifying the product checkout."""
import hashlib,io,json,pathlib,urllib.request,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
REV='b7ea9074c1cba482b30687fecdb5c8425fd6f619'
OUT=ROOT/'data/research/v10-upstream';OUT.mkdir(parents=True,exist_ok=True)
archive=OUT/'upstream.zip'
if not archive.exists():
    with urllib.request.urlopen(f'https://codeload.github.com/sierra-research/tau2-bench/zip/{REV}',timeout=90) as response:
        archive.write_bytes(response.read())
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='578fed48ad285ffcac9506b933fdb46020ce2dfd10435934ba8aa5c5a2e3c94f','Pinned archive digest mismatch'
with zipfile.ZipFile(archive) as z:
    prefix=z.namelist()[0]
    for entry in z.infolist():
        name=entry.filename[len(prefix):]
        if entry.is_dir() or not (name.startswith('src/') or name in ['pyproject.toml','LICENSE','README.md']):continue
        relative=pathlib.PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe archive member')
        target=OUT/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(entry))
files={p.relative_to(OUT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((OUT/'src').rglob('*.py'))}
(OUT/'source-manifest.json').write_bytes(json.dumps({'repository':'sierra-research/tau2-bench','revision':REV,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':files},indent=2).encode())
print(json.dumps({'revision':REV,'pythonFiles':len(files),'archiveBytes':archive.stat().st_size}))
