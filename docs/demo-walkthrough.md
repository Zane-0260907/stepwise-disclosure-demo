# Inspect the progressive-disclosure demonstration

Run `npm ci` and `npm start`, open localhost:4793 and select **EN**. No cloud credential is needed for the saved runs. The research interface is independent of the commercial client.

1. Select **DeepSeek replay · Request missing facts**. The middle pane advances automatically through the preserved events. This is explicitly a recording of a real provider call, not a new call or a simulated model.
2. Select the first cloud analysis step. Its view has the clause but lacks the late-day count required for the calculation. The original identity and other records remain local.
3. The model requests business facts. A local step checks the request against its allowlist. In this preserved run it requested both `late_days` and `amount`; the amount was unnecessary. This counterexample is retained: permission is not the same as necessity.
4. Select the next analysis step. Its actual receiver record contains the approved additions. The result is CNY 230/day × 5 days = CNY 1,150. Identity is associated with the report locally.
5. Open the request details to compare the exact body digest with the receiver record. The trace tab retains original model text; translated display text is not substituted into the evidence.

The **Reference clause** case shows another kind of new step: the model requests a particular reference version. The reference service should receive its code and version, not the complete contract. **Revoke before send** demonstrates that changing authorization blocks a pending request; it cannot undo an earlier send.

## Relating the screen to the experiment

The replay is one additional trace, excluded from all batch totals. The current v4 study has 256 synthetic tasks and 240 public-table tasks, with 592 provider requests. Compare **joint** with **no_acquisition** to study recovery from insufficient views, and with **allowed_eager** and **numeric_prefetch** for stronger controls that share the same local rules and exclude private fields. The previous v3 study remains a separate historical archive. Inspect failed runs as well as successful ones.

## Compare local calculation with sharing values

1. Select **Public table · local calculation** in the saved-run list. It replays a real call on one development example, excluded from the 240-task batch.
2. Select the cloud planning step. Expand the question/schema and the actual request: numerical `facts` is empty, while the row and column labels remain visible.
3. Select **Execute the calculation locally**. Inspect the model-proposed expression and the exact source-cell dependencies. The result is computed from those local values; no result is sent back to the model.
4. Replay **Public table · all values** and **Public table · selected cells** on the same question. Compare what left the local process and how many provider calls were needed.
5. Open the batch figure for the quality tradeoff: the structure-only route passes 51/80 runs versus 62/80 with all values. One successful screen is not evidence of equal accuracy. See the [complete reproduction guide](reproduction-v4.md).

Local rules, real live calls and saved-call playback are separately labeled. Playback intervals only improve readability; the saved timestamps and batch timings measure the original execution. A new live call requires the visitor's own `DEEPSEEK_API_KEY`. A key is neither shipped nor needed to re-score the published records.
