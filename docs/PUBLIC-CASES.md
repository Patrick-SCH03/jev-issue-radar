# Public issue case studies

Checked on 2026-09-20 UTC / 2026-09-21 KST. These three duplicate relationships were selected and documented before running retrieval. They are curated examples, not a representative or independently sampled benchmark.

**Result: 0/3 known canonical issues appeared in the top five.** All three canonical issues were absent from the recent-300-item scan. No Jev calls were made, so this measures a retrieval boundary and says nothing about the model's classification accuracy.

| Case | Report and known canonical issue | Evidence for the relationship | Current retrieval |
|---|---|---|---|
| VS Code remote icons | [#336130](https://github.com/microsoft/vscode/issues/336130) → [#334144](https://github.com/microsoft/vscode/issues/334144) | A [triage comment links the canonical report](https://github.com/microsoft/vscode/issues/336130#issuecomment-5664000148); the repository then [closes it as a duplicate](https://github.com/microsoft/vscode/issues/336130#issuecomment-5664039857). | Canonical issue outside the scan; not retrieved |
| Node.js missing month names | [#64176](https://github.com/nodejs/node/issues/64176) → [#63041](https://github.com/nodejs/node/issues/63041) | A [repository member identifies the duplicate](https://github.com/nodejs/node/issues/64176#issuecomment-4822940572), connecting Temporal formatting with the earlier iso8601 calendar report. | Canonical issue outside the scan; not retrieved |
| Node.js error inspection | [#60948](https://github.com/nodejs/node/issues/60948) → [#60717](https://github.com/nodejs/node/issues/60717) | The [reporter links the earlier issue](https://github.com/nodejs/node/issues/60948#issuecomment-3610948026), and a [repository member confirms the same property-descriptor issue](https://github.com/nodejs/node/issues/60948#issuecomment-3611411159). | Canonical issue outside the scan; not retrieved |

These are useful challenges because reporters can describe the same underlying problem through different surfaces: activity-bar icons versus a remote font loader, Temporal versus Intl.DateTimeFormat, and console.error versus util.inspect. They also demonstrate why a successful pair classifier cannot compensate for an absent candidate.

## Reproduce

~~~bash
node scripts/check-public-cases.mjs
~~~

The command reads public GitHub issues through the same importer and ranking function used by the application. It performs no GitHub writes and makes no paid requests. It saves links, scan coverage, candidate scores, timing, and failures to `reports/public-cases.json`; raw bodies, author profiles, and system information are not saved.

- [Preselected reference manifest](../data/public-cases.json)
- [Recorded results](public-cases-2026-09-21.json)

The candidate pool changes as repository issues and pull requests are updated. Pull requests count toward the 300 fetched items before exclusion. Re-running may therefore produce different coverage and rankings. There are no negative pairs here, so precision and false-positive rates are not measured. Labels in this document come from the linked repository discussions, not from Jev.

## Next evaluation target

Evaluate repository search or a historical issue index against a fixed, broader set of duplicate and nonduplicate pairs. Keep this three-case set as visible regression examples, and report held-out retrieval recall separately from pair classification. Until broader coverage is implemented, use the tool as an experimental recent-issue triage aid rather than a complete duplicate search.
