# Reproduce the current evidence

The release separates **watching a recorded run**, **re-scoring preserved experiments**, and **making new provider calls**. A replay never claims to be a new experiment.

## 1. Watch without a key

Install Node.js 24, clone the repository, run `npm ci`, then `npm start`. Open <http://127.0.0.1:4793/>. No Python or model account is required for this path.

Use the recorded-run list for:

1. **Request missing facts:** a contract clause initially lacks the day count; inspect the model's request, the local grant, the next model input, and the result. An unnecessary contract amount and an erroneous prose comparison are deliberately preserved.
2. **Public table · local calculation:** inspect the outbound question/schema and the numeric cells kept locally, then select the local calculation to see the expression and dependency record.
3. **Public table · all values / selected cells:** replay the same source under the other methods. These three extra demonstration calls are not included in the batch totals.

The UI applies readable playback intervals. The result panel reports original execution time separately. Fast local arithmetic and fast model responses are not slowed inside the measured engine.

## 2. Verify the published runs without a key

Prerequisites: Node.js 24 and Python 3.10+ (standard library only for extraction).

```sh
npm ci
npm run verify:release
npm test
python -m zipfile -e evidence/validation-v4/finqa/reproduction-records.zip .
python -m zipfile -e evidence/validation-v4/controls/reproduction-records.zip .
npm run verify:v4
node scripts/verify-financial-showcase.mjs
```

On systems where Python is named `python3`, substitute `python3` for `python`. Run commands from the repository root. Extraction writes only ignored `data/research/validation/` records. It does not install packages or call a model.

Expected totals:

| Suite | Cases | Methods | Repeats | Tasks | Provider requests |
|:--|--:|--:|--:|--:|--:|
| Same-capability controls | 32 | 4 | 2 | 256 | 272 |
| Restricted FinQA test subset | 40 pages | 3 | 2 | 240 | 320 |

Verification checks:

- Frozen source/input/label hashes match the pre-call protocol.
- Every planned case × method × repeat exists once; failures remain in the denominator.
- Saved outcomes are recomputed from raw run records, not copied from the summary.
- Numeric programs are interpreted again against the original fixture; answers and dependencies must match.
- Every model receiver request matches a distinct provider-egress record, including the recorded deterministic `thinking: disabled` addition.
- All provider records are accounted for. A missing or unmatched record fails verification.

`summary.json`, `case-aggregates.json`, `scores.jsonl`, `failures.json`, and `RESULTS.md` are reproducible outputs under each `evidence/validation-v4/<suite>/` directory. The two frozen source files with CRLF endings have explicit Git attributes so a Linux checkout preserves their pre-run bytes.

## 3. Run a fresh experiment with your own DeepSeek key

New experiments are paid provider calls. The adapter is fixed to DeepSeek's `deepseek-flash` endpoint in non-thinking mode. Model versions, provider service and costs can change; new outputs are not expected to be byte-identical.

Windows PowerShell:

```powershell
$secret = Read-Host 'DeepSeek API key' -AsSecureString
$env:DEEPSEEK_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
npm run experiment:finqa -- --run-id=my-finqa-01
npm run experiment:controls -- --run-id=my-controls-01
Remove-Item Env:DEEPSEEK_API_KEY
```

