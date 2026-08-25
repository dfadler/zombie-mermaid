# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

No GitHub Releases have been published for this repository yet; the entries below are
backfilled from `git tag` history (`vX.Y.Z` tags going back to `v0.1.3`). Commits before
`v0.1.3` (the project's initial release) predate this file and aren't itemized here — see
`git log v0.1.3` for that early history.

## [Unreleased]

> **Note:** starting with the Changesets-based release flow (see
> [RELEASING.md](./RELEASING.md)), new entries are generated automatically
> by `changeset version` as dated version sections, not hand-written under
> `[Unreleased]`. The items below predate that change and accumulated
> before any changesets existed for them; they'll be folded into whatever
> version ships next rather than regenerated from a changeset.

Work merged to `main` since the `v1.1.3` tag, not yet released to npm.

### Added

- Live Mermaid editor page (`editor.ts` / `editor/`), deployed alongside the sample gallery
- Editor button on the site hero, matching the Craft Agents design system
- ESLint (TypeScript-aware flat config) for the codebase
- Semgrep SAST scanning in CI (`semgrep scan --config auto --error`, free public rulesets,
  no account/token), and documented Aikido Safe Chain as the recommended local install-time
  malware/supply-chain protection (closes #12)

### Changed

- Migrated tooling off Bun onto pnpm, Vitest, and esbuild/Node (`chore: move off Bun`)
- Renamed the fork from `beautiful-mermaid` to `zombie-mermaid` (package name, imports,
  README); still MIT-licensed with full attribution to Craft Docs and the original
  `mermaid-ascii` port

### Fixed

- Editor link resolving to the wrong path on pages without a trailing slash, and a
  follow-up fix for a regex/template-literal bug in that same patch (ported from
  upstream `lukilabs/beautiful-mermaid` PRs [#105](https://github.com/lukilabs/beautiful-mermaid/pull/105)
  and [#106](https://github.com/lukilabs/beautiful-mermaid/pull/106))
- Pinned all GitHub Actions in `ci.yml`/`publish.yml` to full commit SHAs instead of mutable
  version tags (Semgrep finding: `github-actions-mutable-action-tag`)
- Added a subresource-integrity hash to the CDN-loaded Chart.js `<script>` tag in
  `xychart-test.html`/`xychart-test.ts` (Semgrep finding: `missing-integrity`)

## [1.1.3] - 2026-02-26

### Fixed

- xychart producing `NaN` colors when theme inputs used CSS variables

## [1.1.2] - 2026-02-26

### Added

- Pre-built JS shipped in the published package for webpack/vite/Node consumers that
  don't run their own TypeScript build step

## [1.1.1] - 2026-02-26

### Changed

- Removed the `prepublishOnly` build hook; added `tsup`/`typescript` as explicit
  devDependencies

## [1.1.0] - 2026-02-26

### Added

- `xychart-beta` diagram type (bar, line, and combined charts) as a proof of concept
- `linkStyles` support for flowchart edges

### Fixed

- CJK state names and text embedded in edge labels rendering incorrectly

## [1.0.2] - 2026-02-23

### Changed

- Removed the DOM lib dependency in favor of ambient declarations for browser globals

### Fixed

- CI type-checking failures (added `@types/bun`, restored DOM lib for test imports)

## [1.0.1] - 2026-02-23

### Changed

- Layout quality improvements and layer alignment in the ELK.js-based layout engine

## [1.0.0] - 2026-02-23

### Added

- ELK.js-powered layout engine (replacing the earlier layout approach)
- Themeable ASCII rendering
- Multiline label support

This was a major rework of the rendering pipeline; see the `v1.0.0` tag for the full
diff against `v0.1.3`.

## [0.1.3] - 2026-01-29

### Added

- Browser bundle for `<script>` tag / CDN usage

### Security

- Escaped inline style attribute values to prevent SVG attribute injection from
  untrusted diagram input

### Fixed

- Semicolons as line separators in the diagram parser (flowchart and SVG renderer)
- README dead links and incorrect attribution (the ASCII renderer was ported from Go,
  not Python)

[Unreleased]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.3...HEAD
[1.1.3]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/dfadler/zombie-mermaid/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/dfadler/zombie-mermaid/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/dfadler/zombie-mermaid/compare/v0.1.3...v1.0.0
[0.1.3]: https://github.com/dfadler/zombie-mermaid/releases/tag/v0.1.3
