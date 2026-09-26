# Research position and evidence boundaries

## Current stronger-control update

The v4 extension adds a finite local arithmetic interpreter and records its actual source dependencies. This is a concrete executable capability, but local program execution and computation pushdown are established ideas. It is not presented as a first invention. The schema-only path is an experimental route with a measured accuracy loss; it does not replace the original contract/study route as a universal default.

The new same-capability controls produce 57/64 correct tasks for progressive acquisition and 58/64 for both permitted-field eager sharing and numeric prefetch. Progressive acquisition reduces extra fields but uses 80 model calls versus 64. A 40-page restricted FinQA test subset produces 51/80 for schema-only planning versus 62/80 for full values. These outcomes rule out a current claim of universal accuracy improvement or cost dominance. See [claim-to-evidence map](claims-and-evidence.md) and [current records](../evidence/validation-v4/).

[Operationalizing Data Minimization for Privacy-Preserving LLM Prompting](https://arxiv.org/abs/2510.03662) formalizes utility-preserving minimization and searches transformation choices. This reinforces why requesting allowed fields is not itself evidence of semantic necessity. [FinQA](https://aclanthology.org/2021.emnlp-main.300/) supplies public numerical questions and reasoning labels; the subset used here is restricted by an explicit compatibility rule and is not a full FinQA evaluation.

The remainder documents the original v3 mechanism and evidence rather than replacing its historical results.

The system studies a data-management problem in a running agent task: the next recipient and its useful input may become known only after an earlier operation returns. A fixed entry projection can be excessive for a lookup but insufficient for a later calculation. The prototype maintains a recipient-specific view, lets a model request missing authorized business facts, and checks the current policy, used source values and exact serialized request before dispatch.

This is a bounded systems demonstration. It does not claim to infer a mathematically minimal sufficient view, defend arbitrary network bypasses, or outperform other papers' full systems.

## Closest work

The table describes the published focus, rather than interpreting an unmentioned feature as absent. Sources were checked on 2026-09-26.

| Work | Published focus | Relationship to this prototype |
| :-- | :-- | :-- |
| [MINIM](https://arxiv.org/html/2606.13949v1) | A trusted local broker predicts sensitivity and task-conditioned necessity for structured UI observations, retaining or abstracting useful elements. The paper links its [reference implementation](https://github.com/yyyyhx/MINIM). | Learned semantic minimization is relevant prior art. Our registered business fields and finite local rules are a narrower setting; this demo adds an inspectable execution trajectory across model and reference recipients. We do not compare accuracy numerically with MINIM. |
| [ToolMinimize](https://arxiv.org/html/2608.24957v1) | Schema-aware rewriting of tool-call arguments; it also studies content necessity within free-text arguments. | Tool-argument minimization is not novel by itself. Our experiment includes model requests as well as tool requests and explicitly tests recovery from an initially insufficient view. Its reported privacy metrics and our field counts are not directly interchangeable. |
| [PlanTwin](https://arxiv.org/html/2603.18377v2) | A sanitized planning abstraction, bounded capabilities and a local gatekeeper with disclosure budgets. | This is substantial architectural overlap. We position this work as a narrower observable prototype with progressive field acquisition, executable local rules and exact application-request validation, not as the first local gatekeeper or private planning architecture. |
| [SplitAgent](https://arxiv.org/abs/2603.08221) | Enterprise/cloud collaboration with context-aware sanitization. | Dynamic enterprise/cloud sanitization is prior art. The present claim concerns a reproducible operation-level mechanism and evidence, not first-ever dynamic sanitization. |

An external system baseline has not been run. All seven controls are implemented here and share one task harness. Adapting a UI-observation sanitizer to a contract-field task would need a separately justified evaluation; calling our simple projection “MINIM” would be misleading.

## Mechanism that the evidence supports

1. A registered local rule finishes a supported operation without a model request.
2. Otherwise, the current recipient receives an initial view. A model can request missing fields through `request_task_facts`.
3. The local controller checks the requested field names against an operation-specific allowlist. A model cannot grant itself access to identity, contact, account, internal notes or unrelated records. An authorization check is repeated before the next send.
4. The request plan binds operation, recipient, policy version, hashes of used source values, and the serialized body. A request cannot reuse a consumed ticket. Changes to unused source fields do not invalidate a view.
5. The actual receiver body must match the authorized serialization. A provider adapter's deterministic addition of `thinking: disabled` is recorded and independently checked by the reproduction script.

Under the assumptions that the local controller and registered transport are trusted, every dispatched request has a matching current authorization and an unchanged planned serialization at dispatch. This is a local program invariant, not a new cryptographic theorem. Policy revocation cannot retract already-dispatched requests. Receiver records are application evidence, not a cloud provider's certification.

The field allowlist expresses authorization, not semantic necessity. The model can still ask for an allowed but unnecessary business field; v3 observed this behavior and counts it. Likewise, a correct output schema is not evidence that the free-text advice is professionally correct.

## Evidence sequence

| Record | Purpose | Permitted interpretation |
| :-- | :-- | :-- |
| Frozen v1, 900 Qwen-Plus tasks | Original controlled mechanism study | Supported operation families, retained unchanged |
| Prospective v2, 432 DeepSeek tasks | Stress the original selector with new inputs and a placement-matched control | Exposed omitted facts; subsequently used for development |
| Prospective v3, 448 DeepSeek tasks | Evaluate the new fact-acquisition mechanism after freezing its code, labels and inputs | New author-created cases in the same two domains; not external-domain generalization |
| Request-binding study | 52 modified requests and 8 valid requests per implementation | Exact-body/control-path behavior using a deterministic HTTP endpoint |
| Progressive showcase | One additional live DeepSeek run | Illustrates the UI; excluded from all batch totals |
| Blind author assessment | Materials prepared for 24 outputs | Pending actual ratings; no human quality claim yet |

The v3 success difference against the placement-matched full-context control is only 1.56 percentage points, with a paired descriptive interval crossing zero. It supports studying disclosure with similar observed completion, not a claim of superior task quality. Removing fact acquisition reduces observed success by 10.94 points. Acquisition also adds model calls: 80 versus 64 for the no-acquisition control.
