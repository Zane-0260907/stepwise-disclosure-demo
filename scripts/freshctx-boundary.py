"""Pinned external guard, not a reimplementation. JSONL input and output.

Every declared dependency is a separate versioned file observation. The wrapper
changes those files between reasoning and action, then calls FreshCtx.run. This
uses full decision dependencies for both FreshCtx methods. Restart/repair after
a rejection belongs to our caller, not to FreshCtx.
"""
import json
import sys
import tempfile
from pathlib import Path
from importlib.metadata import version
from freshctx import MemoryStore, guard, observe, reasoning

if version("freshctx") != "0.16.0":
    raise RuntimeError("This protocol requires freshctx==0.16.0")

def check(request):
    with tempfile.TemporaryDirectory(prefix="disclosure-boundary-") as temporary:
        root = Path(temporary)
        files = {}
        for index, key in enumerate(request["dependencies"]):
            path = root / f"source-{index}.json"
            path.write_text(json.dumps({"value": request["before"][key], "version": request["beforeVersions"][key]}, sort_keys=True), encoding="utf-8")
            files[key] = path
        executed = []
        with guard(policy="block", store=MemoryStore(), audit_path=root / "audit.jsonl") as context:
            tokens = [observe(path) for path in files.values()]
            with reasoning("dispatch_registered_operation", depends_on=tokens) as decision:
                pass
            for key, path in files.items():
                path.write_text(json.dumps({"value": request["after"][key], "version": request["afterVersions"][key]}, sort_keys=True), encoding="utf-8")
            try:
                context.run(lambda: executed.append(True), depends_on=[decision])
            except Exception as error:
                # Only an expected stale-boundary rejection may be represented
                # as blocking; integration failures must abort the experiment.
                if "stale" not in str(error).lower() and "block" not in str(error).lower():
                    raise
        result = context.result
        return {"id": request["id"], "library": "freshctx", "version": version("freshctx"), "executed": bool(executed), "state": result.state.value if result else None,
                "dependencies": request["dependencies"], "audit": [json.loads(line) for line in (root / "audit.jsonl").read_text(encoding="utf-8").splitlines()]}

for line in sys.stdin:
    try:
        print(json.dumps(check(json.loads(line)), ensure_ascii=True), flush=True)
    except Exception as error:
        print(json.dumps({"integrationError": str(error), "type": type(error).__name__}), flush=True)
