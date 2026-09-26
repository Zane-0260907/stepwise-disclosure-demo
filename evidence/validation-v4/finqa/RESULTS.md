# v4-finqa-20260927

240 planned tasks; 320 separately matched provider calls. All failed tasks remain in the denominator.

| Method | Correct | Success | Raw cells transmitted/task | Calls | P50 seconds |
|:--|--:|--:|--:|--:|--:|
| eager_allowed | 62/80 | 77.5% | 15.425 | 80 | 0.72 |
| requested_cells | 53/80 | 66.3% | 2.425 | 160 | 1.33 |
| local_program | 51/80 | 63.7% | 0.000 | 80 | 0.70 |

40 selected test pages from FinQA: 38 company-year reports, 28 companies; fixed eligibility and hash ordering. Restricted table-only subset.

Aggregate repeats within case; paired cluster bootstrap by company-year report, 4000 draws. Descriptive uncertainty for this selected subset; no general-population or non-inferiority claim.

No human text-quality score, cryptographic privacy, semantic non-disclosure, data-minimization optimality, or external-system superiority claim.

Counts describe observed disclosure through registered requests, not resistance to reconstruction or inference.
