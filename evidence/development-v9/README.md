# V9 development audit — not promoted to the paper

The candidate delays exposing local query results until an explicit observation. A strong baseline can already fuse a local query pipeline and return only its final projection. The developer study does not establish sufficient incremental benefit, so no held-out evaluation or replacement of the stable manuscript is claimed.

The main development set has 24 cases / 72 runs / 202 actual DeepSeek calls. It includes **16 author-derived read-only questions over original tau database records**, not original tau transaction tasks, and eight original CUAD questions. There is one model. Sources, selectors, failures, frozen code and distinct provider records are preserved. No private production data, account credentials, new human ratings, independent deployment or semantic privacy guarantee are claimed.

| Measurement | Full context | Strong local query | Deferred candidate |
|:--|--:|--:|--:|
| Completed / attempted | 24/24 | 23/24 | 23/24 |
| Exact database answers / 16 | 16/16 | 16/16 | 16/16 |
| Diagnostic contract span F1 | 0.6923 | 0.4423 | 0.5673 |
| Distinct source cells, summed over cases | 19,573 | 357 | 345 |
| Model calls | 58 | 72 | 72 |

The span score averages best predicted-span token F1 per gold span; it under-penalizes extraneous output. It is a diagnostic, **not official CUAD scoring, human-adjudicated correctness or evidence of non-inferiority**. Source cells are not independently annotated unnecessary disclosures. The 3.4% cell difference between the strongest control and the candidate is descriptive, with stochastic trajectories, not an established mechanism gain.

The paired cell counts tie on 18/24 cases, decrease on five and increase on one. Retail is identical; airline increases from 95 to 106 cells; contract decreases from 174 to 151 with the quality limitations above. `paired-audit.json` retains every pair. Each method has one trajectory per task, with no independent repetitions or human review.

```sh
python -m zipfile -e evidence/development-v9/dev-v9-strong-02-records.zip .
node scripts/verify-v9-development.mjs dev-v9-strong-02
python scripts/score-v9-development.py dev-v9-strong-02
python scripts/analyze-v9-development.py --check
```

The separate `dev-v9-canary-01-records.zip` preserves the initial three-case diagnostic, including an ambiguous flight-column adapter and a weaker pre-fusion control. Those defects were corrected **before** the newly named main development run. The archive contains the matching old inputs/code. Never pool this development sequence into a held-out score.

The scorer reads each run's own `frozen/labels.json`. Add `--check` to verify without overwriting the saved scores. `evaluation-snapshot.json` identifies the post-run evaluator snapshot; it is not a prospective registration. All the commands above run offline and make no provider requests. Node.js 24 and Python 3.10 or newer suffice for these checks; no Python packages are needed.

This release implements the initial three-way feasibility gate. The planned fixed-view, requested-field and external minimization comparisons, original multi-turn task environment, independent quality review and held-out batch remain incomplete. They are not credited as completed research.

See [the detailed Chinese audit](../../docs/v9-development-review.zh-CN.md) and [the scope/acceptance plan](../../docs/v9-plan.zh-CN.md).

## Sources and attribution

- Sierra Research, [tau-bench](https://github.com/sierra-research/tau2-bench), commit `b7ea9074c1cba482b30687fecdb5c8425fd6f619`, MIT. The original notice is in `LICENSE.tau-bench`. We flatten product variants and dated flight inventory and create new read-only questions; no original leaderboard result is asserted.
- The Atticus Project; Dan Hendrycks, Collin Burns, Anya Chen and Spencer Ball, *CUAD: An Expert-Annotated NLP Dataset for Legal Contract Review*, NeurIPS 2021. [Dataset repository](https://github.com/The-Atticus-Project/cuad), commit `67faa0e6023b04fcaae6cc09497ab00e5d63a2a2`. The publisher lists [CC BY 4.0](https://www.atticusprojectai.org/cuad/); [license text](https://creativecommons.org/licenses/by/4.0/). Original contract text is split into overlapping windows. Eight training-source questions/annotations are retained; they do not constitute legal advice or an endorsement by the original authors.

The SHA-256 source manifest records pinned downloads. Frozen snapshots and raw records live inside the archives under ignored `data/research/v9-runs/...` after extraction.
