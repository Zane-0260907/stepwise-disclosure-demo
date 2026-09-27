# Exact compression of disclosure planning states

The final implementation is `src/research/bounded-disclosure-frontier.mjs` with `lex-frontier.mjs`. Earlier `live-frontier.mjs` and `component-frontier.mjs` are preserved development ablations. This is a finite registered-choice optimizer, not an algorithm for deciding semantic necessity in arbitrary language. Frontier search, liveness-based state elimination, and multi-objective dynamic programming are established techniques; see [Kawahara et al.](https://doi.org/10.1587/transfun.E100.A.1773) and [Trummer and Koch](https://arxiv.org/abs/1603.00400). The system-specific contribution is the following state representation for recipient-specific union costs and a transmission budget, connected to a running, versioned execution controller.

## Model and assumptions

At a stable planning boundary there are m known steps with finite alternatives. An alternative has a recipient-qualified disclosure-token set, nonnegative integer work cost, nonnegative integer transmission-field cost, feasibility, and an implementation returning the same registered logical result as its alternatives. Future feasibility and costs do not depend on the particular representation used by the prefix. Shared mutable side effects and representations with different result semantics are excluded. Version and capability changes cause replanning.

Let H be the complete persistent history before this planning call. Tokens already in H add zero new distinct disclosure cost, but still contribute their actual transmitted fields. A plan minimizes, lexicographically, (new distinct tokens, work, fields), under a field budget B. A token includes its recipient and source/version or derived expression; a token count is not a measure of inferred information leakage.

After prefix i, let E_i be the union of newly disclosed tokens and U_i the union of all possible new tokens in the known remaining alternatives. Store L_i = E_i ∩ U_i, z_i = |E_i \ U_i|, work w_i and fields b_i. U_i excludes H. The implementation keeps the actual chosen path for execution.

## Exactness lemma

For any feasible suffix with new-token union F ⊆ U_i,

`|E_i ∪ F| = z_i + |L_i ∪ F|`.

The two sets E_i \ U_i and L_i ∪ F are disjoint, and their union is E_i ∪ F. Therefore prefixes with the same live set L_i and equal z_i, w_i, b_i have identical objective values after every common suffix. The identities of retired tokens are immaterial for this planning call.

For an alternative with new set A, form X = L_i ∪ A. Set L_{i+1} = X ∩ U_{i+1} and z_{i+1} = z_i + |X \ U_{i+1}|. An already retired token cannot occur in A: at the time it retired it was absent from every remaining alternative. Hence it cannot be charged twice. This proves the transition preserves the lemma by induction.

Within an equal-live-set group, state 1 dominates state 2 if its fields are no larger and `(z_1, work_1)` is lexicographically no greater than `(z_2, work_2)`. A strict improvement in z wins regardless of work: the same suffix adds exactly the same new-token cardinality to both live sets. If z ties, work decides. Field-budget feasibility is preserved. Discarding the dominated state preserves at least one lexicographically optimal completion. The final suffix is empty, so L_m is empty and z_m is exactly the newly disclosed token count. If the state limit is not reached, the algorithm returns an optimal feasible registered plan. It reports a limit failure explicitly; it does not silently return a greedy plan as optimal.

## Disclosure components

Connect two steps if any of their feasible alternatives share a token absent from H, and take connected components. New-token sets in different components are disjoint, so their disclosure counts, work and fields add. For each attainable component field bound, solve its local problem, retain the nondominated cost triples and combine them under the one global budget. Any globally optimal plan induces a component plan with some field count b. The locally optimal plan at bound b has no worse disclosure/work pair and no more fields, so replacing that component cannot worsen the global plan. This proves that enumerating component budgets and combining their frontiers preserves an optimum. Alternatives are returned in their original step order; this is a cost decomposition, not a reordering of execution or side effects.

## State bound and limits

Let w be the largest number of tokens that occur in both some prefix alternative and some suffix alternative. There are at most 2^w possible live sets. For each live set and integer field count, only a lexicographically smallest (retired count, work) survives. A conservative bound on retained states is therefore `2^w (B+1)` when B is finite. This is a pseudo-polynomial bound, not a polynomial-time guarantee. The final implementation applies it inside each component and can solve a component repeatedly at different field bounds. Its array-based dominance checks can be quadratic within a group; one large component with high overlap can still exceed 4096 states. Input-order dependence of w is not optimized. The earlier full three-cost Pareto ablation has the weaker bound `2^w (B+1) (C+1)` where C bounds work.

Complete runtime history is never compressed into z. If a previously unknown step appears, the controller replans with that complete history and the new known suffix. If a source value changes, the new version creates a new disclosure token. Historical observations cannot be retracted. No bound on unknown future steps is asserted.

## Independent integer model

Binary x_ia selects exactly one feasible alternative per step. Binary y_t represents each token absent from H. For every selected alternative containing t impose y_t ≥ x_ia; sum of field costs is at most B. Minimize lexicographic union count, work and fields using exact integer weights bounded from the input. `scripts/frontier-milp.py` uses SciPy/HiGHS and validates the integral selected path. A reported solver limit is not treated as proof of optimality. This is an independent formulation of the same registered problem, not an independently labeled privacy benchmark.

The publication records also include exhaustive small-case checks, all old model plans, controlled synthetic overlap families, and runtime HTTP traces. These forms of evidence answer different questions and are not pooled into a single accuracy percentage.
