# Disclosure-state planning study

[Reproduce in English](../../docs/reproduction-frontier.md) · [中文复现](../../docs/reproduction-frontier.zh-CN.md) · [Proof](../../docs/live-frontier-proof.md) · [Initial protocol](../../docs/frontier-study.zh-CN.md)

The final experiment evaluates an exact finite-choice optimizer, not model intelligence or semantic privacy. Its contribution is to retire suffix-irrelevant token identities from search state, preserve their cumulative count, use lexicographic dominance, and combine disclosure-disjoint components under one transmission budget. The runtime retains full recipient history and restores original execution order. Established dynamic programming and frontier-search techniques are acknowledged.

## Final results

48 constructed workloads × three budgets = **144 settings**. Six families, lengths 8/16/32/64, two seeds per cell. Final cost/history draws start at seed 91000. The families were used during development; these are fresh draws, not a held-out real-world domain. Three repetitions produce 1,728 method records, not additional independent tasks.

| Method | Completed | Same optimum as MILP | Peak retained states in completed cases |
| :-- | --: | --: | --: |
| Greedy | 144/144 | 48/144 | 1 |
| Retirement-only ablation | 129/144 | 129/144 | 3,867 |
| Complete mechanism | 144/144 | 144/144 | 287 |
| Independent SciPy/HiGHS MILP | 144/144 | 144/144 | n/a |

The ablation reaches its 4,096-state limit in 15 settings. All failures remain in the denominator. The complete mechanism has fewer disclosure items than greedy in 87 settings. Its objective includes work and fields after disclosure count, explaining why 96 greedy settings miss the full lexicographic optimum.

| Extra field budget | Disclosure items: full / greedy | Fields: full / greedy | Disclosure reduction | Transmission change |
| :-- | --: | --: | --: | --: |
| 0% | 1,060 / 1,081 | 1,602 / 1,603 | 1.94% | −0.06% |
| 25% | 923 / 1,081 | 1,906 / 1,603 | 14.62% | +18.90% |
| 100% | 784 / 1,081 | 2,342 / 1,603 | 27.47% | +46.10% |

Each row contains the same 48 workloads. More repeated transmissions can buy fewer different disclosure items. Neither quantity measures inferred sensitive information.

## Corrected serial timing

The initial confirmation/final runners cached the greedy reference before timing it. Those raw development records remain intact, but **their greedy elapsed values are not valid performance measurements**. All published performance claims instead use `final/timing.json`: one warm-up, five measured repetitions, real recomputation, rotated method order, no concurrent experiment jobs. No dedicated CPU isolation was used.

| Method | Median of per-setting medians (ms) | P95 (ms) | Maximum setting median (ms) |
| :-- | --: | --: | --: |
| Greedy | 0.050 | 0.286 | 0.412 |
| Retirement-only | 0.797 | 164.973 | 480.951 |
| Complete mechanism | 0.529 | 4.950 | 379.994 |
| Independent MILP | 2.750 | 133.514 | 2,109.445 |

Only completed settings enter timing summaries; completion counts above must accompany them. JavaScript includes planning; MILP includes construction and solving, excluding imports and IPC. Hardware and versions are in `machine.json`. This is not a universal speed guarantee.

## Real HTTP integration and source model quality

`integration-records.json` contains **480 new executions and 522 actual loopback HTTP receipts**: 48 preserved plans × five conditions × old/new executors. All complete and agree with the given program; deterministic request bodies and disclosure counters are checked. There are **zero new model calls**. The source study remains 24 FinQA questions, 48 plans, 96 genuine model calls, and **28/48 original-label agreement**. Compression does not fix incorrect model programs. The earlier reduction from 331 to 261 HTTP calls belongs to result reuse, not this new planner.

## Development record and source identity

| Location | What it contains |
| :-- | :-- |
| Root `protocol/workloads/records.json` | Initial full-state versus retirement experiment: 48 constructed workloads plus 48 saved plans; 36 full-state and five retirement failures. Five synthetic families contain structural replicas despite different seed labels; do not count these as 48 distinct topologies. |
| `confirmation/` | Seed-81000 cost/history draws; component decomposition alone still failed on large connected components. |
| `final/` | Seed-91000 final freeze with component decomposition and stronger lexicographic dominance; all outcomes published. |
| `development-integration/` | Earlier integration using the basic retirement runtime; superseded by the final 480-run integration, retained for provenance. |
| `frozen-source/` under each stage | Exact source bytes named and hashed in that stage's pre-run protocol. |

During integration, the new solver initially occupied `src/research/disclosure-frontier.mjs`, a name already used by the older v7 module. Full regression tests caught this collision. The old v7 module was restored; the new solver moved **without changing its bytes** to `src/research/bounded-disclosure-frontier.mjs`. Frozen sources retain the historical filename. `verify-frontier-study.mjs` checks the current solver against that exact frozen digest, as well as `lex-frontier.mjs`. Runner imports and local output options were then corrected without rewriting the frozen runs. New runs recompute greedy inside the timer and preserve their own sources.

The initial protocol mentions optional public-program extensions. No additional FinQA program benchmark was added: the real-model component is precisely the original 48 plans. The final seed and methods are specified in each stage's JSON protocol; the initial prose was retained as a development plan, not rewritten retroactively.

## What can be checked

`verify-frontier-study.mjs` checks all **4,380 successful recorded paths** across development and final stages and solves the 144 final settings again. `test/live-frontier.test.mjs` separately compares 250 seeded small problems with exhaustive enumeration. These are correctness tests, not task samples. `analyze-frontier-study.py --check` recomputes the paper tables; `run-live-integration.mjs --check` actually reexecutes the HTTP chain.

The guarantee requires finite, output-equivalent alternatives and representation-independent future feasibility. Large overlapping components can still exceed the resource limit. Unknown future steps, arbitrary network bypasses and semantic information leakage are outside the optimization guarantee.
