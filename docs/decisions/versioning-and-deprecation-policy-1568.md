# Versioning and deprecation policy

Status: **accepted, one choice open** (batching gap, section 3). Tracks
[#1568](https://github.com/dfadler/zombie-mermaid/issues/1568), part of
[#1502](https://github.com/dfadler/zombie-mermaid/issues/1502).

## Context

Lockstep versioning (`.changeset/config.json`'s `fixed` group, all six
packages) shipped 3.0.0, 4.0.0 and 5.0.0 between 2026-09-28 and 2026-10-10.
Majors were driven by a Node floor raise (4.0.0, `engines.node >=24`,
[#1291](https://github.com/dfadler/zombie-mermaid/issues/1291)) and an
optional peer dependency (5.0.0, `elkjs`,
[#1444](https://github.com/dfadler/zombie-mermaid/pull/1444)). Nothing writes
down what counts as breaking, so each call was made ad hoc. The lockstep
rationale itself is [#1550](https://github.com/dfadler/zombie-mermaid/issues/1550)'s
job; this doc covers only the rules.

Premise check (the issue was written from a report, not from code):

- **GitHub Releases already exist.** `docs/RELEASING.md` documents
  `create-github-releases: true`, and `gh release list` shows per-package
  releases (e.g. `zombie-mermaid@5.0.1`) whose bodies are the changeset
  entry, including the `**BREAKING:**` text for 5.0.0. What is thin is the
  root `CHANGELOG.md`, tracked in
  [#1559](https://github.com/dfadler/zombie-mermaid/issues/1559); not
  re-decided here.
- **Unaffected packages do bump.** The `fixed` group forces one version
  across all six; see section 2 for what a switch would take.
- The upgrade guide exists: [`docs/guides/upgrading-2x-to-5x.md`](../guides/upgrading-2x-to-5x.md)
  ([#1538](https://github.com/dfadler/zombie-mermaid/issues/1538), shipped in
  [#1657](https://github.com/dfadler/zombie-mermaid/pull/1657)). It covers 2.x to 5.x only,
  so a future major needs its own guide before it can be deprecated against.

## Decision

Status: **accepted**, with one number still needing the maintainer (batching
gap, section 3). The maintainer's lean on 2026-10-11 resolved the other open
choices from the draft; this section records the result.

### 1. What counts as breaking (major)

A change is **major** if it can make a previously working consumer fail or
behave differently. Semver applies to the **published surface**: documented
exports and types, CLI flags and exit codes, MCP tool names and schemas, the
install contract, and documented output contracts (below). Major:

| Change                                                                                                                                    | Precedent                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Raises the `engines.node` floor                                                                                                           | 4.0.0                                                                                                                            |
| Adds a required peer dependency, or promotes/adds an optional one callers must install or call to keep a documented path working          | 5.0.0 `elkjs`                                                                                                                    |
| Removes or renames an export, CLI flag, MCP tool or parameter, or a path in `exports`                                                     |                                                                                                                                  |
| Removes or renames tarball contents that consumers import (including deep imports they reasonably rely on, e.g. `zombie-mermaid/src/...`) | 5.0.0 `src/` ([#1446](https://github.com/dfadler/zombie-mermaid/pull/1446)), shipped as a patch; this policy would make it major |
| Changes option semantics or defaults so existing calls behave differently                                                                 |                                                                                                                                  |
| Changes error behaviour for input that worked (see "Newly throwing input")                                                                |                                                                                                                                  |
| Drops a documented platform/runtime, or changes `.d.ts` so existing consumer code stops compiling                                         |                                                                                                                                  |
| Changes a documented output contract (see "Output changes")                                                                               |                                                                                                                                  |

Tarball contents nobody can import through `exports` or documentation (test
files, source maps, scratch files) are not breaking. Dev-only dependency and
build-time TypeScript bumps are not breaking while the published `.d.ts` and
the consumer compiler floor are unchanged. New diagram types, options and MCP
tools are minor.

**Newly throwing input.** Input that was silently ignored and now throws is
**minor** only when both hold: (a) it was a no-op before, meaning the output
for that input equalled the output with the construct removed, and (b)
mermaid.js itself rejects it, checked by running the pinned `mermaid`
version's `parse`/render on the same source (the check and result go in the
changeset). Otherwise it is **major**: that covers input mermaid.js accepts,
and input that previously rendered something. The decision rule is "would a
user who copy-pasted this from a working mermaid.js diagram now get an error".
If yes, major.

**Output changes.** SVG and ASCII output changes are **minor** (or patch for
a pure fix) unless they change a _documented API or documented output
contract_. Documented output contracts today: the accessibility guarantees in
[`docs/accessibility.md`](../accessibility.md), the CSS custom properties and
theme keys in [`docs/theming.md`](../theming.md), and output-shaped options
in [`docs/api-reference.md`](../api-reference.md) (e.g. an option documented
to produce a given structure). Layout, rounding (such as 2dp,
[#1163](https://github.com/dfadler/zombie-mermaid/issues/1163)), spacing and
glyph changes are not contracts. Every changeset for a change that alters
output must **say so in its summary** ("Output change: ...") so callers who
snapshot output can find it. Snapshot owners should pin a version or use a
tolerance. Anything undocumented stays out of the contract; to promote a
detail to a contract, document it first.

### 2. Unaffected packages

Target: a package with no change should not bump. **The repo does not
support that today.** `.changeset/config.json` has a single `fixed` group
with all six packages, and `fixed` means every package in the group is
released at one shared version whenever any member has a changeset
(the 3.2.0 to 5.0.1 tags show it). Separately, the five
`@zombie-mermaid/*` packages are depended on with `workspace:*`, so changesets
also bumps dependents (`updateInternalDependencies: "patch"`) even without
`fixed`.

What a switch would involve (not done here; this PR changes no release
config):

1. Remove (or shrink) the `fixed` group in `.changeset/config.json`. Packages
   then version independently. If some should stay in step (for example
   `core` with `mermaid-parser`), use `linked` for them instead.
2. Decide the umbrella `zombie-mermaid` version. It re-exports everything, so
   it would need a bump whenever any dependency bumps; independent versions
   mean users see `zombie-mermaid@5.3.0` pulling `svg-renderer@5.1.2`, and
   the "one number" lockstep story ([#1550](https://github.com/dfadler/zombie-mermaid/issues/1550))
   goes away.
3. Update `docs/RELEASING.md` (it states the lockstep behaviour), the
   deprecation commands in section 4 (versions no longer line up across
   packages, so a range per package), and the changeset guidance in
   CONTRIBUTING.
4. Verify `changesets/action` publishes correctly with unequal versions,
   using a dry-run on a branch.

Until a maintainer opts in to that, the policy is: lockstep stays, and
changeset summaries name the packages with real changes.

### 3. Batching majors

Hold breaking changes on an integration branch or a `breaking` label and
**ship at most one major per 30 days**, bundling whatever is queued.
Security fixes and breakage from an upstream dependency may ship immediately.
Three majors in 13 days is the anti-pattern.

**Still needs the maintainer: the gap length.** Recommendation: 30 days.
Reason: the project cut 3.0.0 on 2026-09-28 and 5.0.0 on 2026-10-10; 30
days is long enough that a batch of queued breaks fills, short enough that a
queued break is not stuck for a quarter. No reason found in the repo to pick
a different number.

### 4. Support and deprecation of old majors

Only the **latest major** is supported; fixes land there only.

Deprecate old majors with `npm deprecate`, pointing at the upgrade guide.
The commands are a manual maintainer step (CI publishes by OIDC and has no
token). For the current state, **3.x and 4.x** (the guide covers 2.x to 5.x;
1.x/2.x are not deprecated here):

```bash
GUIDE=https://github.com/dfadler/zombie-mermaid/blob/main/docs/guides/upgrading-2x-to-5x.md
for pkg in zombie-mermaid @zombie-mermaid/core @zombie-mermaid/mermaid-parser \
  @zombie-mermaid/svg-renderer @zombie-mermaid/ascii-renderer @zombie-mermaid/mcp; do
  npm deprecate "$pkg@>=3.0.0 <4.0.0" "3.x is no longer supported. Upgrade to 5.x: $GUIDE"
  npm deprecate "$pkg@>=4.0.0 <5.0.0" "4.x is no longer supported. Upgrade to 5.x: $GUIDE"
done
```

These were prepared for this decision and have **not been run**. Later
majors: run the same loop with `<N` after the new major publishes, once that
major has its own upgrade guide. Deprecation is reversible
(`npm deprecate "<pkg>@<range>" ""`) and does not break installs.

### 5. Release notes and GitHub Releases

Each major's changeset summary starts with `**BREAKING:**` and links the
upgrade-guide section. Releases are generated by `changesets/action`
(`create-github-releases: true`). As of 2026-10-11, 93 tags exist and 83
have releases. Missing: `@zombie-mermaid/svg-renderer@3.2.0` and
`@zombie-mermaid/ascii-renderer@3.2.0` (the other four 3.2.0 releases
exist), plus the eight inherited upstream `beautiful-mermaid` tags `v0.1.3`,
`v1.0.0`, `v1.0.1`, `v1.0.2`, `v1.1.0`, `v1.1.1`, `v1.1.2`, `v1.1.3`
(pre-fork, not this project's releases; leave them). So the "~60 tags need
backfill" premise is wrong: only two fork tags do. A not-run script for the
two is in the PR description. The root changelog is thin ([#1559](https://github.com/dfadler/zombie-mermaid/issues/1559));
not decided here.

## Resolved choices

1. Breaking definition, newly-throwing input, output changes: section 1.
2. Unaffected packages: no bump is the goal; not supported by the current
   `fixed` config; switch described in section 2; config untouched.
3. Deprecate 3.x and 4.x with the guide link: section 4, commands not run.
4. Backfill releases: only two fork tags missing, section 5.
5. Gap between majors: **open**, recommend 30 days (section 3).

## Self-review (decision-doc checklist, #977)

- **Edge cases:** a change that is both breaking and a security fix (ship
  immediately, still a major). A change touching one package (lockstep still
  bumps all six). A major whose only break is an optional peer (counts, per
  5.0.0). A deep import of a file that is not in `exports` and not
  documented: breaking to remove only if consumers import it as a supported
  path; this is a judgment call, so the changeset states which way it went.
  Newly throwing input where mermaid.js accepts it: major. Empty case: no
  queued breaking change means no major; the gap only limits how soon the
  next one may ship.
- **Boundaries:** "30 days" is elapsed calendar days between UTC publish
  dates: the next major is allowed when `next date - previous date >= 30`
  (a major published 1 Sep allows the next on 1 Oct, not 30 Sep). The
  deprecate ranges `>=3.0.0 <4.0.0` and `>=4.0.0 <5.0.0` are inclusive at
  the lower bound and exclusive at the upper, so they do not overlap and
  5.x stays undeprecated. Prereleases of 4.0.0 and 5.0.0 match neither; none
  are published.
- **Terminology:** "published surface" = anything reachable through
  `package.json` `exports`/`bin`, MCP schemas, or documented in
  `docs/api-reference.md`. "Documented output contract" = a guarantee in
  `docs/accessibility.md`, `docs/theming.md` or `docs/api-reference.md`.
  "No-op" = same output as with the construct removed.
- **Sub-issue scope:** #1756 and #1757 depend on this policy and are not
  decided here. #1538 (shipped) and #1559 are dependencies. A switch away
  from `fixed` (section 2) is explicitly not made here.
- **Precedent:** 4.0.0 / 5.0.0 reasons verified against the 5.0.0 GitHub
  Release body and `package.json` `engines` (`>=24`). The `#1446` row was
  verified: its changeset is listed as a Patch Change in 5.0.0's release.
  Tag/release counts verified from the repo's tag list and
  `gh release list` on 2026-10-11; published versions with `npm view <pkg> versions`.
