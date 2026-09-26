# Inspect the progressive-disclosure demonstration

Run `npm ci` and `npm start`, open localhost:4793 and select **EN**. No cloud credential is needed for the saved runs. The research interface is independent of the commercial client.

1. Select **DeepSeek replay · Request missing facts**. The middle pane advances automatically through the preserved events. This is explicitly a recording of a real provider call, not a new call or a simulated model.
2. Select the first cloud analysis step. Its view has the clause but lacks the late-day count required for the calculation. The original identity and other records remain local.
3. The model requests business facts. A local step checks the request against its allowlist. In this preserved run it requested both `late_days` and `amount`; the amount was unnecessary. This counterexample is retained: permission is not the same as necessity.
4. Select the next analysis step. Its actual receiver record contains the approved additions. The result is CNY 230/day × 5 days = CNY 1,150. Identity is associated with the report locally.
5. Open the request details to compare the exact body digest with the receiver record. The trace tab retains original model text; translated display text is not substituted into the evidence.

The **Reference clause** case shows another kind of new step: the model requests a particular reference version. The reference service should receive its code and version, not the complete contract. **Revoke before send** demonstrates that changing authorization blocks a pending request; it cannot undo an earlier send.

## Relating the screen to the experiment

The replay is one additional trace, excluded from all batch totals. The v3 study evaluates 32 author-created synthetic cases, seven methods and two repeats: 448 tasks. Compare **joint** with **no_acquisition** to study recovery from insufficient views, and with **placement_full** to compare disclosure under the same local-rule capability. Inspect failed runs as well as successful ones.

Local rules, real live calls and saved-call playback are separately labeled. Playback intervals only improve readability; the saved timestamps and batch timings measure the original execution. A new live call requires the visitor's own `DEEPSEEK_API_KEY`. A key is neither shipped nor needed to re-score the published records.
