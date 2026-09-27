# Model plans, disclosure budgets and selective execution

V8 connects **new actual DeepSeek tool calls** to the disclosure controller. The provider first returns an `inspect_source` call and then a `submit_calculation` call. The controller validates that finite graph, executes registered operations, applies a declared state change, keeps valid results and continues with an authorized input view.

This is an independently runnable research repository. It does not include the commercial client or any account key. A DeepSeek model is an external service, not part of the source release.

## 1. Run the visual walkthrough without a key

```sh
git clone https://github.com/Zane-0260907/stepwise-disclosure-demo.git
cd stepwise-disclosure-demo
npm ci
npm start
```

Open http://127.0.0.1:4793/. Choose **Real model plan · Local capability changes**, then **Bound transmissions · reuse valid results** and **Run task**.

1. The left timeline loads the preserved real model responses and creates the proposed calculation steps.
2. A local addition completes. The declared intervention removes the local arithmetic capability.
3. The valid addition remains available. The remaining operations execute through actual loopback HTTP.
4. Select the final division on the left. The right pane shows the chosen view, remaining field budget, values actually received and raw request digest.
5. Run **Restart all after the change** on the same case. Use **Compare this case** to see repeated work. This comparison is a fresh pair of executions, not the batch experiment.
6. Switch to **A used source value changes** or **An unused source value changes** to inspect invalidation versus reuse. **Trace**, **Files**, **Preview** and downloadable evidence retain their existing roles. English and Chinese use the same execution state.

The model plan is saved; local calculations and HTTP requests are **new**. This mode makes zero new paid model calls. The receiver is a loopback listener in the same Node process, not a production external arithmetic service or an independently attested process. Presentation pacing does not alter measured runtime. The schema and source question remain visible in the original language.

## 2. Verify the frozen study without a key

Windows PowerShell:

```powershell
Expand-Archive -LiteralPath evidence/validation-v8/reproduction-records.zip -DestinationPath . -Force
npm run verify:v8
node scripts/analyze-v8.mjs
```

Linux/macOS:

```sh
unzip -o evidence/validation-v8/reproduction-records.zip -d .
npm run verify:v8
node scripts/analyze-v8.mjs
```

`verify:v8` checks frozen source hashes, the two provider payloads and original responses, graph provenance, every receiver body and response, source changes, intermediate-result versions, local capability, cumulative fields and phase budgets. A separate arithmetic evaluator checks the proposed program and reference expression. It does not need network access or Python. Read [the verifier amendment](../evidence/validation-v8/verifier-amendment.md) before inspecting the original frozen verifier.

Expected totals:

| Observation | Published result |
|:--|--:|
| Source questions / previously unused company-year reports | 24 / 24 |
| Actual provider calls / proposed plans | 96 / 48 |
| Conditions × controllers × plans | 5 × 6 × 48 = 1,440 |
| Model plans agreeing with original unmodified labels | 28 / 48 |
| Completed / program-consistent executions, each controller | 240 / 240 |
| Changed-state reference-expression agreement, each controller | 137 / 240 |
| Restart / repair external operator requests | 331 / 261 |
| Restart / repair numeric fields transmitted | 724 / 500 |
| Greedy / frontier / budget-0 distinct disclosure units | 425 / 425 / 425 |

The 30 arms for one model plan share the same two actual provider calls. **Do not multiply 96 by 30**, or treat the 1,440 arms as independent model conversations. Model requests contain questions, headers and schema, but no business-value dictionary. The numeric-disclosure metric describes the arithmetic recipient and is not a privacy guarantee for the whole prompt.

## 3. Collect a new paid batch

Set your own `DEEPSEEK_API_KEY` locally. PowerShell can prompt without echoing it:

```powershell
$v8Secret = Read-Host 'DeepSeek key' -AsSecureString
$v8Credential = [pscredential]::new('local', $v8Secret)
$env:DEEPSEEK_API_KEY = $v8Credential.GetNetworkCredential().Password
try {
  npm run experiment:v8 -- --run-id=my-v8-run
} finally {
  Remove-Item Env:\DEEPSEEK_API_KEY -ErrorAction SilentlyContinue
  $v8Credential = $null
  $v8Secret = $null
}
npm run verify:v8 -- --run-id=my-v8-run
```

