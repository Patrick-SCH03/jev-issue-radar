# Initial validation

Date: 2026-09-20. This record covers execution, integration, and failure handling of the local MVP. It does not establish duplicate-detection quality on real repositories.

These are initial release checks. The [0.1.1 security and performance review](SECURITY-PERFORMANCE.md) records the expanded regression suite, browser injection checks, and local before/after measurements.

## Local checks

| Check | Command | Result |
|---|---|---|
| Logic and local HTTP integration | node --test tests/check_all.mjs | 36 passed, 0 failed |
| Syntax | node scripts/check-syntax.mjs | 11 files passed, including the inline HTML script |
| Whitespace | git diff --check | Passed |
| Browser interactions | node scripts/browser-smoke.mjs | 16 checks passed with headless Edge, including a full rerun for the English UI |

Browser coverage: explicit demo labels, candidate filters, full reports, JSON downloads, free candidate preview, mocked analysis, invalid input, and theme controls. Six viewport/theme combinations (1440, 768, 375 pixels × light/dark) were checked for horizontal overflow. Runtime errors: zero. Desktop and mobile screenshots were also inspected visually.

The browser suite mocks Jev. Passing it is not evidence of model accuracy. No pre-existing visual regression baseline, axe audit, screen-reader audit, or Core Web Vitals measurement was performed.

## Public GitHub read

The actual importer read https://github.com/typesafe-ai/typesafe-sdk-python/issues/2.

- Source: #2, “Doc fix: output”
- Fetched: 7 items, 7 issues, 1 page
- Retrieved candidates: #3, #5, #7, #1, #6
- No Jev requests or GitHub writes in this check

The running local server's /api/preview route also returned HTTP 200, the seven-issue scan, and five candidates. GitHub state may change. This proves connectivity and data flow, not semantic relevance.

## Actual OpenRouter calls

The owner authorized up to US$0.10 for four synthetic pair comparisons. Each pair was called once, without retries. Request model: typesafe/jev-1.13. Resolved model: typesafe/jev-1.13-20260917.

Each request contained four Choice questions: relation, reason, source_evidence, and candidate_evidence.

| Candidate | Author's expected label | Returned label | Latency | Reported cost |
|---|---|---|---:|---:|
| #219 | duplicate | duplicate | 460ms | $0.000074382 |
| #187 | related | distinct | 291ms | $0.000075726 |
| #163 | distinct | distinct | 296ms | $0.000076650 |
| #104 | insufficient | related | 317ms | $0.000067326 |

- Successful transport and parsing: 4/4.
- Agreement with predefined example labels: 2/4.
- Total provider-reported cost: **US$0.000294084**.
- Calls with unknown cost: zero.
- [Response metadata and translated decisions](live-smoke-2026-09-20.json) contain no API keys or HTTP headers. The file explicitly identifies its translated presentation.

These four pairs are neither representative nor independently labeled. The same author prepared the examples, expectations, and question design. The related/distinct boundary for #187 needs clarification. The result cannot establish general accuracy, precision, recall, or an advantage over another model. Expected labels were not changed to match the outputs, and prompts were not repeatedly tuned on these cases.

### Localization and provenance

The measured inputs were Korean/English examples. The unchanged [original fixtures](https://github.com/Patrick-SCH03/jev-issue-radar/blob/2c6a807d8a3fb30adde251d52fac484858f56628/data/evaluation-fixtures.mjs) and [original report](https://github.com/Patrick-SCH03/jev-issue-radar/blob/2c6a807d8a3fb30adde251d52fac484858f56628/docs/live-smoke-2026-09-20.json) remain available at that immutable commit.

The current UI, fixtures, labels, and report quotations are in English. The report's presentation metadata identifies translated text; numeric measurements, selected choices, and evidence IDs are unchanged. Current evaluation fixtures reuse the English examples for future approved runs. Those English cases were **not** sent to the paid API and must not be presented as the inputs to this measurement. No additional paid calls were made for translation or the security/performance audit.

## Environment issues resolved

- The first Host-header test failed because Node fetch rewrote Host. Switching to a raw HTTP request exercised the intended server guard and passed.
- The bundled Playwright Chromium executable was absent. Browser checks used installed Edge instead of downloading a browser.
- The machine's npm launcher pointed to a missing npm-cli.js. Direct Node commands ran successfully; system npm settings were not modified.
- Sandbox networking and user-environment access were restricted. Authorized live API checks ran with the required environment access.

## Still unverified

Independent labels on real repository issues; retrieval recall@5; duplicate precision and misses; confidence calibration; large repositories, cross-language retrieval, long reports; comparison with other models. No claims of exhaustive scanning, automatic issue resolution, or calibrated confidence are made.

## Publication

The public repository is https://github.com/Patrick-SCH03/jev-issue-radar. Remote CI passed for the submitted source commit 6ea5391aa229ce77466774d2ee6af1abb631bb7a.

[Awesome Jev submission #38](https://github.com/logicrw/awesome-jev-projects/issues/38) passed the catalog's source review, validation, and ingestion workflow. The project was added to its README and source catalog on 2026-09-20, under Domain & Vertical Tools. Catalog inclusion is a source review, not an independent runtime or model-quality endorsement.
