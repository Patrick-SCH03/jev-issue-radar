# Security model

Jev Issue Radar is a single-user tool that listens on `127.0.0.1`. It is not designed to be exposed through a public tunnel, reverse proxy, or shared server. Use a maintained Node.js release with current security patches.

## Data and credentials

- GitHub access is read-only and unauthenticated. Only public issue titles, bodies, labels, and state are imported.
- The OpenRouter key stays in the server environment. It is not included in browser responses, exports, or source files.
- Live comparison requires both a key and `JEV_ENABLE_LIVE=1`. It sends the selected public issue text to OpenRouter. Review reports for sensitive content before choosing live analysis.
- The demo and candidate preview make no paid requests. `JEV_MAX_CALLS` limits attempted comparisons per server process, including failed attempts. It accepts integers from 1 to 100; invalid values stop startup. This is not a dollar budget, and restarting resets it. Use provider-side account limits for a spending cap.

## Boundaries

| Boundary | Protection |
|---|---|
| Browser to local server | Exact Host/Origin checks, cross-site Fetch Metadata rejection, random request token for POST routes |
| HTML rendering | Escaped issue/provider text and a fresh nonce-based Content Security Policy |
| Request uploads | 8 KiB body cap, 5-second body deadline, one active preview/analysis request |
| Connections | 8 KiB header cap, 5-second header timeout, 10-second HTTP request timeout, at most 32 sockets |
| Outbound destinations | Fixed GitHub/OpenRouter API hosts, validated issue URLs, redirects rejected |
| Outbound response parsing | Decoded byte caps: 8 MiB per GitHub response, 256 KiB per Jev response; per-request deadlines include body reads |
| Stored previews | At most 20 in-memory snapshots, valid for 10 minutes; no persistent issue database |
| Paid operations | Explicit opt-in, batch budget check, serialized calls, cached results to prevent repeated billing for the same preview |

The HTML nonce and POST request token serve different purposes. Neither protects against malicious software or other users already able to run programs on the same machine. Issue text is treated as untrusted data, but prompt instructions and evidence validation cannot guarantee that a model's classification is correct. The application does not close issues or write comments.

## Reporting

Report ordinary bugs through GitHub Issues with synthetic input and reproduction steps. For an exploitable vulnerability, use GitHub's private vulnerability reporting option if enabled, or contact the repository owner privately before publishing exploit details. Never include API keys or private issue content.

See the [dated security and performance review](docs/SECURITY-PERFORMANCE.md) for verified fixes, measurements, and remaining limitations.
