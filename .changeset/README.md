# Changesets

This directory holds changesets used to manage this project's releases. See
[RELEASING.md](../docs/RELEASING.md) for the full release workflow.

Quick version: run `pnpm changeset` after making a change worth mentioning in
the changelog, answer the prompts, and commit the generated `.md` file
alongside your change.

Read the [changesets documentation](https://github.com/changesets/changesets)
for details on what changesets are and how they work.

## Summary conventions

- A `major` bump: the summary starts with `**BREAKING:**` and links its
  section of the upgrade guide (`docs/guides/upgrading-*.md#...`). The GitHub
  Release carries the summary as-is. `pnpm run check:changesets` fails a
  `major` changeset without the marker.
- A change whose rendered SVG or ASCII output changes: the summary says
  "Output change". Output changes are minor or patch unless a documented
  output contract changes (then it is a major, with `**BREAKING:**`).
- Docs-, CI- and test-only changes: an empty changeset (`pnpm changeset add --empty`).

Which bump a change needs: the
[versioning policy](../docs/decisions/versioning-and-deprecation-policy-1568.md).
Majors are batched, at most one per 30 days; see "Batching majors" in
[RELEASING.md](../docs/RELEASING.md).
