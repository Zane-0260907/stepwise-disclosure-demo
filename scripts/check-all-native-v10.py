"""Verify all shipped native evidence offline, failing at the first discrepancy."""
import subprocess,pathlib,json,sys,os
ROOT=pathlib.Path(__file__).resolve().parents[1];os.chdir(ROOT)
index=json.loads((ROOT/'evidence/development-v10/index.json').read_text(encoding='utf-8'))
os.environ['LOGURU_LEVEL']='ERROR'
for run in index['runs']:
    name=run['runId']
    subprocess.run(['node','scripts/verify-native-v10.mjs',name],check=True)
    result=subprocess.run([sys.executable,'scripts/audit-native-v10.py',name,'--check'],check=True,capture_output=True)
    score=json.loads(result.stdout);print(json.dumps({'runId':name,'referenceStateMatches':score['stateMatches'],'attempts':score['attempted']}),flush=True)
subprocess.run([sys.executable,'scripts/analyze-native-v10.py','--check'],check=True)
print('All native development transport, state and descriptive-summary checks passed.')
