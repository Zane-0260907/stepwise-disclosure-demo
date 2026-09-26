# Bounded conflict views

This experimental mechanism asks whether disagreements among finite candidate programs can guide a small authorized numeric view. It combines known program-aided reasoning, candidate consistency and finite hitting-set search. It is not claimed as the first local planner, a new general hitting-set algorithm or a semantic privacy proof.

1. Obtain three independent value-free proposals with fixed instructions. Validate each through the same finite interpreter. Normalize commutative operands; keep source field IDs in expression signatures. Coincidentally equal numeric answers do not establish agreement.
2. For each distinct pair with dependency sets `D_i, D_j`, use their symmetric difference as a conflict set. If dependencies coincide but expressions differ, use their union. Intersect with authorized fields. At most three pairs exist.
3. Find a minimum-cardinality authorized set `K` intersecting every conflict set, with `|K| ≤ 3`. Branch on an uncovered set, pruning supersets larger than the best found solution or budget; break equal-cardinality ties lexicographically. Stop if no authorized cover exists.
4. If all three valid signatures agree, compute locally. Otherwise send candidate programs and the chosen fields to one review call, then validate and compute the new proposal locally. Invalid review output fails explicitly; it is not silently replaced by a prior answer.

The matched `blind_review` control uses the same proposal/review procedure without numeric fields. The proposal candidates can all be wrong. The local numerical answers and source-value certificates are not sent to the reviewer. `chooseConflictView` receives no expected answer or evaluation label.

## Why the cover is exact for this definition

Any cover must choose at least one field from a currently uncovered conflict set. Branching over every authorized member therefore preserves at least one branch for every feasible cover. Pruning a branch larger than the budget or the best complete cover cannot remove a strictly smaller solution. Exhausting these branches yields a minimum-cardinality cover, with a deterministic tie break. The implementation is checked against exhaustive subset enumeration in generated small dependency families.

This statement concerns finite **syntactic obligations only**. A field that distinguishes dependencies may be irrelevant to the linguistic error. Operator disagreement with identical inputs may remain unresolved after sending any source value. If `n` fields are available and the budget is three, the bounded search has at most cubic-depth enumeration in `n`, apart from dependency-set construction. It is not an efficient solver for unrestricted hitting sets.

## Evidence and deployment choice

V5 did not recover the old adapter's utility loss. The adapter correction is documented separately. V6 obtains 96/120 correct tasks at 368 calls for conflict review, versus 95/120 at 366 calls for blind review and 98/120 at 120 calls for single-pass local calculation. Only eight conflict-review tasks reach a review; four are correct. Among 110 structurally agreeing tasks, 18 are wrong. These small, dependent subgroups do not establish a general improvement.

The UI therefore defaults to `local_once` on corrected tables. Conflict review is explicitly labelled experimental and remains available for inspection. The prototype's central contribution is an inspectable execution and disclosure path; adding a complex method is not a substitute for demonstrating its benefit.
