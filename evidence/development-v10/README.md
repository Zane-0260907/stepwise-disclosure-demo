# Native multi-turn development evidence

This is a reproducible **development checkpoint**, not a new successful paper result. It replaces read-only derived questions with six original state-changing retail/airline tasks. The main paper and web UI remain the stable version. [中文完整结论](../../docs/v10-development-review.zh-CN.md).

The final matched probe obtains reference-database agreement on 5/6 full-context runs, 4/6 reversible-reference runs and 6/6 scoped-reference runs. The additional binding guards activate zero times. Those differences between sampled conversations therefore do **not** establish a causal advantage of the guards. Reversible references already hide the same six predefined tool-return fields. Neither method is automatic semantic minimization or a new placement algorithm.

All ten development batches are retained: 54 attempts over **six unique training tasks**, 952 actual provider calls and 4,485,819 tokens. Diagnostics, failures and superseded prompts are included; there is no held-out result. `analysis.json` separates the final matched settings from earlier debugging. Full-database agreement is not the official tau2 reward or an independently reviewed policy score.

## What is original and what is adapted

- Upstream: [tau2-bench](https://github.com/sierra-research/tau2-bench/tree/b7ea9074c1cba482b30687fecdb5c8425fd6f619), MIT licensed. `upstream-native.zip` contains the unchanged Python source and the retail/airline databases, policies, tasks and split files. Each source byte was compared with the pinned upstream archive. See `LICENSE.tau2-bench` and `index.json`.
- Adapter: only the root package's optional voice/orchestrator imports are bypassed. Native domain functions, argument schemas and database hashing are retained. A custom text loop uses DeepSeek for the agent and user simulator; it is not the full official harness.
- Confirmation: state-changing tools can be wrapped in a local confirmation panel. This common substrate is available to all matched arms. It is not claimed as a new consent algorithm.
- Scope: all business mutations affect a fresh in-memory benchmark database. No real orders, payments or bookings are changed.

## Offline reproduction without a model key

Requirements: Node.js 24, Python 3.12. Run from this repository's root. The web application does not require these Python dependencies; they are for this optional benchmark adapter.

```sh
git clone --branch codex/dynamic-tasks-v10 https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
python scripts/unpack-native-v10.py
python -m venv data/research/v10-python
```

Activate the environment:

```powershell
# Windows PowerShell
.\data\research\v10-python\Scripts\Activate.ps1
```

```sh
# Linux / macOS
. data/research/v10-python/bin/activate
```

Then install hash-locked dependencies and reproduce every batch:

```sh
python -m pip install --require-hashes -r requirements-v10.txt
python scripts/check-all-native-v10.py
```

The checker verifies archived source/input hashes, one distinct provider record per call, tool observations, local reference bindings, original tool re-execution, final database state and the recomputed summary. It makes **no API calls**. Expected totals are 10 batches, 54 attempts, 952 provider records. A result saying `completed` does not imply the final state matches.

For one batch only:

```sh
node scripts/verify-native-v10.mjs dev-v10-matched-scoped-02
python scripts/audit-native-v10.py dev-v10-matched-scoped-02 --check
python scripts/analyze-native-v10.py --check
```

Frozen evaluators are explicitly recorded as **post-run audit snapshots**. This development audit was not prospectively registered as a held-out experiment. The strict final-state comparison runs reference actions in a separate fresh database; the execution agent receives no reference actions.

## New live calls with your own key

Use a local `DEEPSEEK_API_KEY` environment variable. It must not enter Git or a browser bundle. In one terminal, after environment activation:

```sh
node scripts/start-native-proxy.mjs
```

In another terminal, from the same checkout:

```sh
python scripts/prepare-v10-tasks.py
node scripts/run-native-v10.mjs --run-id=dev-v10-my-run --view=scoped --confirm=local
```

Do not reuse a run ID: existing protocols are protected from overwrite. The default is six development tasks, up to 40 agent calls and 20 user/confirmation calls per task; the batch stops after its call/token budget. Live outputs may differ from the frozen records. Stop the proxy with Ctrl+C when finished. This route uses the same approved single model; it does not require opening a commercial client or publishing an account key.

For a single case add `--cases=retail-native-87`. For the common-controls comparison use `--view=full` or `--view=tokenized` with `--confirm=local` and a new run ID. These are controls, not reference implementations of PlanTwin or another paper.

## What the privacy counts do and do not mean

Six predefined tool-return fields are replaced with local references: street lines, ZIP, email, card suffix and date of birth. Counts concern raw leaves in distinct tool messages actually submitted to the planning agent. User chat, other fields, inferences and recipient collusion are outside that metric. Overall request bytes and all actors' tokens are reported separately.

In production a local human would see the confirmation details. Here DeepSeek also simulates that human and receives the raw confirmation arguments. These calls are explicitly retained and counted. This experiment **does not establish end-to-end privacy from the model provider**. Human review of the simulator's approvals and dialogue quality remains pending.

## Files

| File | Purpose |
| :-- | :-- |
| `index.json` | Original source revision, archive digests and full batch inventory |
| `analysis.json` | Descriptive metrics, per-case scores and measurement limits |
| `dev-v10-*.zip` | Saved conversations, calls, states, provider records, frozen sources and audit snapshot |
| `upstream-native.zip` | Offline native environment source/data bundle under MIT |
| `LICENSE.tau2-bench` | Original upstream license |

The byte-level evidence proves what the adapter sent and what the native business functions did. It does not prove general privacy, natural-language correctness, technical novelty, acceptance prospects or an 8/10 evaluation.
