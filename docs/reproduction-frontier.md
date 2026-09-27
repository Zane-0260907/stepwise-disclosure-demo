# Reproduce the current disclosure planner

[中文说明](reproduction-frontier.zh-CN.md) · [Results and development history](../evidence/frontier-study/README.md) · [Proof and assumptions](live-frontier-proof.md)

## 1. Run the interface without a key

Install Node.js 24, then run from a fresh checkout:

```sh
npm ci
npm start
```

Open <http://127.0.0.1:4793/>. Select **Real model plan · Local capability changes**. The default method uses the compressed planner with a 0% extra field budget. Start the run; the timeline advances automatically. Click a step to inspect its actual HTTP body, receiver record and planning statistics. Use **Follow current step** to resume following after inspecting an earlier step. Switch between Chinese and English in the upper right.

The saved DeepSeek response proposes a calculation program. This run performs new calculations and new loopback HTTP requests; it makes **no new model call**. A local capability is withdrawn after the first calculation. One valid result is reused and two remaining requests reach the receiver. Compare **Restart all after the change** to see the extra work. The intervention is registered in advance, not a fault discovered by a model. The short plans do not distinguish the optimum of greedy and exact planning; the separate planning study tests that difference honestly.

The interface paces events for reading. Recorded execution time excludes this presentation delay. Inspect **Files**, **Preview**, and the downloadable trace after completion. To try a new provider call, follow the [bring-your-own-key guide](reproduction-v8.md); model access is optional, paid and outside offline reproduction.

## 2. Recompute published results without a model or Python solver

```sh
npm test
node scripts/verify-frontier-study.mjs
python scripts/analyze-frontier-study.py --check
node scripts/sync-paper-evidence.mjs --check
python scripts/audit-paper.py
```

The last three Python checks need only Python 3.10+ and its standard library. Expected planner output: **4,380 recorded paths checked and 144 final optimal settings re-solved**. The verifier recomputes costs, feasibility and final JavaScript solutions against preserved independent MILP optima; it does not run a new MILP here. The analyzer verifies the published tables and timing summary exactly, without rewriting them.

To repeat the real HTTP execution integration:

```sh
python -m zipfile -e evidence/validation-v8/reproduction-records.zip .
node scripts/run-live-integration.mjs --check
```

Expected: **480 executions and 522 HTTP receipts**. These are 48 saved plans × five conditions × two executors, originating from 24 questions and 96 earlier model calls. IDs, timestamps and elapsed time naturally change; deterministic request bodies, results, disclosure sets and counters must match. Receivers bind to random loopback ports and close automatically.

## 3. Run the independent optimizer again

Use a separate Python environment (Python 3.10–3.12 tested dependency range):

```sh
python -m venv .venv-frontier
# Linux/macOS:
source .venv-frontier/bin/activate
# PowerShell instead:
# .\.venv-frontier\Scripts\Activate.ps1
python -m pip install -r requirements-frontier.txt
node scripts/run-disclosure-study.mjs --out=data/research/frontier-local
```

This regenerates the fixed 48 final workloads and three budgets, and reruns greedy, the retirement-only ablation, the full planner and the independent SciPy/HiGHS model. It writes its own protocol, source snapshots and 1,728 run rows below `data/`, **not over the published evidence**. A completed output directory is refused; use a new name for another attempt. If `python` resolves outside the virtual environment, set `PYTHON` to the environment's executable before running Node.

The optimizer's objective is lexicographic `(new recipient-qualified disclosure items, work, transmitted fields)`, subject to the shared field budget. A record with `label-limit`, `error`, a time limit, or an unproved solver status is a failure, not an optimal result. Final published outcomes are 144/144 full-planner optima, 129/144 ablation completions, and 48/144 greedy optima. Runtime varies by hardware; exact integer objective triples should agree.

## 4. Measure performance on your machine

Close other heavy jobs first, then run:

```sh
node scripts/time-disclosure-study.mjs --out=data/research/frontier-timing
```

The script uses the published final workloads, one warm-up and five measured repetitions, rotating method order. It recomputes greedy inside the timer. JavaScript measurements include planning; Python measurements include MILP construction and solving, but exclude imports and IPC. Results go to a new local `timing.json`. The published machine is recorded in [machine.json](../evidence/frontier-study/machine.json). There was no dedicated CPU isolation; compare distributions and failures, not a single minimum runtime.

## 5. Files and interpretation

| File | Role |
| :-- | :-- |
| `src/research/bounded-disclosure-frontier.mjs` | Component decomposition and common-budget combination |
| `src/research/lex-frontier.mjs` | Live-token state, retired count and lexicographic dominance |
| `src/research/live-model-execution.mjs` | Versioned execution, persistent history, actual request dispatch |
| `scripts/frontier-milp.py` | Independent integer model |
| `evidence/frontier-study/final/` | Frozen inputs, algorithm snapshots, all results and serial timings |
| `evidence/frontier-study/integration-records.json` | Actual reexecutions and receiver bodies |
| `evidence/frontier-showcase/` | Bilingual screenshots and their underlying trace |

All alternatives must return the same registered logical output; future feasibility must not depend on prefix representation. Components factor **cost**, not execution order. Full disclosure history is never erased; an unknown future step triggers a new plan with that complete history. Token counts do not measure semantic privacy. Relaxing the field budget can lower distinct disclosed items while increasing repeated transmissions. The solver does not correct an erroneous model-generated program.

## Troubleshooting

- **Port occupied:** set `DEMO_PORT=4794` and restart; on PowerShell use `$env:DEMO_PORT='4794'`. Open the new port.
- **No model records:** extract the v8 archive before running integration checks. The browser's bundled example does not need this extraction.
- **Missing SciPy:** install `requirements-frontier.txt` in the Python selected by `PYTHON`. Offline verification needs no SciPy.
- **Output already exists:** choose a new `--out=data/...` directory. Do not delete the published evidence to rerun a study.
- **Cross-platform floating-point timing:** timings need not match; integer objectives and deterministic requests must.
- **UI validation:** install Playwright Chromium on Linux (`npx playwright install chromium`), start the server, then run `npm run test:frontier-ui`. Windows uses installed Edge by default. `DEMO_BASE` overrides the server URL.

The Chinese manuscript is an editable research draft. Author ORCIDs, deferred video and independent human ratings are separate outstanding items, not claims established by these scripts.
