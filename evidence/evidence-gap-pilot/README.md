# Evidence-gap pilot — development result

[中文协议](../../docs/evidence-gap-pilot.zh-CN.md)

**The candidate did not pass the mechanism gate.** Three development batches
made 104 actual DeepSeek calls (438,115 reported tokens), matched to 104 distinct
provider transport records. They reused four source tasks; 41 attempted runs
are not 41 independent tasks. All failures and the budget-stopped batch remain
in the archives. See [Chinese analysis](review.zh-CN.md) and [batch manifest](batches.json).

In the final batch, the strong on-demand baseline and candidate both completed
four runs, had identical per-task source-span scores, and each used 15 model
calls. They disclosed 38,462 and 39,611 distinct source characters respectively.
These are source-volume measurements, not semantic privacy risk. Switching the
controller while fixing each saved model response changed **0 of 8** observed
trajectories. Different independent model runs cannot explain a controller
benefit when this intervention does not change execution.

The candidate adds source-anchored reference repair when an agent submits
evidence. The on-demand control has the same search, batch reference-resolution
and source-reading tools. Both receive byte-identical initial requests. This
checks a controller decision policy, not a new claim about inventing graph
retrieval, field masking, delayed query evaluation or local result reuse.

Twenty-four original CUAD training-source contracts are selected by source hash,
excluding the eight contracts already used in v9. Answer annotations are held
in a separate evaluation file. The first live canary is fixed to the first four
sources and four methods. Failures are retained and batches never auto-expand.

`source-audit.json` reports whether explicit references in the **entire initial
retrieval view** point to an unseen, uniquely located heading chunk. An agent's
actual selected evidence may not contain those references. A match neither
proves that the target matters nor that the whole target section was retrieved.
Unmatched, ambiguous and external-document references are not guessed.

The parser was corrected during development for references mistaken as headings
and decimal headings without a trailing period. Both controllers share these
fixes. These are parser repairs, not measured task improvements.

## Reproduce preparation

```sh
python scripts/fetch-v9-sources.py
python scripts/prepare-v9-development.py
python scripts/prepare-gap-pilot.py
node scripts/audit-gap-inputs.mjs --check
node --test test/evidence-gap.test.mjs
python test/gap-score.test.py
```

The first two commands rebuild the existing pinned source/exclusion inputs;
they do not run a model. Original source notices remain with the downloaded
material. No private commercial application files are needed.

## Optional live canary

To run a new development attempt, configure `DEEPSEEK_API_KEY` locally and keep
`node scripts/start-native-proxy.mjs` running in one terminal. On Windows,
`powershell -ExecutionPolicy Bypass -File scripts/start-native-proxy.ps1` offers
a hidden-input prompt and does not save the key to disk. In a second terminal:

```sh
node scripts/run-gap-pilot.mjs --run-id=gap-canary-01
python scripts/score-gap-pilot.py --run-id=gap-canary-01
node scripts/verify-gap-pilot.mjs --run-id=gap-canary-01
```

Use a new run ID for another development attempt. The runner freezes code and
inputs before the first paid call. It never reads the answer file. The scorer
penalizes redundant output and counts failed tasks as zero, including when the
gold answer is empty. Its span score is a development diagnostic, not the
official CUAD evaluation, legal judgment or a semantic-disclosure metric.

The verifier executes the frozen controller with saved model responses, checks
request bytes, and matches each response-bearing call to a different actual
provider transport record. That offline verification makes no new model calls.
Connection tokens and API keys must never be included in an evidence package.

## Verify released evidence

Extract the three `gap-canary-0*-records.zip` archives into the repository root.
They contain frozen code, original requests/responses, source inputs, evaluation
labels, and only the matching provider records. Authentication headers, keys
and connection files are not included. The dataset material retains its CUAD
CC BY 4.0 notice. After extraction, for example:

```sh
node scripts/verify-gap-pilot.mjs --run-id=gap-canary-03
python scripts/score-gap-pilot.py --run-id=gap-canary-03
node scripts/audit-gap-intervention.mjs --run-id=gap-canary-03
```

The old unavailable proxy was subsequently replaced by a temporary local
process for these calls, then stopped. No additional experiment is running.
This candidate is not promoted into the manuscript or approved product UI.
