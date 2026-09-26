# Frozen v6 results

60 previously unused public pages, 57 company-year reports, five methods, two repeats.

| Method | Correct | Cells/task | Calls | Median ms |
|:--|--:|--:|--:|--:|
| full_once | 96/120 | 14.833 | 120 | 736 |
| local_once | 98/120 | 0.000 | 120 | 720 |
| requested_cells | 94/120 | 2.417 | 236 | 1374 |
| blind_review | 95/120 | 0.000 | 366 | 2247 |
| conflict_review | 96/120 | 0.075 | 368 | 2247 |

All failures retained. All methods use the corrected table-role adapter. Question, labels, years and units remain visible even when no business cell value is sent. A structural conflict cover is not a semantic privacy or correctness proof. See protocol.json for the design and summary.json for paired intervals.
