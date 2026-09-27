# Frozen v7: dynamic execution and disclosure repair

[English reproduction](../../docs/reproduction-v7.md) · [中文教程](../../docs/reproduction-v7.zh-CN.md) · [Mechanism and proof boundary](../../docs/v7-design.md)

Frozen before final execution at the timestamp recorded in [protocol.json](protocol.json). Source and fixture hashes are checked by the runner and independent verifier. Development examples are separate from the final 288 controlled parameter combinations.

| Artifact | Purpose |
| :-- | :-- |
| [protocol.json](protocol.json) | Frozen sources, methods, event schedule, metric definitions and dependency pin |
| [reproduction-records.zip](reproduction-records.zip) | All 1,728 raw execution records plus batch manifest, including unfavorable ablation results |
| [scores.jsonl](scores.jsonl) | Independently recomputed per-execution scores |
| [summary.json](summary.json) | Aggregate and all twelve event strata |
| [English figure](tradeoffs.en.svg) / [中文图](tradeoffs.zh-CN.svg) | Measured outcomes and disclosure/traffic tradeoff |

## Results

Each method runs 288 cases. Required blocking is included in compliance, not task completion.

| Method | Compliant | Correct outputs | Stale dispatches | Unauthorized | Remote operations | Unique disclosures | Transmitted fields |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Payload-only ablation | 108 | 238 | 180 | 48 | 576 | 852 | 966 |
| Full restart | 288 | 264 | 0 | 0 | 672 | 870 | 1,884 |
| Greedy repair | 288 | 264 | 0 | 0 | 588 | 834 | 1,002 |
| Frontier repair | 288 | 264 | 0 | 0 | 588 | 810 | 1,548 |
| FreshCtx + restart | 288 | 264 | 0 | 0 | 672 | 870 | 1,884 |
| FreshCtx + frontier repair | 288 | 264 | 0 | 0 | 588 | 810 | 1,548 |

Full-dependency methods complete 264 feasible cases and correctly block the 24 all-revoked cases. Stale checks use a strict version contract; stale does not necessarily mean unauthorized. Correct arithmetic alone does not imply compliance.

In 84 cases repair saves one remote operation relative to restart; in 204 it saves none. Aggregate operations decrease 672→588 (12.5%). Against greedy repair, frontier repair decreases unique disclosure 834→810 (2.9%) but increases transmitted fields 1,002→1,548 (54.5%). Valid pure-result reuse totals 180 in each repair method. These are deterministic controlled cases, so repeated trials would not be independent statistical evidence.

The actual pinned FreshCtx library performed 576 checks. Its two variants match their corresponding native-check wrappers. Recovery policy belongs to our wrapper. No end-to-end advantage over a complete external agent system is established.

The verifier checks **3,684 independent HTTP receipts**. These are executions of registered arithmetic operators in a separate loopback process, not language-model calls. Plot panel f reuses the separately labeled v6 model evidence; its sample is not pooled with this experiment.
