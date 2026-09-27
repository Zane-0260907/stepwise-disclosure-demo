# Reproduce dynamic disclosure repair (v7)

[中文](reproduction-v7.zh-CN.md) · [Design and assumptions](v7-design.md) · [Frozen evidence](../evidence/validation-v7/)

## 1. Install and open the demo

Use Node.js 24. The browser demo does not require Python, a model account or a key.

```sh
git clone https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
npm start
```

Open `http://127.0.0.1:4793/`. Keep the server terminal open. Switch to **EN** if needed. If the port is occupied, stop your previous server or set `DEMO_PORT=4794` and use that port. The server binds to loopback, not a public authenticated service.

## 2. Watch a fresh, inspectable execution

Select the **limit changes** repair case in the case selector, then **Frontier repair** and run. The UI retains the approved layout: execution in the middle; the selected step's input, recipient and receipt on the right.

1. The registered quote calculation completes.
2. A controlled event changes the limit before the next prepared request is dispatched.
3. The old request is invalidated. Click that step: it has no receiver receipt.
4. Repair preserves the completed quote, whose inputs did not change, and executes the remaining operations under the new limit.
5. Click an executed step to inspect its current continuation, disclosure history, exact sent fields and independent HTTP receipt. Download the report or trace.

Run the same case with **Full restart**. Compare the number of remote executions and reused results, not the length of the animation. The fixture parameters and change event are the same. The result card distinguishes actual execution time from deliberately paced presentation time.

Three further cases remove local capability, revoke one recipient, or append a registered step. Changes are deterministic test events, not model-generated discoveries. These cases run actual numeric operators in a separate local HTTP process. They are **not DeepSeek calls**. Existing recorded DeepSeek entries separately demonstrate real model-originated fact requests, lookups and table calculations. Live model execution uses the reader's own key; a replay needs none.

## 3. Recompute the published results without a key

From the repository root:

```sh
npm test
python -m zipfile -e evidence/validation-v7/reproduction-records.zip .
npm run verify:v7
```

Use `python3` where that is your Python command. Extraction needs only the Python standard library. On Windows you can instead use:

```powershell
Expand-Archive -LiteralPath evidence/validation-v7/reproduction-records.zip -DestinationPath . -Force
npm run verify:v7
```

Expected output: **1,728 executions, 3,684 HTTP receipts, 576 FreshCtx boundary checks**. The verifier checks frozen source/input hashes, reconstructs version changes, independently computes arithmetic results, matches raw receiver bytes and hashes, recomputes per-recipient disclosure sets, and requires all case/method pairs. It does not call a model or need FreshCtx installed to verify saved evidence.

The archive extracts to `data/research/validation/frozen-v7-20260927/`. It contains one JSON record per execution and a batch manifest. `evidence/validation-v7/scores.jsonl` contains one recomputed row per execution; `summary.json` includes every change stratum.

## 4. Execute the entire experiment yourself

FreshCtx 0.16.0 supports Python 3.10–3.13. Use Python 3.12 for the tested CI environment. It is a real external library, pinned by version and wheel hash, with no runtime dependencies in its base install.

```sh
python -m venv .venv-v7
```

PowerShell:

```powershell
.venv-v7/Scripts/python.exe -m pip install --require-hashes -r requirements-v7.txt
$env:FRESHCTX_PYTHON=(Resolve-Path .venv-v7/Scripts/python.exe).Path
npm run test:external-v7
npm run experiment:v7 -- --run-id=my-v7-01
npm run verify:v7 -- --run-id=my-v7-01
```

Bash:

```bash
.venv-v7/bin/python -m pip install --require-hashes -r requirements-v7.txt
export FRESHCTX_PYTHON="$PWD/.venv-v7/bin/python"
npm run test:external-v7
npm run experiment:v7 -- --run-id=my-v7-01
npm run verify:v7 -- --run-id=my-v7-01
```

The runner rotates method order and resumes only missing jobs. Keep the original archive untouched and choose a fresh alphanumeric/hyphen run ID. A new named run saves its summary in an analysis/ subdirectory, not over the published summary. No paid model calls occur. Do not run two processes with the same run ID concurrently.

