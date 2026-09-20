# Launch copy and distribution

All copy below describes shipped behavior and keeps the public sample separate from measured model output. The release and Awesome Jev update are the initial distribution channels. The Show HN copy is a draft, not a claim that it has been submitted.

## GitHub release

Title: **v0.2.0 — Try issue triage in your browser**

Jev Issue Radar now has a public sample you can try without installing software, creating an account, or entering an API key.

- [Try the sample](https://patrick-sch03.github.io/jev-issue-radar/): filter candidate reports, inspect passages side by side, switch themes, and export JSON.
- [Watch the 15-second tour](https://github.com/Patrick-SCH03/jev-issue-radar/blob/main/docs/demo-tour.gif).
- [Run the local app](https://github.com/Patrick-SCH03/jev-issue-radar#quickstart) to retrieve your own public GitHub issues and explicitly opt into Jev comparisons through OpenRouter.

The hosted sample contains synthetic reports and hand-authored decisions. It makes no live AI calls. Real-repository detection quality is still unestablished: a [three-case retrieval check](https://github.com/Patrick-SCH03/jev-issue-radar/blob/main/docs/PUBLIC-CASES.md) found that all three known canonical issues were outside the current recent-300-item scan. That limitation is public, and broader candidate coverage is the next evaluation target.

Feedback on the evidence-comparison workflow and independently labeled issue pairs is welcome. The tool never closes issues or posts comments.

## Awesome Jev update

Jev Issue Radar now has a public, no-install sample: https://patrick-sch03.github.io/jev-issue-radar/

It lets visitors filter the four sample relationships, inspect evidence, and export JSON without an API key. The sample uses explicitly labeled synthetic reports and hand-authored decisions; the local app retains the real Jev integration.

The English README now includes a [15-second tour](https://github.com/Patrick-SCH03/jev-issue-radar/blob/main/docs/demo-tour.gif), [setup instructions](https://github.com/Patrick-SCH03/jev-issue-radar#quickstart), and [public-case results and limitations](https://github.com/Patrick-SCH03/jev-issue-radar/blob/main/docs/PUBLIC-CASES.md). The three-case check found a retrieval coverage limitation, which is reported without claiming model accuracy.

This is an update to the already-listed project, not a new submission. The demo URL may be useful for the catalog entry.

## Show HN draft

Title: **Show HN: Jev Issue Radar — compare GitHub issues with inspectable evidence**

URL: https://patrick-sch03.github.io/jev-issue-radar/

Jev Issue Radar is an experimental GitHub issue-triage tool. The local app retrieves candidates, asks TypeSafe Jev to select a relationship and evidence IDs, and shows the original passages for a maintainer to inspect. It never closes an issue or posts a comment.

The linked sample is immediately usable without signup or keys. Its decisions are hand-authored examples, not live AI output. The source repository includes the real OpenRouter decision call, offline tests, measured integration results, and a recent public-case check that exposed a limitation: scanning only recent issues missed all three known older canonical reports.

Feedback is especially useful on two questions: whether the paired-evidence view helps review candidates, and how to evaluate broader candidate retrieval without hiding false positives or missed duplicates.

Repository: https://github.com/Patrick-SCH03/jev-issue-radar

Before posting, the account owner should be available to answer questions and follow the [Show HN guidelines](https://news.ycombinator.com/showhn.html). Do not request coordinated votes.

## Discovery and follow-up

- Repository homepage: the public demo.
- Topics: developer-tools, duplicate-detection, github-issues, issue-triage, jev, openrouter, typesafe, javascript, open-source.
- Keep the README's demo link and tour before implementation details.
- Prioritize candidate coverage and a held-out evaluation before making detection-quality claims.
- Assess feedback, issue reports, and actual use alongside stars. This release does not promise a star count or create recurring notifications.
