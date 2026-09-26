# Correction to the earlier public-table experiments

During v5 failure analysis, we found that the v4/v5 adapter treated some multirow year headers as business numeric cells. A schema-only request therefore lost column-year meanings that should have remained visible. Incomplete merged headings could also produce ambiguous flattened column names. This affected the interpretation of the published v4 and newly frozen v5 table comparisons.

The old records, scores, protocols and code remain unchanged. Their observed error rates are real outcomes **under that flawed adapter**, not clean evidence that hiding business values inherently causes the reported utility loss. In particular, the v4 difference of −13.75 percentage points must not be treated as a general property of local computation. Synthetic contract/study controls did not use this table converter.

## Repair and new evaluation

`src/research/table-view.mjs` verifies numeric values against the original structured table, preserves source coordinates, promotes leading unit/year header rows to structural metadata, and replaces business cells with references. It retains ambiguous header grids instead of inventing merged spans. Non-numeric data cells are masked when their role cannot be resolved. A runtime reconstruction checks the fixture cache against the original table. This is an input-correctness repair, not an algorithmic novelty claim.

V6 applies the same corrected representation to all five methods. Its 60 test pages exclude every company-year report used in prior v4/v5 evaluation or development. Six exposed v5 discrepancies and six v4 development questions were used to check the correction. The protocol was frozen before any v6 test outcome. All 600 tasks, including errors and possible source-label inconsistencies, are retained.

V6 `local_once` achieves 98/120 versus 96/120 for `full_once`, with a paired report-cluster interval spanning zero. **Different batches cannot isolate the causal effect of the repair.** The new batch supports only its own controlled comparisons. Three-proposal conflict review achieves 96/120 at 368 calls, compared with 98/120 at 120 calls for single-pass local calculation. We retain it as an experimental mechanism rather than declaring it superior.

## What readers should use

- Current quantitative claims and main paper figure: [`validation-v6`](../evidence/validation-v6/).
- Current UI example: [`corrected-showcase`](../evidence/corrected-showcase/), a development example excluded from test totals.
- Earlier public-table comparisons: historical, subject to the limitation above.
- Original request binding and synthetic-control evidence: separate mechanisms, unchanged by this repair.

No test labels were sent to the model, no failed tasks were deleted, and no original labels were changed to fit model answers. Full upstream model-training exposure is unknown.
