# Receipt matching correction

The frozen collector, controller, prompts, records, dataset and score definitions are unchanged. After collection, the original verifier failed when a restart sent the exact same request body twice: `.find` matched the first receipt twice and its uniqueness assertion failed.

`scripts/verify-v8-release.mjs` retains all checks and matches the first **unused** receipt with the expected digest. Each request still requires a distinct receipt ID, matching raw bytes, matching payload and correct receiver result. The original `scripts/verify-v8.mjs` remains byte-identical to the frozen protocol. No experiment or model call was replaced, removed or rerun to address this verifier defect.

Use `npm run verify:v8`, which points to the release verifier. The correction affects matching of repeated identical requests, not numerical scores or the budget rule.
