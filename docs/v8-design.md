# V8: model-originated execution graphs with disclosure-aware repair

This revision keeps the original local/cloud execution and recipient-view question. It connects new DeepSeek tool calls to the repair controller rather than pooling a prior model study with an unrelated controlled run. The model reads the task, requests a table schema, and submits a finite calculation graph. That actual tool response creates the executable steps. Source and capability changes remain explicitly controlled interventions, not spontaneous model behavior or production incidents.

## Prespecified questions

1. Can a model-originated graph execute, detect a changed dependency, retain valid completed nodes and produce a checked result in one saved run?
2. Does continuation planning improve distinct disclosure over a matched greedy repair controller on those graphs?
3. Does a constraint on repeated numeric-field transmission avoid the earlier unbounded objective's adverse traffic tradeoff? The constraint applies to the currently known pending graph, not to unknown future work or arbitrarily many state changes.

The default budget is the greedy continuation's numeric-field count (no extra fields). Prespecified secondary budgets allow 10% and 25% more. Raw HTTP bytes are measured separately; a field-count bound is not a byte bound. The original unconstrained method remains in the comparison and all failures remain in the denominator. No sensitivity or information-theoretic privacy guarantee is inferred from field counts.

## Scope and measurement

Public FinQA pages and original labels are selected before new model calls, excluding company-year reports used in v4–v6. Multi-operation cases are selected using the existing declared compatibility filter. Published dataset split and selection provenance are preserved; a source dev-split example can be held out from our development but is not relabeled as the dataset's official test split. Public data may have been seen during model training.

The runtime accepts only finite, side-effect-free programs. Local and remote arithmetic capability profiles are explicit deployment constraints, not claims that arithmetic intrinsically requires a cloud model. The remote receiver executes the chosen raw-subgraph or operand view over real loopback HTTP. The model gateway makes actual DeepSeek calls and independently records provider-bound requests. Model tokens, model calls, operator calls, graph work, numeric disclosure, numeric transmissions and raw bytes are reported separately.

A graph node may receive raw source cells plus a registered expression, or already-computed operand values. Both forms have the same numeric semantics under the finite interpreter. Future-node disclosure identities use graph identity and source versions; the planner need not evaluate future numeric results to compare sets. Exact selection assumes equivalent alternatives and representation-independent continuation feasibility. Worst-case search remains exponential and bounded explicitly.

Source updates are scored against the original gold expression evaluated on the changed source, alongside the unmodified original label check. Program execution consistency and natural-language task correctness remain separate. A correct numeric result from a model-proposed wrong expression does not prove semantic correctness.

Development cases and transport diagnostics are excluded from the prospective test. The final code, prompts, inputs, event schedule, methods and evaluator are frozen before collection. Any defect found after freezing requires preserving the original protocol and disclosing the correction; no silent replacement of unfavorable outputs.
