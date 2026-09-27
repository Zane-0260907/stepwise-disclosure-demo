"""JSON-lines adapter around unchanged, pinned upstream domain tools.

Only the optional top-level tau2 convenience imports are bypassed. Domain
functions, tool schema generation, data models and DB hashing are upstream.
No evaluator labels are reachable through the agent-facing command set.
"""
import importlib,json,os,pathlib,sys,types
ROOT=pathlib.Path(__file__).resolve().parents[1]
UPSTREAM=ROOT/'data/research/v10-upstream/src'
DATA=ROOT/'data/research/v9-sources/tau/data'
os.environ['TAU2_DATA_DIR']=str(DATA)
# Namespace package avoids importing voice/orchestrator dependencies we do not use.
package=types.ModuleType('tau2');package.__path__=[str(UPSTREAM/'tau2')]
sys.modules['tau2']=package;sys.path.insert(0,str(UPSTREAM))
sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8')
kit=None;domain=None
def plain(value):
    if hasattr(value,'model_dump'):return value.model_dump(mode='json')
    if isinstance(value,list):return [plain(x) for x in value]
    if isinstance(value,dict):return {k:plain(v) for k,v in value.items()}
    return value
def handle(message):
    global kit,domain
    command=message['command']
    if command=='init':
        domain=message['domain']
        if domain not in ['retail','airline']:raise ValueError('UNKNOWN_DOMAIN')
        model=importlib.import_module(f'tau2.domains.{domain}.data_model')
        module=importlib.import_module(f'tau2.domains.{domain}.tools')
        db_type=getattr(model,'RetailDB' if domain=='retail' else 'FlightDB')
        cls=getattr(module,'RetailTools' if domain=='retail' else 'AirlineTools')
        kit=cls(db_type.load(DATA/'tau2/domains'/domain/'db.json'))
        return {'tools':[t.openai_schema for t in kit.get_tools().values()],
                'mutatingTools':[n for n,f in kit.tools.items() if getattr(f,'__mutates_state__',False)],
                'policy':(DATA/'tau2/domains'/domain/'policy.md').read_text(encoding='utf-8'),
                'dbHash':kit.db.get_hash()}
    if kit is None:raise ValueError('NOT_INITIALIZED')
    if command in ['call','validate']:
        name=message['name'];args=message.get('arguments',{})
        tools=kit.get_tools()
        if name not in tools:raise ValueError('UNKNOWN_TOOL')
        # Use the native generated Pydantic argument schema before dispatch.
        validated=tools[name].params.model_validate(args).model_dump()
        if command=='validate':return {'valid':True}
        before=kit.db.get_hash()
        try:result=plain(kit.use_tool(name,**validated));error=None
        except Exception as exc:result={'error':str(exc)};error=type(exc).__name__
        return {'result':result,'errorType':error,'dbBefore':before,'dbAfter':kit.db.get_hash(),
                'mutatesState':bool(getattr(kit.tools[name],'__mutates_state__',False))}
    if command=='snapshot':return {'dbHash':kit.db.get_hash(),'db':kit.db.model_dump(mode='json')}
    raise ValueError('UNKNOWN_COMMAND')
if __name__=='__main__':
    for line in sys.stdin:
        try:
            message=json.loads(line);result={'ok':True,'result':handle(message)}
        except Exception as exc:result={'ok':False,'error':type(exc).__name__+': '+str(exc)}
        print(json.dumps(result,ensure_ascii=False),flush=True)
