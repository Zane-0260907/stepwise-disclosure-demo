# Contributing

This repository contains a runnable prototype and a **frozen** research record. Issues and pull requests are welcome for reproducibility defects, portability, documentation, and new experiments.

1. Keep fixtures synthetic. Do not submit customer documents, API keys, provider credentials, or commercial-client source code.
2. Start from a clean checkout with Node.js 24. Run `npm ci`, `npm run check:inputs` and `npm test`. Explain the command, operating system and observed result in a bug report.
3. The 900-run batch `frozen-v1-20260925` is immutable evidence. Changes to its hashed core, fixtures, evaluator, or dependency lockfile require a **new experiment ID**, new run records and an explicitly revised claim. Never overwrite or relabel the saved Qwen-Plus batch as DeepSeek data.
4. Add tests for new control-path behavior. Distinguish a fresh offline execution, a preserved model-call replay and a new live provider call in code and documentation.
5. When changing plots or manuscript figures, derive values from checked-in records and state exactly which batch and unit of analysis was used.

The public interface is intentionally minimal. Features belonging to the commercial product should stay outside this repository.
