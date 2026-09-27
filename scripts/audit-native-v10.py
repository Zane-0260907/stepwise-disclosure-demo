"""Offline replay and independent reference-state comparison, with no LLM access."""
import json,pathlib,sys,hashlib,importlib.util,os
ROOT=pathlib.Path(__file__).resolve().parents[1]
name=sys.argv[1];assert name.startswith('dev-v10-') and '/' not in name and '\\' not in name
RUN=ROOT/'data/research/v10-runs'/name
protocol=json.loads((RUN/'protocol.json').read_text(encoding='utf-8'))
labels=json.loads((RUN/'frozen/labels.json').read_text(encoding='utf-8'))
cases={x['id']:x for x in json.loads((RUN/'frozen/cases.json').read_text(encoding='utf-8'))}
# Run each saved adapter version, with only its location-dependent roots moved
# back to the reproduction checkout. Original upstream tool functions remain
# hash-pinned and unmodified.
spec=importlib.util.spec_from_file_location('saved_native_bridge',RUN/'frozen/native_tau_bridge.py')
saved=importlib.util.module_from_spec(spec);spec.loader.exec_module(saved)
saved.ROOT=ROOT;saved.UPSTREAM=ROOT/'data/research/v10-upstream/src';saved.DATA=ROOT/'data/research/v9-sources/tau/data'
os.environ['TAU2_DATA_DIR']=str(saved.DATA);sys.modules['tau2'].__path__=[str(saved.UPSTREAM/'tau2')]
handle=saved.handle
protected={'address1','address2','zip','email','last_four','dob'}
sinks={'address1':['modify_pending_order_address','modify_user_address'],'address2':['modify_pending_order_address','modify_user_address'],'zip':['modify_pending_order_address','modify_user_address','find_user_id_by_name_zip'],'email':['find_user_id_by_email'],'dob':['book_reservation','update_reservation_passengers'],'last_four':[]}
def at(value,path):
    for key in path:value=value[key]
    return value
def leaves(value,path=()):
    if isinstance(value,dict):
        for key,item in value.items():yield from leaves(item,path+(key,))
    elif isinstance(value,list):
        for key,item in enumerate(value):yield from leaves(item,path+(key,))
    else:yield path,value
rows=[]
for cid in protocol['caseIds']:
    path=RUN/(cid+'.json')
    if not path.exists():rows.append({'caseId':cid,'status':'not-run'});continue
    record=json.loads(path.read_text(encoding='utf-8'));item=cases[cid]
    init=handle({'command':'init','domain':item['domain']});assert init['dbHash']==record['initialDbHash']
    refs={};created={e['token']:e for e in record.get('viewEvents',[]) if e['type']=='reference.created'}
    for action in record['actions']:
        if action.get('nativeExecuted') is False:
            current=handle({'command':'snapshot'})
            assert action.get('dbBefore')==action.get('dbAfter')==current['dbHash']
            assert action.get('errorType')=='AdapterValidationError'
            continue  # Controller refusal: no native state transition to replay.
        if 'plannerArguments' in action:
            current=handle({'command':'snapshot'})['db']
            for path,value in leaves(action['plannerArguments']):
                if isinstance(value,str) and value.startswith('local_ref_'):
                    assert value in refs,(cid,'unissued reference')
                    ref=refs[value];assert at(action['arguments'],path)==ref['value']
                    if record['method'].startswith('native-scoped'):
                        assert path[-1]==ref['field'] and action['name'] in sinks[ref['field']]
                        assert ref['source'] and at(current,ref['source'])==ref['value'],(cid,'stale reference executed')
                else:assert at(action['arguments'],path)==value
        try:actual=handle({'command':'call','name':action['name'],'arguments':action['arguments']})
        except Exception as exc:actual={'result':{'error':type(exc).__name__+': '+str(exc)},'errorType':'AdapterValidationError'}
        assert actual['result']==action['result'],(cid,action['name'],'different replay output')
        for key in ['dbBefore','dbAfter','errorType']:
            assert actual.get(key)==action.get(key),(cid,action['name'],key)
        observation=action.get('observation',action['result'])
        for path,value in leaves(action['result']):
            visible=at(observation,path)
            if visible==value:continue
            assert path[-1] in protected and isinstance(visible,str) and visible in created
            event=created[visible];assert event['field']==path[-1]
            if event['source']:assert at(handle({'command':'snapshot'})['db'],event['source'])==value
            prior=refs.get(visible)
            entry={'value':value,'field':event['field'],'source':event['source']}
            if prior:assert prior==entry
            refs[visible]=entry
    final=handle({'command':'snapshot'})
    assert final['dbHash']==record['finalDbHash']
    handle({'command':'init','domain':item['domain']});gold_errors=[]
    for action in labels[cid].get('actions',[]):
        result=handle({'command':'call','name':action['name'],'arguments':action['arguments']})
        if result['errorType']:gold_errors.append({'name':action['name'],'error':result['result']})
    expected=handle({'command':'snapshot'})
    for call in record['calls']:
        assert hashlib.sha256(call['requestBody'].encode()).hexdigest()==call['requestSha256']
        assert hashlib.sha256(call['responseBody'].encode()).hexdigest()==call['responseSha256']
    rows.append({'caseId':cid,'status':record['status'],'stateMatchesReference':final['dbHash']==expected['dbHash'] if not gold_errors else None,
                 'goldErrors':gold_errors,'protocolViolations':len(record.get('protocolViolations',[])),'finalDbHash':final['dbHash'],'referenceDbHash':expected['dbHash'],**record['metrics']})
out={'scope':'Original native tool/state replay. Exact full database comparison against reference actions; conversation policy compliance and natural-language assertions are not yet independently adjudicated. Not official full benchmark reward.',
     'rows':rows,'attempted':sum(r['status']!='not-run' for r in rows),'stateMatches':sum(r.get('stateMatchesReference') is True for r in rows)}
if '--check' in sys.argv:
    assert json.loads((RUN/'state-audit.json').read_text(encoding='utf-8'))==out,'Recorded state audit differs'
else:(RUN/'state-audit.json').write_bytes(json.dumps(out,ensure_ascii=False,indent=2).encode())
print(json.dumps(out,indent=2))
