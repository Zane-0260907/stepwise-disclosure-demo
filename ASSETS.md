# Assets and provenance

This repository contains the independent research interface, its `H`/“氢” visual mark, screenshots captured from the runnable interface, synthetic PDF fixtures, and charts derived from the saved experiment records. The interface and screenshots are presented as this project's research demo, not as a release of the commercial client.

- `web/assets/hy-mark-dark.svg` is the visual mark used by this demo. Apache-2.0 licenses the included software and other copyrightable material to the extent the repository maintainer has rights to release it; it does **not** grant trademark rights in the mark or product name.
- `fixtures/research/documents/` and the related catalogs contain synthetic inputs, not customer contracts or student records.
- `evidence/research/ui/` contains screenshots of this demo. The experiment chart in `evidence/research/results/` is generated from saved run records; generative image tools did not produce its measurements, bars or intervals.
- `evidence/research/deepseek-live-20260926/` holds preserved provider-call evidence for one synthetic case. Its English translations are presentation text; the original request/response remains separately auditable.
- Third-party packages are installed through `package-lock.json` and are not vendored into Git. PDF.js (`pdfjs-dist`) is distributed under Apache-2.0; its license is included in the installed package.

If you reuse the demo branding outside this research context, seek permission from the mark owner. Software author and institutional metadata is recorded in `CITATION.cff`.
