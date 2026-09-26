# Assets and provenance

This repository contains the independent research interface, its `H`/“氢” visual mark, screenshots captured from the runnable interface, synthetic PDF fixtures, and charts derived from the saved experiment records. The interface and screenshots are presented as this project's research demo, not as a release of the commercial client.

- `web/assets/hy-mark-dark.svg` is the visual mark used by this demo. Apache-2.0 licenses the included software and other copyrightable material to the extent the repository maintainer has rights to release it; it does **not** grant trademark rights in the mark or product name.
- `fixtures/research/documents/` and the related catalogs contain synthetic inputs, not customer contracts or student records.
- `evidence/research/ui/` contains screenshots of this demo. The English README uses the interface's actual English-mode screenshot; source documents and recorded request bodies retain their original language. The Chinese and English charts in `evidence/research/results/` are generated from the same saved run records; generative image tools did not produce their measurements, bars or intervals.
- `assets/social-preview.png` combines the English-mode screenshot with counts from the frozen protocol. Its source HTML and render script are beside it; it introduces no new experiment values.
- `evidence/research/deepseek-live-20260926/` holds preserved provider-call evidence for one synthetic case. Its English translations are presentation text; the original request/response remains separately auditable.
- Third-party packages are installed through `package-lock.json` and are not vendored into Git. PDF.js (`pdfjs-dist`) is distributed under Apache-2.0; its license is included in the installed package.

- `fixtures/validation-v2/` and `fixtures/validation-v3/` are newly authored synthetic inputs and separate evaluation labels. v2 was subsequently used for v3 development; neither is an external benchmark.
- `evidence/validation-v2/` and `evidence/validation-v3/` contain complete saved DeepSeek batches, frozen protocols, re-scored outcomes and failures. The v3 Chinese/English figures use those measured values.
- `evidence/progressive-showcase/` is one additional real call, excluded from the batches. Its bilingual UI screenshots are browser captures. Translations are presentation-only; original outputs and the unnecessary requested field are retained.
- `fixtures/showcase/documents/` contains synthetic PDFs rendered from the corresponding v3 fixtures. No real contracts or personal records are included.

If you reuse the demo branding outside this research context, seek permission from the mark owner. Software author and institutional metadata is recorded in `CITATION.cff`.
