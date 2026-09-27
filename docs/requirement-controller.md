# Registered requirements and execution choices

[中文说明](#中文说明)

This controller implements a narrow, executable version of requirement-driven input selection. A trusted local application registers a structural requirement and alternative ways to satisfy it. A model may refer to that requirement; it cannot create a new authorization by requesting additional fields.

## Run without a model key

From the repository root with Node.js 24:

```sh
npm ci
node scripts/run-requirement-demo.mjs
node scripts/run-requirement-demo.mjs --check
node --test test/requirement-controller.test.mjs
node scripts/sync-paper-evidence.mjs --check
```

The first command after installation executes three stages and writes `evidence/requirement-demo/trace.json`. The second re-executes the same computation and two actual loopback HTTP requests, and compares the resulting trace to the released record. No API key or model request is used. This example is separate from the approved browser interface and the model benchmark batches.

## What happens

The constructed input is `amount = 120`, `limit = 100`. The registered output is the Boolean `aboveLimit`.

| Stage | Condition | Actual outgoing input | Cumulative disclosed items |
| :-- | :-- | :-- | --: |
| 1 | Service accepts a locally derived predicate | `{"aboveLimit":true}` | 1 |
| 2 | Derived representation is withdrawn | `{"amount":120,"limit":100}` | 3 |
| 3 | Local completion becomes available | No new request | 3 |

An old stage-1 ticket is explicitly rejected after the capability change, before a request can be sent. All three stages produce the same Boolean result. Stage 2 deliberately uses more information because a representation is unavailable; it is not presented as a privacy win. These capability settings are imposed demonstration conditions, not natural properties of arithmetic or evidence that a cloud model is needed to compare two numbers.

The trace contains candidate costs, reasons unavailable alternatives were rejected, actual receiver bodies, their SHA-256 digests, results and cumulative disclosure events. The receiver is an HTTP listener in the same Node process. Its digest is a local integrity check, not independent attestation or a model-provider signature.

## Decision rule and limits

Each registered option lists its covered structural requirements, source dependencies, capability predicate and pure local evaluator. The controller evaluates feasible authorized options, orders them by new disclosure-item count, transmitted bytes, then stable identifier, and selects the first. A local completion adds no outward item. A derived value is still counted. Recipient, representation, source versions and value participate in the identity of a disclosure item.

For a finite list, this enumeration selects the minimum of that stated ordering. It does **not** discover equivalent representations, measure inferred information leakage, prove minimum semantic disclosure, or introduce a novel optimization algorithm. If a strong baseline enumerates the same options with the same ordering, its decision is identical.

A process-local, single-use ticket binds the chosen bytes and recipient to the inspected state. State changes require rechecking; this implementation conservatively invalidates the entire ticket even for an unrelated change. Authorization is checked again immediately before the transport. Outward items are charged before transmission and are retained after a timeout or bad receipt. This differs from the older financial study's acknowledged-send metric, which stops on uncertain transport; its published data is not rewritten to use the new convention.

Trusted functions, version maintenance and permissions are supplied by the application. Input sufficiency is defined only by its registered structural contract. Arbitrary model prose such as “I need the full customer profile” is not a verified gap. Natural-language necessity, business-policy compliance and human output quality remain separate evaluation questions. Tests and the constructed trace are software evidence, not independent real-task accuracy observations.

## 中文说明

这个模块把“缺什么信息”限制为本地应用已经登记、能够检查的结构需求。模型可以引用登记需求，不能靠一句“需要更多上下文”获得额外字段权限。它依次比较本地完成、派生结果和获准原值，发送前重新核对状态与授权；发送超时也不抹掉可能已经披露的信息。

上面的三阶段案例真实执行两次回环 HTTP 请求，记录接收正文和结果，不调用模型。它验证请求与决策如何衔接，**不作为新的真实任务实验，也不证明技术新颖性**。数值批次、原生业务开发任务、这条构造记录在论文中分别注明范围。该模块尚未接入现有页面或模型批量任务。

源码为 `src/research/requirement-controller.mjs`，九项测试覆盖能力变化、越权补充、不同接收方、来源版本、失配回执、超时、票据替换和本地结果有效性。现有商业产品不依赖此模块，也没有被修改。
