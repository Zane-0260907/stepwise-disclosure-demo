# Release-verifier correction, 2026-09-27

The pre-run frozen `scripts/verify-v7.mjs`, protocol, runtime code, inputs and all execution records remain unchanged. During release acceptance we found that verifying a **new named batch twice** would mistake the generated root-level `summary.json` for a raw execution on the second pass. This does not affect the published frozen batch, whose summary is outside its raw directory.

`npm run verify:v7` now uses `scripts/verify-v7-release.mjs`. It preserves the arithmetic, case coverage, state reconstruction, receipt and metric checks of the frozen verifier, with three administrative changes:

1. Write new-batch outputs to `analysis/` rather than among the raw records.
2. Ignore the old generated root-level `summary.json` for backward compatibility.
3. Check the batch manifest's protocol identity, protocol hash and execution count explicitly.

Both verifiers produce identical published scores and summary. A named copy of the complete archive is verified twice as a release regression check. This is a post-run verification/tooling correction, not a refrozen experiment or an algorithmic change. The corrected verifier is covered by the release file manifest and Windows/Ubuntu CI.
