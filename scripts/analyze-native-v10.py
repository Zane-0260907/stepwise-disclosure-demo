"""Descriptive development results; no held-out or causal superiority claims."""
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];RUNS=ROOT/'data/research/v10-runs';OUT=ROOT/'evidence/development-v10'
keys={'address1','address2','zip','email','last_four','dob'}
def leaves(x,path=()):
    if isinstance(x,dict):
        for k,v in x.items():yield from leaves(v,path+(k,))
    elif isinstance(x,list):
        for k,v in enumerate(x):yield from leaves(v,path+(k,))
    else:yield path,x
rows=[];inventory=[]
for folder in sorted(RUNS.glob('dev-v10-*')):
    protocol=json.loads((folder/'protocol.json').read_text(encoding='utf-8'))
    audit=json.loads((folder/'state-audit.json').read_text(encoding='utf-8'))
    records=[json.loads((folder/(c+'.json')).read_text(encoding='utf-8')) for c in protocol['caseIds']]
    inventory.append({'runId':folder.name,'attempts':len(records),'stateMatches':audit['stateMatches'],'calls':sum(len(r['calls']) for r in records),'tokens':sum(r['metrics']['totalTokens'] for r in records)})
    if not folder.name.startswith('dev-v10-matched-'):continue
    scores={r['caseId']:r for r in audit['rows']}
    for r in records:
        agent=[c for c in r['calls'] if c['role']=='agent'];raw=0;hidden=0;seen=set()
        for call in agent:
            for message in json.loads(call['requestBody'])['messages']:
                if message['role']!='tool' or message['tool_call_id'] in seen:continue
                seen.add(message['tool_call_id'])
                for path,value in leaves(json.loads(message['content'])):
                    if not path or path[-1] not in keys or value in [None,'']:continue
                    if isinstance(value,str) and value.startswith('local_ref_'):hidden+=1
                    else:raw+=1
        errors=[a['result'].get('error','') for a in r['actions'] if a.get('errorType') and isinstance(a['result'],dict)]
        guards=[e for e in errors if e in ['REFERENCE_PURPOSE_MISMATCH','STALE_OR_UNBOUND_REFERENCE','UNKNOWN_OR_EMBEDDED_REFERENCE']]
        rows.append({'runId':folder.name,'caseId':r['caseId'],'method':r['method'],'stateMatchesReference':scores[r['caseId']]['stateMatchesReference'],
          'agentCalls':len(agent),'userCalls':sum(c['role']=='user-simulator' for c in r['calls']),'localConfirmationCalls':sum(c['role']=='local-user-simulator' for c in r['calls']),
          'totalTokens':r['metrics']['totalTokens'],'agentRequestBytes':sum(len(c['requestBody'].encode('utf-8')) for c in agent),
          'protectedToolLeavesShownRaw':raw,'protectedToolLeavesReplacedByReferences':hidden,'bindingGuardRefusals':len(guards),
          'localUserRefusals':sum(e=='LOCAL_USER_DECLINED' for e in errors),'protocolViolations':len(r['protocolViolations'])})
summary=[]
for method in sorted({r['method'] for r in rows}):
    group=[r for r in rows if r['method']==method]
    summary.append({'method':method,'attempts':len(group),'stateMatches':sum(r['stateMatchesReference'] for r in group),**{k:sum(r[k] for r in group) for k in ['agentCalls','userCalls','localConfirmationCalls','totalTokens','agentRequestBytes','protectedToolLeavesShownRaw','protectedToolLeavesReplacedByReferences','bindingGuardRefusals','localUserRefusals','protocolViolations']}})
result={'scope':'Six original training tasks repeatedly used for development. Final matched configuration is descriptive, not held-out or independent from earlier probes.',
 'measurement':'Protected leaves count six predefined fields in distinct tool messages actually submitted to the agent. They exclude user chat and local-user simulator calls, and are not semantic privacy or unnecessary-disclosure scores. Full request bytes are reported separately.',
 'causalCheck':'If bindingGuardRefusals is zero, scoped checks did not alter these observed tool trajectories. Removing those checks while holding planner choices, references and confirmations fixed yields the same native calls. Differences between separately sampled conversations cannot be attributed to those checks.',
 'inventory':inventory,'matchedSummary':summary,'matchedCases':rows,'humanPolicyReview':'pending'}
path=OUT/'analysis.json'
if '--check' in sys.argv:assert json.loads(path.read_text(encoding='utf-8'))==result
else:path.write_bytes(json.dumps(result,ensure_ascii=False,indent=2).encode('utf-8'))
print(json.dumps({'totalAttempts':sum(x['attempts'] for x in inventory),'calls':sum(x['calls'] for x in inventory),'tokens':sum(x['tokens'] for x in inventory),'matchedSummary':summary},indent=2))
