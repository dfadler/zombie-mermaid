---
title: Three majors in 13 days, from 3.0 to 5.0
date: 2026-10-10
description: zombie-mermaid shipped 3.0.0 on 2026-09-28, 4.0.0 on 2026-10-02 and 5.0.0 on 2026-10-10. What each major changed, taken from the release notes, and what the pace says about how this repo releases.
---

`zombie-mermaid` went from 2.x to 5.0 in under two weeks. Three major versions
landed between 2026-09-28 and 2026-10-10: 3.0.0, 4.0.0 and 5.0.0. Counting
both end days, that is 13 calendar days. This post lists what each major
actually changed, using the published GitHub release notes, and then looks at
why the numbers moved so fast.

## The three releases

| Version | Published (UTC) | The breaking change |
| --- | --- | --- |
| 3.0.0 | 2026-09-28 | Removed the unused `componentSpacing` option from the render options types ([#1122](https://github.com/dfadler/zombie-mermaid/pull/1122)) |
| 4.0.0 | 2026-10-02 | Node 24 or newer, `engines.node` `>=24` ([#1291](https://github.com/dfadler/zombie-mermaid/pull/1291)) |
| 5.0.0 | 2026-10-10 | `elkjs` becomes an optional peer dependency ([#1444](https://github.com/dfadler/zombie-mermaid/pull/1444), from [#1370](https://github.com/dfadler/zombie-mermaid/issues/1370)) |

All six packages share one version number through the repo's fixed changeset
group, so a major in one is a major in all of them. Between the majors there
were minor and patch releases: 3.1.0, 3.2.0, 4.1.0, 4.2.0 through 4.2.3, and a
5.0.1 patch on the same day as 5.0.0. That is 11 releases from 3.0.0 through
5.0.1.

### 3.0.0: a type-level removal

The 3.0.0 release removed `componentSpacing` from `RenderOptions` and
`FlowchartRenderOptions` in `@zombie-mermaid/core`. Per the release note, no
renderer ever read the field, so runtime behavior did not change. The only
visible effect is for TypeScript users who passed `componentSpacing` in a
strictly typed object literal, who now get a type error. That is a breaking
change to the public types, which is why it was a major, even though nothing
that ran before stops running.

### 4.0.0: Node 24 or newer

PR #1291 changed `engines.node` from `>=22` to `>=24`. The release note says
"Node 22 is no longer supported" and ties the change to the broader Node 24
move tracked in [#1266](https://github.com/dfadler/zombie-mermaid/issues/1266).

That is the whole factual record of the change: the declared `engines` field
moved. Whether Node 24 is what consumers actually need at runtime is a
separate question, and it is still open. [#1567](https://github.com/dfadler/zombie-mermaid/issues/1567)
asks what the real consumer floor should be, and the discussion there treats
it as undecided, with evidence still being gathered. This post does not claim
a consumer floor either way. If you run on Node 22 and see an engines warning
or failure after upgrading to 4.x, that is the declared field doing what it
says; follow #1567 for where the project lands.

The 4.0.0 release also carried a long list of ASCII and SVG rendering fixes in
its patch section, such as `RL` direction flowing right to left in ASCII output
and class diagram attributes rendering in source order. Those are not the
reason for the major, but they ship in the same version.

### 5.0.0: elkjs is now yours to register

The 5.0.0 change is the one that needs code changes. `elkjs`, the layout
engine behind flowchart, state, class, ER and architecture diagrams, is now an
optional peer dependency of `@zombie-mermaid/svg-renderer`, and the library no
longer imports it. Per the release note:

- Browser and bundler apps that render those diagram types must install
  `elkjs` and call `registerElk(ELK)` once, importing ELK from
  `elkjs/lib/elk.bundled.js`. Without it, rendering those diagrams throws
  `ElkNotRegisteredError`.
- Under Node and Bun, `elkjs` is auto-loaded when installed. The
  `zombie-mermaid` umbrella package and `@zombie-mermaid/mcp` still depend on
  it, so the CLI and MCP server need no change.
- Sequence, pie, xychart, C4 and ASCII output never needed `elkjs`.
- The trade: the SVG renderer's browser bundle drops from about 518 KB to 74 KB
  gzipped (the umbrella from 576 KB to 130 KB) when `elkjs` is not registered.

The motivation is on [#1370](https://github.com/dfadler/zombie-mermaid/issues/1370),
which measured an SVG-only bundle at about 500 KB gzipped, almost all of it
`elkjs`. That issue first proposed a lazy-loading async entry point; the change
that shipped, #1444, took the optional-peer route instead. The repo's
`docs/guides/elkjs-optional-peer.md` has the details.

The same release range includes a smaller change that is not a major in
itself: PR [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446) stopped
publishing `src/` in the package tarballs, since the source maps already embed
it through `sourcesContent`, and dropped an unused `entities` dependency
declaration from the MCP package. It is listed as a patch change in the 5.0.0
notes.

## Why the numbers moved so fast

A major version here means "a consumer may have to change something," not "a
big release." The three changes above are each small and unrelated to one
another: a type field, an `engines` range, a peer dependency. Each was decided
and merged on its own schedule, and the release tooling turns each one into a
major as soon as its changeset reaches `main`.

The release process makes that quick. The publish workflow runs on every push
to `main`, so the pending Version PR is regenerated after each merge, and
merging it publishes all six packages together. The project's own release
cadence review (in [#1590](https://github.com/dfadler/zombie-mermaid/issues/1590))
counted 16 releases between 2026-09-08 and 2026-10-10 and 20 "version packages"
PRs since 09-06, and noted that the pull request template has a changeset
checkbox but no prompt asking whether a change is breaking. Options for
batching releases and gating majors are under discussion there and in
[#1568](https://github.com/dfadler/zombie-mermaid/issues/1568), so the cadence
may change.

If you pin by range, three majors in 13 days means a `^3` range will not pick
any of this up on its own. Read the release notes for each major you cross.
Of the three, only 5.0.0 requires code changes for browser and bundler users
of the SVG renderer, and only 4.0.0 changes the declared Node range.

## Where to read more

- [3.0.0 release notes](https://github.com/dfadler/zombie-mermaid/releases/tag/zombie-mermaid%403.0.0)
- [4.0.0 release notes](https://github.com/dfadler/zombie-mermaid/releases/tag/zombie-mermaid%404.0.0)
- [5.0.0 release notes](https://github.com/dfadler/zombie-mermaid/releases/tag/zombie-mermaid%405.0.0)
