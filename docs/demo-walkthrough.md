# Inspect the progressive-disclosure demonstration

Run `npm ci` and `npm start`, open localhost:4793 and select **EN**. No cloud credential is needed for the saved runs. The research interface is independent of the commercial client.

1. Select **DeepSeek replay · Request missing facts**. The middle pane advances automatically through the preserved events. This is explicitly a recording of a real provider call, not a new call or a simulated model.
2. Select the first cloud analysis step. Its view has the clause but lacks the late-day count required for the calculation. The original identity and other records remain local.
3. The model requests business facts. A local step checks the request against its allowlist. In this preserved run it requested both `late_days` and `amount`; the amount was unnecessary. This counterexample is retained: permission is not the same as necessity.
4. Select the next analysis step. Its actual receiver record contains the approved additions. The result is CNY 230/day × 5 days = CNY 1,150. Identity is associated with the report locally.
5. Open the request details to compare the exact body digest with the receiver record. The trace tab retains original model text; translated display text is not substituted into the evidence.

The **Reference clause** case shows another kind of new step: the model requests a particular reference version. The reference service should receive its code and version, not the complete contract. **Revoke before send** demonstrates that changing authorization blocks a pending request; it cannot undo an earlier send.

## Relating the screen to the experiment

The replay is one additional trace, excluded from all batch totals. The current v6 numerical study has 600 tasks and 1,210 provider requests; historical synthetic controls remain separate. Read the table-adapter correction before using v4/v5 numerical conclusions. Compare **joint** with **no_acquisition** to study recovery from insufficient views, and with **allowed_eager** and **numeric_prefetch** for stronger controls that share the same local rules and exclude private fields. The previous v3 study remains a separate historical archive. Inspect failed runs as well as successful ones.

## Current corrected-table walkthrough

Use **Structure check · local calculation**. See the [current step-by-step guide](reproduction-v6.md). The earlier financial showcase is retained as history subject to the [adapter correction](table-adapter-correction.md).
