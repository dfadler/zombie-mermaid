# Lockstep versioning across the six packages

Status: implemented

## Context

The monorepo publishes six packages: the umbrella `zombie-mermaid` and the five
`@zombie-mermaid/*` packages it depends on (`core`, `mermaid-parser`,
`svg-renderer`, `ascii-renderer`, `mcp`). Their versions had to be related
somehow once the five became publishable
([#622](https://github.com/dfadler/zombie-mermaid/issues/622),
[#769](https://github.com/dfadler/zombie-mermaid/issues/769)). The rationale was
written only inside the larger conversion docs, and
[#1550](https://github.com/dfadler/zombie-mermaid/issues/1550) asked for it as a
record of its own.

## Decision

All six packages share one version through the single `fixed` group in
`.changeset/config.json`: a changeset on any member releases all six at the same
number. Proposed in the conversion scoping
([`monorepo-conversion-scoping.md`](monorepo-conversion-scoping.md), section 2;
doc merged 2026-09-09 in #758) and implemented in
[#796](https://github.com/dfadler/zombie-mermaid/pull/796) (merged 2026-09-09).

The reasons given there:

- Publishing N new packages independently multiplies the manual npm trusted
  publishing setup by N and adds a release-ordering problem, with no consumer
  benefit: nobody depended on internal modules directly.
- It keeps the single-version, single-changelog mental model existing
  consumers already had.

Rejected: independent versions per package, and `linked` groups
([`versioning-and-deprecation-policy-1568.md`](versioning-and-deprecation-policy-1568.md),
section 2, lists what either would take). Unverified: whether any other
alternative was weighed in 2026-09; the scoping doc names only the above.

## Consequences

- A package with no change still bumps whenever a sibling is released
  (`gh release list` shows the umbrella, `svg-renderer` and `mcp` all at 5.7.1).
  Changeset summaries therefore name the packages with real changes; the policy
  doc above holds that rule while lockstep stays.
- One release cuts six tags and six GitHub Releases at one version
  (`docs/RELEASING.md`).
- Users see one number for the umbrella and its dependencies. Moving away from
  that takes the steps in section 2 of the policy doc and a maintainer opt-in;
  until then lockstep stays.
