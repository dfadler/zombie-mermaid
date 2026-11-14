# Holding queued major PRs without staleness

Status: proposal

## Decision

- Proposal: option A now (hold the PR open), with D (shrink what is held) encouraged where a change splits.
- Trigger to adopt B (a `next` branch), numbers for the maintainer to set: two or more queued majors touching overlapping files, a queued major other work builds on, or #1873/#1874 being scheduled.
- Not recommended: C (B plus Changesets pre mode), and dropping the one-major-per-30-days gate.
- The real risk with A is nobody refreshing the PR, which a named owner and a refresh date fix.
- The maintainer questions stay open on the issue.

Full write-up: https://github.com/dfadler/zombie-mermaid/issues/1940#issuecomment-6884737240