If you change frozen core code, source verification deliberately fails. Create a separate protocol, inputs and run name before collecting new results; do not edit a checksum simply to make old data appear compatible with new code.

## 5. What the six methods mean

| ID | Boundary check | Continuation / recovery |
| :-- | :-- | :-- |
| `payload_only` | Only directly transmitted source fields | Greedy repair; intentionally incomplete-dependency ablation |
| `full_restart` | Complete value and planning dependencies | Frontier planner; discard completed results after invalidation |
| `selective_greedy` | Same complete dependencies | Per-step greedy choice; retain valid pure results |
| `selective_frontier` | Same complete dependencies | Set-union frontier over known remaining steps; retain valid pure results |
| `freshctx_restart` | Actual pinned FreshCtx, same complete dependencies | Our full-restart wrapper |
| `freshctx_frontier` | Actual pinned FreshCtx, same complete dependencies | Our frontier and repair wrapper |

FreshCtx observes separate versioned files, establishes a reasoning dependency, then checks the action boundary after mutation. Its JSONL audit is preserved. The wrapper's restart behavior is **our experimental choice**, not a missing library capability. This is component integration, not an end-to-end performance comparison against ATR, MINIM or PlanTwin.

## 6. Understand the measurements

The 288 cases are **4 step orders × 6 numeric parameterizations × 12 change events**. Each runs six methods once. They are controlled parameter variants, not 288 unrelated real-world tasks or 1,728 LLM tasks.

- Contract compliance requires current versions, current authorization and correct completed outputs; when every execution route is revoked, stopping is required. Thus 288/288 compliant means **264 completed + 24 correctly blocked**, not 288 completed.
- A stale dispatch and an unauthorized dispatch are separate. A monotone-version mismatch can be conservative, including an ABA event, without exposing an unauthorized field.
- Distinct disclosure counts `(recipient, field, value/source-version fingerprint)` once per run. A transmitted derived value counts. Receiver collusion and inference are not modeled.
- Transmitted fields count repeated transmissions again. Less distinct disclosure can mean more traffic.
- Remote executions are actual requests to the isolated local HTTP operator. They are not cloud model calls.
- Execution timing excludes UI pacing. FreshCtx uses a Python/file bridge; no cross-language runtime speedup is claimed.

Frontier repair has **588** remote executions versus **672** for full restart (−12.5%). Against greedy repair, unique disclosure decreases **834→810 (−2.9%)**, while transmitted fields increase **1,002→1,548 (+54.5%)**. Preserve both sides when reporting the result.

## 7. Separate model evidence and plots

The earlier corrected v6 study contains **600 tasks and 1,210 real DeepSeek calls** on 60 public table pages. It is a separate population. Follow [its guide](reproduction-v6.md) to reproduce those scores or make new paid calls. The numerical accuracy interval crosses zero; v7 does not remove that limitation.

```sh
python -m pip install -r requirements-plots.txt
python scripts/plot-v7.py --lang en
python scripts/plot-v7.py --lang zh
```

Panels a–e use v7 scores; panel f explicitly refers to the separate v6 study. On Linux, install an appropriate Chinese font (for example Noto Sans CJK) to regenerate the Chinese plot. Published figures are provided in PNG, SVG and PDF.

## 8. Troubleshooting and artifact limits

`FROZEN_SOURCE_CHANGED` means bytes differ from the frozen protocol. Use a clean checkout and preserve `.gitattributes`; Windows/Ubuntu CI checks those same bytes. `ModuleNotFoundError: freshctx` means `FRESHCTX_PYTHON` points to the wrong interpreter. A bridge integration error aborts the run instead of becoming a favorable blocked result.

`FRONTIER_BOUND_EXCEEDED` is an explicit failure, not a greedy fallback. The default 4,096-label bound and worst-case exponential search are documented. Exactness assumes equivalent registered alternatives and continuation feasibility independent of their representation. No optimum is promised for future undiscovered steps, free-text semantics or arbitrary side effects.
