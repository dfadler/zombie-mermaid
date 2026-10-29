# Decisions

Short, rare records of settled decisions. Not an ADR process — no numbering, no template tooling, just a page per decision when one is warranted. Each page carries one `Status:` line, and the index below is kept by hand.

## When to add one

Only when both are true:

- It closes off an alternative someone (human or agent) would plausibly re-propose later.
- The reasoning isn't already obvious from the code or an existing doc.

Most changes don't need one. Don't write new records for past decisions, or write one speculatively — add it the first time a qualifying decision actually comes up. Keeping the `Status:` line and the index row of an existing doc current is not backfilling, and is expected.

Investigation findings (method, measurements, tables) belong on the issue, per [docs/research/README.md](../research/README.md); a decision page keeps the decision and its consequences and links to the issue comment. `ascii-browser-font-investigation-978.md` and `ascii-orientation-audit-vs-beautiful-mermaid-1372.md` stay here for that reason ([#1937](https://github.com/dfadler/zombie-mermaid/issues/1937)): each closes off an alternative and carries a `Status:` line.

## Format

One page, one decision:

```
# Title

Status: implemented

## Context

What prompted the decision — the problem or question.

## Decision

What was decided.

## Consequences

What this rules out, what it trades off, what follows from it.
```

## Status

One line under the title: `Status: <value>`, optionally followed by a short parenthetical. The value is the doc's _current_ outcome; the history of amendments stays in the body.

- `proposal` — written, not yet decided or acted on.
- `accepted` — decided; no code to point at (a policy), or only partly acted on.
- `implemented` — decided, and the code or config it describes exists.
- `not adopted` — decided against; the doc keeps the alternative from being re-proposed.
- `superseded` / `partially superseded` — a later change reversed all or part of it; say which in the parenthetical.
- `historical` — describes a tree or state that no longer exists; kept unedited.
- `unverified` — the outcome could not be confirmed against the code or the linked issue.

Set a status only after checking the doc against the code or issues it cites; if you can't, use `unverified`. `pnpm run check:docs` fails on a doc with no valid `Status:` line or no row in the index below.

## Index

Add a row when you add a doc; update the status when it changes. The issue column is the doc's main issue, not every issue it mentions.

| Doc                                                                                                              | Status               | Issue                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------- |
| [architecture-lowered-to-flowchart-1167.md](architecture-lowered-to-flowchart-1167.md)                           | implemented          | [#1167](https://github.com/dfadler/zombie-mermaid/issues/1167) |
| [ascii-browser-font-investigation-978.md](ascii-browser-font-investigation-978.md)                               | implemented          | [#978](https://github.com/dfadler/zombie-mermaid/issues/978)   |
| [ascii-class-diagram-x-coordinate-assignment-970.md](ascii-class-diagram-x-coordinate-assignment-970.md)         | implemented          | [#970](https://github.com/dfadler/zombie-mermaid/issues/970)   |
| [ascii-occupancy-unification-532.md](ascii-occupancy-unification-532.md)                                         | implemented          | [#532](https://github.com/dfadler/zombie-mermaid/issues/532)   |
| [ascii-orientation-audit-vs-beautiful-mermaid-1372.md](ascii-orientation-audit-vs-beautiful-mermaid-1372.md)     | implemented          | [#1372](https://github.com/dfadler/zombie-mermaid/issues/1372) |
| [ascii-pty-snapshot-suite-1151.md](ascii-pty-snapshot-suite-1151.md)                                             | not adopted          | [#1151](https://github.com/dfadler/zombie-mermaid/issues/1151) |
| [ascii-seven-pixel-cell-1199.md](ascii-seven-pixel-cell-1199.md)                                                 | implemented          | [#1199](https://github.com/dfadler/zombie-mermaid/pull/1199)   |
| [ascii-vertical-edge-label-placement-1385.md](ascii-vertical-edge-label-placement-1385.md)                       | implemented          | [#1385](https://github.com/dfadler/zombie-mermaid/issues/1385) |
| [cli-and-demo-stay-apps.md](cli-and-demo-stay-apps.md)                                                           | implemented          | [#416](https://github.com/dfadler/zombie-mermaid/issues/416)   |
| [cluster-exit-anchoring-1148-prerequisites-1164-1165.md](cluster-exit-anchoring-1148-prerequisites-1164-1165.md) | implemented          | [#1165](https://github.com/dfadler/zombie-mermaid/issues/1165) |
| [cluster-exit-anchoring-recommendation-1135.md](cluster-exit-anchoring-recommendation-1135.md)                   | implemented          | [#1135](https://github.com/dfadler/zombie-mermaid/issues/1135) |
| [cluster-exit-anchoring-scoping-1135.md](cluster-exit-anchoring-scoping-1135.md)                                 | implemented          | [#1135](https://github.com/dfadler/zombie-mermaid/issues/1135) |
| [consumer-node-floor-1567.md](consumer-node-floor-1567.md)                                                       | implemented          | [#1567](https://github.com/dfadler/zombie-mermaid/issues/1567) |
| [core-bindings-split-not-adopted.md](core-bindings-split-not-adopted.md)                                         | not adopted          | [#540](https://github.com/dfadler/zombie-mermaid/issues/540)   |
| [decision-doc-self-review-checklist-977.md](decision-doc-self-review-checklist-977.md)                           | accepted             | [#977](https://github.com/dfadler/zombie-mermaid/issues/977)   |
| [diagram-gallery-layout.md](diagram-gallery-layout.md)                                                           | implemented          | [#712](https://github.com/dfadler/zombie-mermaid/issues/712)   |
| [diagram-gallery-scope.md](diagram-gallery-scope.md)                                                             | implemented          | [#598](https://github.com/dfadler/zombie-mermaid/issues/598)   |
| [diagram-tag-search.md](diagram-tag-search.md)                                                                   | implemented          |                                                                |
| [diagram-type-registry-partial.md](diagram-type-registry-partial.md)                                             | superseded           | [#533](https://github.com/dfadler/zombie-mermaid/issues/533)   |
| [editor-in-repo-module.md](editor-in-repo-module.md)                                                             | implemented          | [#398](https://github.com/dfadler/zombie-mermaid/issues/398)   |
| [editor-state-slices-not-adopted.md](editor-state-slices-not-adopted.md)                                         | not adopted          | [#1085](https://github.com/dfadler/zombie-mermaid/issues/1085) |
| [elkjs-optional-peer-1370.md](elkjs-optional-peer-1370.md)                                                       | implemented          | [#1370](https://github.com/dfadler/zombie-mermaid/issues/1370) |
| [go-core-renderer-proposal.md](go-core-renderer-proposal.md)                                                     | not adopted          | [#495](https://github.com/dfadler/zombie-mermaid/issues/495)   |
| [layout-architecture-scoping.md](layout-architecture-scoping.md)                                                 | implemented          | [#538](https://github.com/dfadler/zombie-mermaid/issues/538)   |
| [lockstep-versioning.md](lockstep-versioning.md)                                                                 | implemented          | [#1550](https://github.com/dfadler/zombie-mermaid/issues/1550) |
| [monorepo-conversion-scoping.md](monorepo-conversion-scoping.md)                                                 | historical           |                                                                |
| [monorepo-conversion.md](monorepo-conversion.md)                                                                 | implemented          | [#622](https://github.com/dfadler/zombie-mermaid/issues/622)   |
| [monorepo-test-layout-627.md](monorepo-test-layout-627.md)                                                       | implemented          | [#627](https://github.com/dfadler/zombie-mermaid/issues/627)   |
| [no-script-interactivity.md](no-script-interactivity.md)                                                         | implemented          | [#216](https://github.com/dfadler/zombie-mermaid/issues/216)   |
| [pie-highlight-slice-static-1726.md](pie-highlight-slice-static-1726.md)                                         | implemented          | [#1726](https://github.com/dfadler/zombie-mermaid/issues/1726) |
| [playwright-docker-image-visual-regression.md](playwright-docker-image-visual-regression.md)                     | partially superseded | [#544](https://github.com/dfadler/zombie-mermaid/issues/544)   |
| [project-objective-1564.md](project-objective-1564.md)                                                           | proposal             | [#1564](https://github.com/dfadler/zombie-mermaid/issues/1564) |
| [react-site-migration-plan.md](react-site-migration-plan.md)                                                     | implemented          | [#423](https://github.com/dfadler/zombie-mermaid/issues/423)   |
| [scoped-svg-ids-1397.md](scoped-svg-ids-1397.md)                                                                 | implemented          | [#1397](https://github.com/dfadler/zombie-mermaid/issues/1397) |
| [self-hosted-runner-docker-cache.md](self-hosted-runner-docker-cache.md)                                         | not adopted          | [#738](https://github.com/dfadler/zombie-mermaid/issues/738)   |
| [simple-layout-1685.md](simple-layout-1685.md)                                                                   | implemented          | [#1685](https://github.com/dfadler/zombie-mermaid/issues/1685) |
| [site-generators-react-migration.md](site-generators-react-migration.md)                                         | superseded           | [#423](https://github.com/dfadler/zombie-mermaid/issues/423)   |
| [tarballs-ship-dist-only-1426.md](tarballs-ship-dist-only-1426.md)                                               | implemented          | [#1426](https://github.com/dfadler/zombie-mermaid/issues/1426) |
| [theme-selector-shared-state.md](theme-selector-shared-state.md)                                                 | implemented          | [#685](https://github.com/dfadler/zombie-mermaid/issues/685)   |
| [versioning-and-deprecation-policy-1568.md](versioning-and-deprecation-policy-1568.md)                           | accepted             | [#1568](https://github.com/dfadler/zombie-mermaid/issues/1568) |
