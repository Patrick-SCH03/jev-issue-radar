# Public sample

Open [Jev Issue Radar](https://patrick-sch03.github.io/jev-issue-radar/) without installing software, signing in, or entering a key.

The sample supports candidate selection, relationship filters, side-by-side evidence, full reports, light/dark themes, and JSON export. Its four reports and decisions are hand-authored examples. Confidence is explicitly illustrative. It does not fetch live GitHub issues or call Jev. To analyze your own public reports, follow the repository's [local setup](../README.md#quickstart).

## Build and verify

~~~bash
node scripts/build-demo.mjs
node --test tests/check_all.mjs
node scripts/browser-demo.mjs
~~~

The build writes only an HTML page, content-hashed JavaScript/CSS, and `.nojekyll` to `dist/`. It reuses the application's UI and the exact same synthetic snapshot as the local demo. It does not read environment credentials. A Content Security Policy blocks network connections from the sample; the browser only downloads its own static assets.

Browser QA requires optional Playwright and an installed browser. `PLAYWRIGHT_MODULE` can point to an existing module and `PLAYWRIGHT_CHANNEL=msedge` can select Edge. To check the deployed site, set `DEMO_URL=https://patrick-sch03.github.io/jev-issue-radar/` before running `scripts/browser-demo.mjs`.

The Pages workflow builds from `main`, runs offline tests, and uploads only `dist/`. Deployment uses the `github-pages` environment. The local Node server remains a separate application; its server-side key and analysis endpoints are not deployed to Pages.

## Recorded tour

[The 15-second GIF](demo-tour.gif) is encoded from five actual browser screenshots. It shows the sample's real interactions rather than fabricated model results. [Frame descriptions and duration](demo-tour.json) are included for provenance; a [static screenshot](demo.png) is also available.

To recreate it, run `node scripts/record-demo.mjs` with optional Playwright and Sharp installed. `SHARP_MODULE` can point to an existing Sharp module. These are development-only tools; the app and static build still have no third-party production dependencies.
