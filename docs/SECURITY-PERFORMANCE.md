# Security and performance review

Date: 2026-09-20. Target: the local application, provider adapters, browser rendering, fixtures, and development checks. Baseline commit: `2c6a807d8a3fb30adde251d52fac484858f56628`. Release: 0.1.1.

## Verified findings and changes

Severity reflects a loopback, single-user application. These findings do not imply unauthenticated access from the public internet.

| Severity | Finding and reproduction | Resolution |
|---|---|---|
| Medium | A raw HTTP request with target `//[` and a valid local Host crashed a child server with `TypeError: Invalid URL`, exit code 1. | Validate request targets inside the error boundary. Malformed targets return 400; a following status request still succeeds. |
| Medium | The Jev adapter accepted a 3,146,020-byte JSON response despite expecting four small choices. Upstream JSON reads had no byte cap. | Bound decoded response streams and cancel on overflow or deadline. GitHub is limited to 8 MiB per response and Jev to 256 KiB. |
| Medium | `JEV_MAX_CALLS=0` reported an effective allowance of 20 because parsing fell back to the default. | Reject invalid limits at startup, including zero, negative values, fractions, and trailing text. No paid call was used to reproduce this. |
| Low | Incomplete uploads were read before acquiring the active-request slot, with no short application deadline. | Reserve the slot before reading, reject a second request with 409, and return 408 after the upload deadline. Disconnects release the slot. |
| Hardening | CSP allowed unrestricted inline scripts. Existing rendering already escaped untrusted text; no working XSS was found. | Add fresh script/style nonces, remove `unsafe-inline`, and verify in Edge that injected markup stays text and scripts without a nonce are blocked. |
| Performance | Retrieval retained the vocabulary of every report and computed document frequency for terms absent from the query. | Retain only matched query terms and document sizes. Scores and ordering are unchanged in the checked cases. |

Regression coverage lives in [tests/check_all.mjs](../tests/check_all.mjs); browser injection checks are in [scripts/browser-smoke.mjs](../scripts/browser-smoke.mjs). The response reader is [lib/http.mjs](../lib/http.mjs); HTTP safeguards are in [server.mjs](../server.mjs).

## Verification

- Offline logic and HTTP tests: **48 passed, 0 failed**, including malformed URLs, raw request targets, bounded/chunked uploads, disconnected clients, stalled upstream bodies, oversized responses, invalid choices, billing caps, repeat-analysis caching, and origin/token checks.
- Browser checks: **18 passed**, with mocked Jev calls. Includes HTML injection, actual CSP enforcement, exports, errors, filters, and six viewport/theme combinations. No uncaught browser errors; the deliberate CSP violation is expected.
- Retrieval equivalence: 100 deterministic generated cases matched the baseline's complete result objects. A separate read-only reviewer also checked 200 cases.
- Public GitHub integration: issue `typesafe-ai/typesafe-sdk-python#2` loaded successfully; 7 fetched items, 1 page, 5 candidates, 672 ms in a single connectivity check. This is not a network-latency benchmark.
- Source scan: no Hangul characters remain in current repository text, and no matches for the scanned OpenRouter/GitHub/private-key secret patterns. Pattern scanning is not a guarantee that every possible secret format is absent.
- Independent read-only cross-review: approved, **0 material findings**; accepted 0, deferred 0, rejected 0. The reviewer exercised offline tests, retrieval equivalence, billing concurrency, and provenance. Browser and live GitHub checks were performed separately by the author. Strict call-limit validation was added afterward and covered by the final regression run.
- No paid model requests were made for this review. The earlier four-call experiment remains explicitly separate.

## Local performance

Command: `node scripts/benchmark.mjs before` on the baseline application, then `node scripts/benchmark.mjs after` on the updated application. The script was identical between runs. The recorded after-run ran separately from browser QA. Both reports are retained in [performance-2026-09-20.json](performance-2026-09-20.json).

Workload: 300 synthetic, log-heavy reports, each with 12,000 body characters. Five warmup iterations per operation; 30 ranking samples, 30 demo HTTP samples, and 20 preview HTTP samples. Preview uses a local GitHub stub, and no Jev requests occur. Environment: Windows x64, Node v22.23.2, AMD Ryzen 5 7500F.

| Metric | Before | After |
|---|---:|---:|
| Ranking median | 88.29 ms | 30.71 ms |
| Ranking p95 | 103.87 ms | 32.82 ms |
| Preview HTTP median | 96.10 ms | 46.67 ms |
| Preview HTTP p95 | 117.51 ms | 53.10 ms |
| Demo HTTP median | 15.24 ms | 15.56 ms |
| Demo HTTP p95 | 16.02 ms | 16.33 ms |
| Whole benchmark process peak RSS | 295.60 MiB | 115.63 MiB |

Ranking median fell by about **65%** in this workload. Peak RSS includes fixture creation, HTTP work, and the runtime; it is not an isolated ranking allocation measurement. Demo timing was essentially unchanged and slightly higher in this sample. These are sequential, single-machine observations, not a production load test or a general speed guarantee. Shorter reports and larger query vocabularies can behave differently.

## Remaining limits

- GitHub and Jev network latency can dominate local computation. GitHub requests are sequential with 15-second per-request deadlines; up to five Jev comparisons are sequential with 20-second deadlines each. This review did not remeasure live model latency, throughput, or classification quality.
- An oversized GitHub page now fails clearly instead of being partially accepted. Exceptionally large issue pages may require a future smaller-page import strategy.
- Lexical retrieval may miss synonyms, multilingual matches, and old duplicates outside the 300-item scan. No recall benchmark or independent real-issue accuracy evaluation was added.
- The app is not an authenticated shared service. Connection and upload limits do not protect against a malicious local user who can repeatedly access the process.
- No full penetration test, operating-system audit, or exhaustive dependency/CVE assessment was performed. There are no third-party production packages to scan with npm audit; Node's bundled dependencies still matter.

Runtime check: installed Node v22.23.2 includes Undici 6.28.0 and llhttp 9.4.3, matching the patched 22.x release listed in Node's [July 2026 security advisory](https://nodejs.org/en/blog/vulnerability/july-2026-security-releases). This is an advisory/version check, not a guarantee of absence of unknown vulnerabilities. HTTP timeouts follow [Node HTTP guidance](https://nodejs.org/api/http.html#serverrequesttimeout); nonce-based CSP follows [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

## English-language provenance

Current code, comments, documentation, UI, and fixtures use English. The archived smoke report now labels its English evidence translations and links to immutable originals. Choices, confidence, latency, costs, and the 2/4 example-label agreement were not changed. English fixtures were not sent to the paid API. Old Git commits remain unchanged; `node scripts/check-language.mjs` prevents reintroducing Hangul into current repository text.
