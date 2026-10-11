# Versioning and deprecation policy

Status: **draft, maintainer choices open** (see "Open choices"). Tracks
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
- **Unaffected packages do bump.** Intended: the `fixed` group forces one
  version across all six. The cost is noise, not a bug.
- The upgrade guide exists: [`docs/guides/upgrading-2x-to-5x.md`](../guides/upgrading-2x-to-5x.md)
  ([#1538](https://github.com/dfadler/zombie-mermaid/issues/1538), shipped in
  [#1657](https://github.com/dfadler/zombie-mermaid/pull/1657)). It covers 2.x to 5.x only,
  so a future major needs its own guide before it can be deprecated against.

## Decision (proposed)

### 1. What counts as breaking (major)

Semver applies to the **published surface**: documented exports and types,
CLI flags and exit codes, MCP tool names and input/output schemas, and the
install contract. Specifically, a change is **major** if it does any of:

| Change                                                                                                                                           | Major?                                             | Precedent                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------- |
| Raises `engines.node` floor                                                                                                                      | Yes                                                | 4.0.0                       |
| Adds or promotes a peer dependency (including optional) that callers must install or call to keep a documented path working                      | Yes                                                | 5.0.0 `elkjs`               |
| Removes or renames an export, CLI flag, MCP tool or tool parameter                                                                               | Yes                                                |                             |
| Removes a path listed in `exports` or documented as supported                                                                                    | Yes                                                |                             |
| Changes a documented option's default so existing calls render differently by design                                                             | Yes                                                |                             |
| Drops a documented platform or runtime (Bun, browser bundle shape)                                                                               | Yes                                                |                             |
| Changes published `.d.ts` so existing consumer code stops compiling, or raises the TypeScript version consumers need                             | Yes                                                |                             |
| Removes non-`exports` tarball contents (e.g. `src/`, [#1446](https://github.com/dfadler/zombie-mermaid/pull/1446))                               | No (patch); not public API                         | 5.0.0 shipped it as a patch |
| Changes rendered SVG/ASCII output (layout fixes, rounding such as 2dp [#1163](https://github.com/dfadler/zombie-mermaid/issues/1163))            | No; patch for fixes, minor for new visual features |                             |
| Raises a dev-only dependency or the build-time TypeScript version, leaving published `.d.ts` and the supported consumer compiler floor unchanged | No                                                 |                             |
| New diagram type, new option, new MCP tool                                                                                                       | Minor                                              |                             |

Rendered output is deliberately **not** covered by semver: byte-stable
output would freeze every layout fix. The contract is "valid Mermaid in,
a correct diagram out"; callers who snapshot output should pin a version
or use a tolerance. A fix that changes output must say so in its changeset
summary so snapshot owners can find it.

### 2. Unaffected packages

Keep the lockstep bump. One version number for the whole install is the
point of `fixed`; the changeset summary lists per-package effect. No change
to `config.json`.

### 3. Batching majors

Hold breaking changes on a `next`-style integration branch or a dedicated
open "breaking" label and **ship at most one major per 30 days**, bundling
whatever is queued. Exception: a security fix or a breakage in an upstream
dependency may ship immediately. (Three majors in 13 days is the
anti-pattern.) Window length is an open choice.

### 4. Support and deprecation of old majors

Only the **latest major** is supported; fixes land there only. When a new
major is published, run `npm deprecate` on the previous major's range for
all six packages, with a message pointing at the upgrade guide:

```bash
npm deprecate "zombie-mermaid@<5" "Upgrade to 5.x: https://github.com/dfadler/zombie-mermaid/blob/main/docs/guides/upgrading-2x-to-5x.md"
```

Applied per package name (six). Deprecation is reversible and does not
break installs, so it does not need a support window beyond the above.
The release checklist in `docs/RELEASING.md` gains this step, **done by a
maintainer by hand** (publish uses OIDC with no token in CI, so CI cannot
run it). For the 5.0 deprecation the guide (#1538) already exists; each later major needs its own guide first.

### 5. Release notes

Each major's changeset summary starts with `**BREAKING:**` and links the
upgrade-guide section. The generated GitHub Release carries it as-is; no
extra manual release notes. Backfilling the root changelog stays in #1559.

## Open choices (maintainer)

1. Minimum gap between majors: recommend 30 days.
2. Support window for old majors: recommend none beyond latest major.
3. Whether to deprecate pre-5 versions now (the guide from #1538 exists):
   recommend yes, once this policy is accepted.
4. Whether output changes should ever be major: recommend no (above).

## Self-review (decision-doc checklist, #977)

- **Edge cases:** a change that is both breaking and a security fix
  (ship immediately, still a major). A change touching only one package
  (still bumps all six). A major whose only break is optional-peer
  (counts, per 5.0.0). A change that is breaking only for deep imports of
  files not in `exports` and not documented as supported (not breaking by
  definition above).
- **Boundaries:** "30 days" is elapsed calendar days between UTC publish
  dates: the next major is allowed when `next date - previous date >= 30`
  (a major published 1 Sep allows the next on 1 Oct, not 30 Sep). `npm deprecate "<5"` covers 4.x and below, excludes 5.0.0 (semver range
  `<5` excludes 5.0.0 and prereleases of 5).
- **Terminology:** "published surface" = anything reachable through
  `package.json` `exports`/`bin`, MCP schemas, or documented in
  `docs/api-reference.md`. "Rendered output" = SVG/ASCII strings.
- **Sub-issue scope:** #1538 (shipped) and #1559 are referenced as dependencies, not
  decided here; the deprecation URL above points at the guide #1538 produced.
- **Precedent:** 4.0.0 / 5.0.0 reasons verified against the 5.0.0 GitHub
  Release body and `package.json` `engines` (`>=24`). The `#1446` row was
  verified: its changeset is listed as a Patch Change in 5.0.0's release.
