# Contributing

Issue Radar is an experimental, evidence-based GitHub triage tool. Small, focused contributions are welcome.

## Run locally

~~~bash
node server.mjs
node --test tests/check_all.mjs
node scripts/check-syntax.mjs
~~~

Node.js 22+ is required. The app and core tests have no third-party dependencies. The tests make no external requests; they use ephemeral local HTTP servers and mock providers.

## Useful contributions

- Independently labeled duplicate and non-duplicate issue pairs.
- Candidate-retrieval improvements, evaluated separately from Jev classification.
- Better definitions of related, distinct, and insufficient evidence.
- Reproducible bugs, clearer errors, and UI accessibility improvements.

Discuss large behavioral changes in an issue first. Include a concrete input, expected behavior, and a reproduction for bug reports.

## Pull requests

1. Keep changes focused on one problem.
2. Add a meaningful regression or property test to tests/check_all.mjs for changes to parsing, ranking, or decision policy.
3. Run the core and syntax checks.
4. For UI changes, test the actual interaction and inspect 375px and desktop layouts in light and dark mode.
5. Explain the resulting behavior, validation, and any remaining limitations.

Use Conventional Commits, such as feat(retrieval): add normalized error tokens or fix(evidence): reject unknown line identifiers. Keep documentation changes separate where practical.

The CI workflow runs syntax and offline checks. Publishing, deployment, and catalog submissions are separate actions.

## Model evaluation

- Do not silently invoke paid APIs in tests.
- Record the model version, request design, fixture provenance, cost, latency, failures, and all results.
- Fix labels and the evaluation protocol before observing model predictions.
- Keep UI examples distinct from measured outputs. Do not change expected labels just to match the model.
- Evaluate retrieval recall separately from pair classification. A classifier cannot recover a duplicate absent from its candidates.
- Do not commit API keys, personal issue data, local reports, or artifacts. The archived measurements in docs use only synthetic inputs.

## License

By contributing, you agree that your contribution is available under the repository's MIT license.
