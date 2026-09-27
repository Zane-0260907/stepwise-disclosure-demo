# Dynamic execution and disclosure repair

This revision returns to the original question: an agent discovers new work while execution capabilities, source values or recipient authorization may change. A view valid for the previous step is not automatically appropriate for the next one.

## Prior art and contribution boundary

PlanTwin already combines sanitized cloud planning and local enforcement. ATR (arXiv:2609.08015v1, September 2026) already records executable decision premises and selectively revalidates affected actions. FreshCtx 0.16.0 is an open implementation of action-boundary evidence revalidation. Incremental invalidation, dependency graphs, optimistic checks and minimum-set search are not claimed as inventions here.

The extension investigated here is a bounded **recipient-aware repair planner**. It combines executable alternative input contracts, a monotone record of what each recipient has already received, and validity checks over both value and execution-decision dependencies. On a new step or changed condition, it selects a feasible continuation over the currently known steps. It does not assume knowledge of undiscovered future steps. It does not revoke knowledge already disclosed.

Every alternative has a registered executable semantics and a declared sufficient input representation. The prototype does not infer semantic sufficiency from free text. A local aggregate remains a disclosure unit when it is sent. Counting recipient/field/version pairs is an operational measure, not a privacy-loss theorem.

## Algorithm

For a pending step, enumerate registered alternatives whose capability and authorization are current. Each alternative contributes a set of recipient/field/version tokens and a nonnegative work cost. Start from the already-disclosed set. Extend labels one step at a time; discard a label only when another label has a subset of its disclosed tokens and no greater work. Finally minimize newly disclosed tokens, then work, then a deterministic identifier order. Candidate output semantics are equivalent within the registered operation contract, so labels have the same continuation feasibility. Without that assumption the dominance rule would be unsound.

This finite set-union dynamic program is exact over the listed alternatives and the currently known ordered continuation. Worst-case frontier size is exponential. It is not a general semantic optimizer, a novel generic dynamic-programming method or an online competitive guarantee. A separate Cartesian enumerator checks its objective on 250 seeded bounded instances in `test/disclosure-frontier.test.mjs`.

### Why pruning is sound under these assumptions

At the same continuation depth let labels be `(E1,w1)` and `(E2,w2)`. If `E1` is a subset of `E2` and `w1 <= w2`, adding any identical feasible suffix `(F,c)` gives `E1 ∪ F ⊆ E2 ∪ F` and `w1+c <= w2+c`. Thus the second label cannot have a better final lexicographic objective. Every feasible path is either retained or dominated by a retained path; induction over the ordered steps proves bounded exactness. This argument fails if the choice changes which suffixes are feasible or what the final result means. Registry authors, not the optimizer, establish equivalence.

Greedy failure example: two steps can each use recipient A's same two raw fields. Recipient B can instead receive one derived field for the first step and two different derived fields for the second. Greedy initially prefers B; the final union has at least three units. Choosing A twice discloses only two distinct units but transmits four fields. This illustrates the measured disclosure/traffic tension, not an additional experimental result.

### Complete candidate dependencies and pure-result reuse

The decision certificate includes value reads and capability, authorization and endpoint reads for **every currently considered alternative**, not just the selected payload. Otherwise a newly enabled local implementation would leave an obsolete outbound choice looking current. Derived fields carry transitive per-field source versions. Version counters are monotone, including when a source changes and later returns to its old value.

Completed pure results depend only on their value reads; a changed limit does not invalidate an earlier quote that did not read it. No effectful tool result is automatically cached or retried. Disclosure history is conservatively reserved before dispatch and never rolled back. Local checks and receiver receipts do not provide remote atomicity, cloud-provider attestation or protection from a compromised controller.

## Revision protocol

1. Keep all earlier frozen data and code unchanged.
2. Use controlled mutations to distinguish source changes, unused-field changes, capability changes, recipient revocation, recipient replacement, new steps, and repeated source versions.
3. Compare matched alternatives and identical event schedules: payload-only validation, full restart with complete checks, greedy selective repair, and the set-union continuation planner. Include the actual pinned FreshCtx library as a boundary component with an explicitly documented restart policy; do not attribute our wrapper's restart choices to the library.
4. Save independent HTTP receiver records and compare results with a separately implemented declarative oracle. Local simulation endpoints are not cloud-model calls. Preserve the previous real DeepSeek study as a separate utility experiment.
5. Freeze test inputs, source hashes, metric definitions and method order before the final run. Development examples are labelled separately. Show all event strata and failures; repeated deterministic runs are not independent task evidence.

The intended demo retains the approved layout: execution on the left, the chosen recipient view, changed dependencies, previous disclosure and repair evidence on the right.

## Observed result

The frozen run completed all 1,728 method/case executions. Frontier repair reduces remote operations by 12.5% versus restart. Compared with greedy repair it reduces distinct disclosure units by 2.9%, while increasing transmitted fields by 54.5%. FreshCtx-backed variants reproduce the corresponding native-check outcomes; this supports replacing the check component, not a superiority claim over FreshCtx. [Complete reproduction and boundaries](reproduction-v7.md).
