# FinQA · UAA/2016/page_42.pdf-4

what was the percentage change in working capital from 2015 to 2016?

Result: 0.25430975741039047

Source: finqa-47593c3344df.pdf

Program:

```json
[
  {
    "op": "subtract",
    "args": [
      {
        "field": "r3c1"
      },
      {
        "field": "r3c2"
      }
    ]
  },
  {
    "op": "divide",
    "args": [
      {
        "step": 0
      },
      {
        "field": "r3c2"
      }
    ]
  }
]
```

Dependencies: r3c1, r3c2

Public table-only benchmark subset. Numeric correctness is checked separately against withheld FinQA labels. No semantic privacy guarantee.
