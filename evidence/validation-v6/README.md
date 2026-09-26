# Current frozen numerical experiment

**600 tasks · 1,210 provider requests · 60 pages · 57 reports · 38 companies.** Five methods, two repeats, all failures retained. Source, inputs, labels and prompts were frozen before calls.

- [Protocol and hashes](protocol.json)
- [Results table](RESULTS.md), [full summary and paired intervals](summary.json)
- [Case aggregates](case-aggregates.json), [all task scores](scores.jsonl), [failures](failures.json)
- [Raw reproduction archive](reproduction-records.zip)
- [English figure](tradeoffs.en.svg), [中文图表](tradeoffs.zh-CN.svg)
- [Full reproduction guide](../../docs/reproduction-v6.md), [中文教程](../../docs/reproduction-v6.zh-CN.md)

The current table-role repair is shared by all methods. It is not claimed as a novel algorithm. Single-pass local calculation sends no business values but still exposes the question, labels, years and units. Its accuracy interval versus full values crosses zero. The optional conflict-view method has no established benefit over single-pass planning and remains experimental.

Three separate development demonstration runs live under [corrected-showcase](../corrected-showcase/), excluded from these counts. Earlier v4/v5 outcomes remain available with the [adapter correction](../../docs/table-adapter-correction.md).