In bash, use `read -rsp 'DeepSeek key: ' DEEPSEEK_API_KEY; export DEEPSEEK_API_KEY`, run `npm run experiment:v8 -- --run-id=my-v8-run`, and then `unset DEEPSEEK_API_KEY`. Do not put the literal key in a committed file or pasted command. Calls use `deepseek-flash`, temperature 0 and non-thinking mode. The fixed study requests 96 calls; provider charges and model availability are external to this repository.

Outputs go to `data/research/validation/my-v8-run/`; verification writes its analysis there, **not over the published results**. A rerun with the same ID resumes already saved records and validates the protocol identity. Completed model failures stay in the records; there is no selective retry. For a genuinely new batch, use a new ID. Do not run two collectors with the same ID concurrently. New model responses need not reproduce old numbers exactly.

## 4. Understand the comparison

- **Restart greedy:** same model graph, views and checks; discard completed pure results after a change.
- **Repair greedy:** keep valid results; choose the next view greedily.
- **Repair frontier:** keep valid results; compare equivalent views for the known pending graph.
- **Budget 0/10/25:** same frontier with a phase budget relative to that phase's greedy continuation. The default allows no additional numeric fields; the balance is carried forward after each step.

All-local and mixed capability profiles are explicit deployment configurations. Arithmetic does not inherently require a cloud model. State changes are controlled interventions after roughly half the proposed nodes, not spontaneous model discoveries. The reference program and original labels are read only by the evaluator, not supplied to the model or controller.

The budget constrains **numeric-field occurrences in the current unchanged phase**. It is not an HTTP byte bound, a bound across future interventions, or a semantic privacy theorem. Identical disclosure tokens sent again still count toward transmissions. Future intermediate values are identified by expression and source versions without precomputing their numeric values.

## 5. Inspect failures and limits

- [Summary](../evidence/validation-v8/summary.json), [per-run scores](../evidence/validation-v8/scores.jsonl), [supplemental analysis](../evidence/validation-v8/analysis.json).
- [All 20 disagreements](../evidence/validation-v8/disagreements-for-review.json). Two average questions have suspect original reference programs; independent human adjudication is pending. Scores are not corrected or filtered.
- The frontier and all three budgets match the greedy controller on this batch. No incremental frontier benefit is established. Reuse reduces calls by 21.1% relative to full restart.
- Raw byte totals include different-length method identifiers. `analysis.json` separately removes `runId` when comparing payload lengths; this is a derived measure, not the raw wire count.
- The 24 questions are a restricted public table subset, not private customer data. Twelve come from the original test split and twelve from dev, all explicitly retained in provenance. Public data may occur in model training.
- No independent human text-quality evaluation, production trial, adversarial privacy guarantee, arbitrary tool side effects or target-side transaction guarantee is claimed.

## 6. Files and checks

| Path | Purpose |
|:--|:--|
| `src/research/model-repair-v8.mjs` | Frozen model protocol, graph execution and HTTP receiver |
| `src/research/budget-frontier-v8.mjs` | Disclosure frontier and carried transmission budget |
| `src/research/model-showcase-v8.mjs` | Adapter to the existing visual interface |
| `fixtures/model-repair-v8/` | Public inputs, original labels, selection and license |
| `evidence/validation-v8/protocol.json` | Prospective source and evaluation freeze |
| `evidence/validation-v8/reproduction-records.zip` | Complete 48 model records and 1,440 execution records |
| `evidence/model-showcase-v8/` | Example model record, source table, bilingual screenshots and UI check |
| `test/model-repair-v8.test.mjs` | Exhaustive-search oracle comparison and execution tests |

Run `npm test`, `npm run verify:v8`, and `npm run verify:release`. With the server running, `npm run test:model-ui` checks automatic progress, both languages, actual receiver content, no overflow and a stable PDF preview. Set `DEMO_BASE` if using a port other than 4793. The old v1–v7 protocols remain preserved and verified in CI.
