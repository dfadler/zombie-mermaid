# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Area, source and milestone conventions (#1588)

Triage roles above say _what state_ an issue is in. These say _where_ it lives and _who filed it_. Status: **proposed**. None of the labels or milestones below exist yet; the maintainer creates them with the checklist at the end. Until then, don't apply them.

Existing type labels stay as they are: `bug`, `enhancement`, `chore`, `refactor`, `documentation`, `accessibility`, plus workflow-managed ones (`upstream-tracking`, `mermaid-release`, `form-judge-report`, `layout-oracle`, `mentions-report`, `release-age-blocked`, `untrusted-upstream-data`, `breaking`, `blocked`, `deferred`). Don't apply the workflow-managed ones by hand.

### `area:*` (one per issue, two at most)

Named after the package or surface the fix touches, so the `issue-batch` skill can see that two issues share a module and keep them out of the same wave.

| Label          | Covers                                                  |
| -------------- | ------------------------------------------------------- |
| `area:ascii`   | `packages/ascii-renderer`, `packages/ascii-layout`      |
| `area:svg`     | `packages/svg-renderer`                                 |
| `area:parser`  | `packages/mermaid-parser`                               |
| `area:layout`  | `packages/elk-layout`, layout oracle                    |
| `area:cli`     | `packages/cli`, `packages/mcp`                          |
| `area:site`    | `packages/site`, `demo/`, SSR, GitHub Pages             |
| `area:ci`      | `.github/workflows/**`, `scripts/`, tooling, dependency |
| `area:docs`    | `docs/**`, README, CONTRIBUTING, guides                 |
| `area:release` | changesets, publishing, versioning                      |

If #1588's finer ascii split (`ascii-routing`, `ascii-sequence`) proves useful for collision detection, split `area:ascii` later; renaming a label keeps its issues.

### `source:*` (exactly one)

| Label             | Meaning                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `source:agent`    | Drafted or filed by an agent (nearly all issues today are filed from the maintainer account) |
| `source:external` | Reported by someone outside the maintainer account                                           |
| `source:human`    | Written by the maintainer by hand                                                            |

`source:agent` vs `source:external` is what makes the dashboard first-reply metric (#1530) meaningful: it should count external issues only. Agents add `source:agent` when they file an issue; there is no automation for this yet.

### Milestones: one per release train

A milestone is the next published version of `zombie-mermaid`, named by its semver (`5.10.0`; the latest tag at the time of writing is `zombie-mermaid@5.9.1`). Issues and PRs planned for that release go in it; unplanned work has no milestone. Close the milestone when the "Version Packages" PR publishes. A `breaking` change goes in the next major's milestone (`6.0.0`). Milestones don't replace changesets: the bump type is still decided by the changeset, not the milestone.

### Maintainer checklist: create the labels and milestones

Not run by anyone yet. Review the names and colors, then run from a clone:

```sh
# area:*
gh label create area:ascii   -d "ASCII renderer and layout"          -c 1D76DB
gh label create area:svg     -d "SVG renderer"                       -c 1D76DB
gh label create area:parser  -d "Mermaid parser"                     -c 1D76DB
gh label create area:layout  -d "ELK layout and layout oracle"       -c 1D76DB
gh label create area:cli     -d "CLI and MCP server"                 -c 1D76DB
gh label create area:site    -d "Site, demo, SSR, Pages"             -c 1D76DB
gh label create area:ci      -d "Workflows, scripts, tooling"        -c 1D76DB
gh label create area:docs    -d "Documentation"                      -c 1D76DB
gh label create area:release -d "Changesets, publishing, versioning" -c 1D76DB
# source:*
gh label create source:agent    -d "Drafted or filed by an agent"    -c C5DEF5
gh label create source:external -d "Reported by an outside user"     -c C5DEF5
gh label create source:human    -d "Written by the maintainer"       -c C5DEF5
# first release-train milestone
gh api repos/dfadler/zombie-mermaid/milestones -f title=5.10.0
```

Backfilling the ~88 unlabeled issues, and finding out why `issue-bot` skipped 30 of the last 60 runs, are separate steps from #1588 and not covered here.