Bash:

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm run experiment:finqa -- --run-id=my-finqa-01
npm run experiment:controls -- --run-id=my-controls-01
unset DEEPSEEK_API_KEY
```

Each command prints its record directory. With a chosen `--run-id`, an interrupted command resumes **only missing job IDs**; completed failures are not silently rerun. Use a new ID for a genuinely new experiment. Omitting the ID creates a fresh timestamped directory automatically. The published archive directories are not overwritten.

Names beginning with `v1-` through `v4-` or `frozen-` are reserved. A resumed directory must have the same protocol. A `running.lock` prevents two processes from writing the same experiment; after a process crash, confirm it has stopped before removing that one lock file and resuming.

Re-score those new records separately:

```sh
node scripts/verify-v4.mjs --finqa --run-id=my-finqa-01
node scripts/verify-v4.mjs --controls --run-id=my-controls-01
```

Their reports go to `data/research/validation/<run-id>/analysis/`. The published summary remains unchanged. A provider billing/authentication error stops new scheduling; already completed jobs and errors remain on disk.

The original `scripts/run-v4.mjs` is frozen for provenance. Use `run-new-experiment.mjs` for a fresh study; it uses the same frozen engines, prompts, schemas and evaluator, with an isolated output directory.

## 4. What the methods test

| Suite | Method ID | Behavior |
|:--|:--|:--|
| Controls | `joint` | Same local rules; initial view; authorized model-originated missing-fact requests |
| Controls | `no_acquisition` | Removes the missing-fact tool only |
| Controls | `allowed_eager` | Same local rules; sends every permitted business field, excluding all five private-field types |
| Controls | `numeric_prefetch` | Same local rules; adds all registered numerical task fields to the initial view |
| FinQA | `eager_allowed` | Sends question, schema and all table numbers; model proposes a program; local interpreter computes |
| FinQA | `requested_cells` | Sends schema; model requests up to 12 cells once; program may use only those cells |
| FinQA | `local_program` | Sends question/schema only; local interpreter reads the returned program's dependencies |

The FinQA final answer is assembled locally in every method. No numeric result is sent back to the model. A source-field count of zero therefore describes one deliberately restricted route, not a proof of semantic privacy.

## 5. Data and scoring

FinQA is pinned to commit `0f16e2867befa6840783e58be38c9efb9229d742`. See `fixtures/finqa-v4/provenance.json` and `LICENSE.FinQA`. Selection is deterministic: table-only gold evidence; 3–80 parseable numeric cells; supported arithmetic; uniquely locatable operands; one question per page; hash ordering. Forty selected pages cover 38 company-year reports and 28 companies. Six development entries are distributed; three were used for interface/prompt smoke tests before the freeze.

The executor receives only the question, schema and source values. It never loads `labels.json`. Original `exe_ans` is checked with absolute tolerance 0.00005. Ratio/sign conventions are stated uniformly in all method prompts. Selection excludes many FinQA tasks, so these numbers must not be presented as full-benchmark results. Public data may have appeared in model training.

For the synthetic controls, labels and cases remain the published v3 versions. The study is a re-evaluation with stronger controls, **not an unseen holdout**. Counts of extra fields use the frozen task labels; an authorized field can still be unnecessary.

For uncertainty, average repeats within each case. Sample company-year reports as clusters for FinQA, preserving all cases in a sampled report and computing the case-weighted mean; sample cases for synthetic controls. Paired bootstrap uses 4,000 draws and a fixed seed. Intervals describe the selected samples, not a business population or a non-inferiority test.

## 6. Figures and failure inspection

```sh
pip install -r requirements-plots.txt
python scripts/plot-v4.py --lang en
python scripts/plot-v4.py --lang zh
```

PNG, editable-text SVG and PDF outputs are written to `evidence/validation-v4/`. CJK labels require Microsoft YaHei on Windows or Noto Sans CJK on Linux. Charts use the verified summary and per-run timings; they do not generate measurements.

Open `failures.json`, locate `runId`, then inspect `data/research/validation/<protocol-id>/<runId>.json`. For FinQA, compare `programCertificates` with the model tool call and original label program. Rejected expressions, incorrect cell selection, sign/ratio mistakes and wrong-but-executable calculations are retained.

## 7. Troubleshooting

| Symptom | Action |
|:--|:--|
| Node reports a PDF.js engine/version error | Use Node.js 24, then run `npm ci` again. |
| Port 4793 is busy | Set `DEMO_PORT=4794` in the local environment before `npm start`; open that port. |
| Live execution is disabled | Set `DEEPSEEK_API_KEY` **before** starting the server; restart it. Replays need no key. |
| `ENOENT ... complete.json` during verification | Extract both v4 archives from the repository root first. |
| `PROTOCOL_CHANGED` | Preserve frozen files. Put algorithm changes in a new version with a new protocol. |
| New run verifies against the wrong folder | Pass the same `--run-id` and the correct `--finqa`/`--controls` flag. |
| UI test cannot find a browser | Install a Playwright Chromium browser or set `EDGE_PATH` to an installed browser executable. |
| A model response is rejected | Inspect the saved error and original response; a completed request can still be an invalid task result. |

The server is a single-user research application bound to localhost. It does not require releasing your model account, commercial client or customer data.
