# External input candidates — not experimental results

PrivacyLens is prepared as a **supplementary final-action privacy evaluation**, not a replacement for multi-turn business execution. Source: [SALT-NLP/PrivacyLens](https://github.com/SALT-NLP/PrivacyLens/tree/9c2ee07b080dc54ed4924af11d9751e81753c94d), associated with the [NeurIPS 2024 paper](https://arxiv.org/abs/2409.00138). The upstream repository's MIT notice is retained with the downloaded source. We do not redistribute its raw dataset here.

The pinned source contains 493 records. The preparation script reserves 40 for development and 453 for later evaluation, using a deterministic ordering of whole exact privacy-norm groups. This is a preparation split, not a frozen final study protocol. No model or judge has been run on these records. **493 is a source-pool count, not our evaluated sample size.**

## Prepare and verify

From the repository root, with Python 3.12 or later:

```sh
python scripts/prepare-privacy-inputs.py --fetch
python scripts/prepare-privacy-inputs.py --check
python test/privacy-inputs.test.py
```

The first command downloads three public, commit-pinned files and checks their SHA-256 digests before use. No model key or third-party Python library is required. Repeated execution refuses to overwrite changed files. `--check` uses only the local source and performs no network requests or writes.

Prepared files stay under the ignored `data/research/privacylens-inputs/` directory:

| File | Role |
| :-- | :-- |
| `local-inputs.json` | Original user task, user context, toolkit names and recorded trajectory prefix, with opaque identifiers |
| `evaluation-only.json` | Privacy norms, vignette, sensitive-item annotations and expected final-action type; excluded from runtime inputs |
| `splits.json` | Development/reserved identifiers, with no exact norm group shared across them |

`privacylens.json` in this folder contains source/output hashes and counts, without task contents or scores. A future runner must load only the allowed local inputs for its assigned split. Separation into files is not an operating-system security boundary.

## What remains unimplemented

- These local inputs contain original private context. They are **not sanitized cloud payloads**. A disclosure method must decide what may leave the local environment before any provider call.
- Recorded prefixes, toolkit names and a final-action target do not constitute a newly executed end-to-end business workflow. This preparation does not load tool schemas or launch backends.
- Sensitive-item annotations and privacy norms are not a complete oracle for the minimum information needed to solve every task.
- We have not run the original leakage/helpfulness evaluator. The upstream evaluation uses a separate model; reproducing or adapting that procedure must be explicitly described and independently checked.
- Exact norm grouping does not detect every semantically similar scenario. Development/test separation and sample size must be finalized before the prospective experiment.
- The current mechanism has not passed its [contribution gate](../../docs/mechanism-gate.zh-CN.md). Preparing a better source does not establish a new algorithm, privacy benefit or generalization result.

## 中文说明

这是外部隐私规范数据的准备材料。493 条为来源规模，40 条开发候选、453 条预留；没有任何新增模型结果。模型运行输入通过字段白名单生成，隐私规范、敏感条目标注与预期最终动作保留在单独评价文件中。原始运行输入仍含私有上下文，不应直接作为云端提示发送。

PrivacyLens 补充的是最后一步的隐私判断；不能替代 tau2 的完整业务状态评价，也不能充当所有语义事实的最小充分性真值。正式测试、独立质量核查和方法有效性均未完成。
