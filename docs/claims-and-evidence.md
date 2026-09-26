# Claims and their evidence

This map separates implemented behavior, measured outcomes and open research questions. Numbers describe this release, not an acceptance probability.

| Claim | Evidence | What is not established |
|:--|:--|:--|
| Supported operations can complete locally | Original local-rule tests; UI input-change test; shared routing in all v4 controls | General local language understanding |
| A model can trigger a new authorized fact request | Preserved progressive trace; acquisition tests; v4 57/64 versus 50/64 without the tool | Semantically minimal field selection |
| The advantage persists against an eager allowed-fields baseline | **Not established:** 57/64 versus 58/64; additional calls are 80 versus 64 | Superior/equivalent completion or lower total cost |
| Fewer extra fields are transmitted in these synthetic tasks | 0.03125 versus 0.5625 for allowed eager, and 0.0625 for numeric prefetch | A large advantage over every reasonable selector; the numeric-prefetch gap is small |
| The new finite interpreter avoids sending raw table numbers | FinQA per-request records; 0 numeric cells/task on the schema-only route | Semantic privacy, reconstruction resistance or unseen-data guarantees |
| Schema-only planning preserves answer quality | **Contradicted on this subset:** 51/80 versus 62/80 with full values; −13.75 points, descriptive clustered interval [−24.43, −3.95] | Utility preservation or a universal default policy |
| A computed answer matches the model's finite program | The verifier reinterprets every saved program against the source and checks dependencies | Correct interpretation of the natural-language question |
| Display metadata cannot authorize modified sources | Private ticket copies; source-change/metadata mutation regression test | Safety under a compromised controller or arbitrary network bypass |
| Published experiments can be recomputed without a key | Raw archives, independent scoring, frozen hashes, provider-record matching; Windows/Ubuntu CI | Bit-identical outcomes from future paid model calls |
| Free-text explanations are independently acceptable | **Pending:** prepared blinded author-review packets, no completed ratings | Human quality, expert endorsement or real deployment benefit |
| The work introduces a never-before-proposed algorithm | **Not established:** substantial prior work on local abstractions, active acquisition and minimization | A first-ever claim or superiority over full external systems |

## Changes made after the stronger-control review

1. Added two fairer synthetic controls with the same local rules and per-recipient reference projection. They exclude private fields instead of leaking identity as an easy comparison.
2. Added a typed local interpreter with explicit read dependencies and bounded operators. No model-generated JavaScript, Python, shell commands or file/network access is executed.
3. Isolated internal request tickets from public trace metadata, with regression tests for mutation and stale source/policy bindings.
4. Added a pinned external numerical dataset with original labels and a declared subset-selection procedure. The original v3 set is explicitly labelled as reused.
5. Preserved the unfavorable numerical outcome and its cost/disclosure tradeoff in the main figure, README and manuscript.
6. Rebuilt the Chinese manuscript with native Word equations, English algorithm lines, actual UI evidence and an explicit claim boundary.

## Open research questions

The current core integrates known ideas with inspectable execution evidence. A stronger algorithmic claim would need a mechanism that solves a demonstrated limitation of the closest work, followed by a new frozen evaluation on inputs not used to design that mechanism. Existing unfavorable runs must remain available. Specific open questions include when to request source cells instead of proposing a local expression, how to recognize insufficient views without task labels, and how to control cumulative disclosure across recipients.

Human prose review is also outstanding and cannot be supplied by the same agent that generated the text. Authors previously deferred this step. The current manuscript accordingly avoids a human-quality claim. The Chinese draft still needs final English ACM submission preparation and author submission metadata; these are separate from runnable-code quality.

The official [SIGMOD 2027 demonstration call](https://2027.sigmod.org/calls_sigmod_demos.shtml) is the source for submission requirements. A local self-assessment does not predict or guarantee a program committee decision.
