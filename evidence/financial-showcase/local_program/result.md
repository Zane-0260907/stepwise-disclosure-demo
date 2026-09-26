# FinQA · AWK/2013/page_132.pdf-2

what is the one-percentage-point increase of effect on total of service and interest cost components as a percentage of the effect on other postretirement benefit obligation?

Result: 0.10198233616656054

Source: finqa-b972a5ad0246.pdf

Program:

```json
[
  {
    "op": "divide",
    "args": [
      {
        "field": "r1c1"
      },
      {
        "field": "r2c1"
      }
    ]
  }
]
```

Dependencies: r1c1, r2c1

Public table-only benchmark subset. Numeric correctness is checked separately against withheld FinQA labels. No semantic privacy guarantee.
