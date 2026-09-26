# Reproduce the current evidence

The current numerical experiment is **v6: 600 tasks, 1,210 real DeepSeek requests, 60 pages, 57 company-year reports**. It uses corrected source-table roles. Old results remain available; read the [table-adapter correction](table-adapter-correction.md) before interpreting v4/v5 numerical comparisons.

## 1. Run the interface without a key

Install Node.js 24, then run from the repository root:

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4793/`. The browser UI and local rule executor need no Python, model account or commercial client.

Choose **Structure check · local calculation** in the saved-run list. The run advances automatically. Select these steps in order:

1. **Verify table structure and numeric roles**: the source has a multirow header. Years are column descriptors, not business values to hide.
2. **Plan the current calculation**: the right pane shows the question, schema, source header positions and values retained locally. Expand the actual request to inspect exact serialized bytes.
3. **Execute the calculation locally**: the model's bounded expression reads two local working-capital values. The result is approximately `0.2543097574`, a fraction representing a 25.43% change.
4. Compare **Structure check · all values** on the same input. Both runs are preserved real calls. The example is from development and is excluded from the 600-task evaluation.

The **Request missing facts** replay separately demonstrates a model asking for a missing day count. It also asks for an unnecessary amount and gives a flawed prose comparison; neither defect is removed. The **Cited clause** case demonstrates discovery of a reference lookup with a separate recipient view. The optional revocation scenario deliberately pauses for a decision; ordinary runs do not require repeated clicks.

Replay intervals are adjusted for readability. Original execution time is shown separately and used in measurements. A replay is never a new provider experiment. `Trace`, `Files`, `Preview`, and report/record downloads expose the same saved run.

## 2. Recompute all current scores without a key

Python 3.10+ is used only for standard-library ZIP extraction here; substitute `python3` if needed.

```sh
npm test
python -m zipfile -e evidence/validation-v6/reproduction-records.zip .
npm run verify:v6
node scripts/verify-corrected-showcase.mjs
```

Expected final totals: `jobs: 600`, `verifiedProviderCalls: 1210`, `verifiedPrograms: 1310`, `reports: 57`. The additional showcase has **3 runs / 5 provider requests**, excluded from experiment counts. Its verified programs and outbound bodies can be checked independently.

| Method | Correct / planned | Business cells per task | Calls |
|:--|--:|--:|--:|
| `full_once` | 96/120 | 14.833333 | 120 |
| `local_once` | 98/120 | 0 | 120 |
| `requested_cells` | 94/120 | 2.416667 | 236 |
| `blind_review` | 95/120 | 0 | 366 |
| `conflict_review` | 96/120 | 0.075 | 368 |

The verifier does not trust summary totals. It checks:

- every frozen source/fixture/label hash, distinct planned job IDs and exclusion of prior company-year reports;
- reconstruction of the corrected view from original table cells and numeric-role assignments;
- scores recomputed against original FinQA labels, including every failure;
- every candidate program reinterpreted locally, normalized signatures, minimum conflict covers and final-program choice;
- actual transmitted fields and values, exact schema/header structure, receipt byte lengths and SHA-256 digests;
- a distinct provider record for each request/response pair, including the adapter's fixed `thinking: disabled` addition;
- case-level averaging and paired report-cluster bootstrap intervals, with all 1,210 provider records accounted for.

Extraction writes ignored `data/research/validation/prospective-v6-20260927/`. Verification makes no provider calls. `summary.json`, `scores.jsonl`, `case-aggregates.json`, `failures.json`, and `RESULTS.md` are regenerated under `evidence/validation-v6/`.

## 3. Make new calls with your own key

For an interactive live run on Windows, `./scripts/start-demo.ps1 -UseDeepSeek` securely prompts for a key. Restart the existing server after configuration. The service binds to localhost and has no multi-user authentication.

For a complete new 600-task experiment, use a new run ID. This makes paid provider calls:

```powershell
$secret = Read-Host 'DeepSeek API key' -AsSecureString
$env:DEEPSEEK_API_KEY = [System.Net.NetworkCredential]::new('', $secret).Password
try {
  npm run experiment:v6 -- --run-id=my-v6-01
} finally {
  Remove-Item Env:DEEPSEEK_API_KEY
}
node scripts/verify-v6.mjs --run-id=my-v6-01
```

Bash:

```bash
read -rsp 'DeepSeek API key: ' DEEPSEEK_API_KEY; echo
export DEEPSEEK_API_KEY
npm run experiment:v6 -- --run-id=my-v6-01
unset DEEPSEEK_API_KEY
node scripts/verify-v6.mjs --run-id=my-v6-01
```

The API key is never part of a browser payload or published record. Provider identity is DeepSeek, not an Alibaba model. Some historical internal proxy environment-variable names remain for compatibility; the endpoint verifier enforces `https://api.deepseek.com/chat/completions`.

A repeated run ID resumes **missing job IDs only** and checks protocol identity. Completed wrong answers and errors are not retried to improve scores. A running lock prevents concurrent writers; after a crash, confirm that its process has stopped before removing only that experiment's lock. Completed published experiments cannot be overwritten. New summaries go to `data/research/validation/<run-id>/analysis/`, not the publication evidence directory.

Model behavior and service versions may change. Recomputing published records is deterministic; new paid calls need not produce identical answers or times.

## 4. Method and sampling details

All methods use the same corrected structure, model, authorization and finite interpreter. `full_once` sends all business values; `local_once` proposes a program without business values; `requested_cells` asks for up to 12 authorized cells before planning and can only compute from approved cells. The two review methods use the same three independent planning instructions and the same review instruction. Only `conflict_review` supplies an additional bounded numeric view on disagreement. It is experimental; it is not the default.

The pinned upstream [FinQA repository](https://github.com/czyssrs/FinQA/tree/0f16e2867befa6840783e58be38c9efb9229d742) is MIT-licensed. Selection is restricted to table-only questions with supported gold operators and uniquely locatable operands. Original annotation programs are used to define this compatibility subset and the evaluator, **not model inputs**. All reports used by v4/v5 test or development are excluded. Fixed SHA ordering chooses one question per page; v6 contains 60 pages from 57 reports and 38 companies. Twelve previously exposed examples were development data. This is not the full FinQA benchmark and is not proven unseen by model training.

Zero business-value transmission does not hide question text, row labels, years, units, schema shape, or program structure. Some source annotations may be inconsistent; retained outcomes are not relabeled after observing a failure. The adapter handles the documented structured-table patterns, not arbitrary PDF extraction.

For a program with `m` nodes, local execution and dependency traversal are linear. The optional conflict cover has at most three pairwise obligations; bounded search is exact for those **syntactic** obligations. It is neither a proof of semantic necessity nor an accuracy certificate. [Mechanism and limits](conflict-view.md).

## 5. Interpret uncertainty and failure cases

The original numeric answer is checked with absolute tolerance `0.00005`. Correctness includes successful completion and receipt integrity. Displayed percentages are fractions unless a question explicitly requests percentage-point differences. Field transmissions are summed over actual requests, including duplicates. Runtime includes schema reconstruction and core execution but excludes replay pacing.

Two repeats are averaged within each case, then company-year reports are resampled with replacement 4,000 times, preserving paired methods. The reported intervals are descriptive, not population guarantees. `local_once − full_once` is **+1.67 percentage points, interval −5.83 to +9.02**; it does not establish superiority or non-inferiority. Conflict review is slower and has no established utility advantage. Eighteen conflict-review tasks agree structurally across all three candidates but still answer incorrectly.

Open `failures.json`, locate `runId`, then inspect that run and its provider requests in the extracted directory. Finite-program validity, task correctness and information disclosure are distinct checks. Human assessment of free-text explanation quality remains pending.

## 6. Redraw and inspect

```sh
pip install -r requirements-plots.txt
python scripts/plot-v6.py --lang en
python scripts/plot-v6.py --lang zh
```

PNG, SVG and PDF outputs come from saved records. The Chinese Word source and native equation cache are in `paper/zh-CN/`; use its README for rebuilding. The manuscript is a Chinese editorial draft, not an accepted or submission-certified English ACM paper.

Optional browser checks use Playwright and a running server: `npm run test:corrected-ui`. On Windows the script uses installed Edge; on Linux run `npx playwright install chromium`. Override the server URL with `DEMO_BASE`. Cross-platform CI verifies published evidence without a key; browser screenshots are separately checked on Windows.

## 7. Historical evidence

V5 retains 600 tasks / 1,579 calls from the earlier adapter. Extract `evidence/validation-v5/reproduction-records.zip`, then run `npm run verify:v5`. Its negative outcomes informed the subsequent adapter diagnosis; it is not a holdout for v6 development. V4 has 256 synthetic-control tasks and 240 earlier public-table tasks. Their separate [guide](reproduction-v4.md), hashes and archives remain intact. Never pool versions into one claimed independent sample.

If a frozen-hash check fails, use a clean checkout instead of regenerating the protocol. If the port is occupied, stop your own previous server or set `DEMO_PORT`. If a live call fails, retain its recorded error; the replay and verification paths remain usable offline.
