# Drop CJS output, and `export *` barrels: recommendations for the next major

Status: proposal

Answers two deferred questions, [#1873](https://github.com/dfadler/zombie-mermaid/issues/1873)
(remove CJS output, ship ESM-only) and [#1874](https://github.com/dfadler/zombie-mermaid/issues/1874)
(convert `export *` to named exports). It recommends; it changes no code,
export map, release config or policy. Everything under "Maintainer decisions"
is the maintainer's call. Measurements and method are on the issues, not here:
[#1873 comment](https://github.com/dfadler/zombie-mermaid/issues/1873#issuecomment-6532114631),
[#1874 comment](https://github.com/dfadler/zombie-mermaid/issues/1874#issuecomment-6532114984).
All numbers are `main` at 79a01251 (v5.12.0).

## Context

Both issues were filed as "revisit at the next planned major". A major is now
queued: [#2119](https://github.com/dfadler/zombie-mermaid/pull/2119)
(`feat(ascii)!: maxWidth hard limit`, draft, `breaking`, conflicting with
`main`), which cannot merge before 2026-11-09 (last major 5.0.0 on 2026-10-10,
plus 30 days). The policy
([`versioning-and-deprecation-policy-1568.md`](versioning-and-deprecation-policy-1568.md),
section 3) allows one major per 30 days "bundling whatever is queued", and
`docs/RELEASING.md` ("Batching majors") says the same. So the cheap time to
take a breaking change is that window; the next one after it is at least 30
days later. Under section 1 of the policy, both "removes ... a path in
`exports`" and "removes or renames tarball contents that consumers import" are
major, and lockstep versioning ([`lockstep-versioning.md`](lockstep-versioning.md))
makes any major a major for all seven packages in the `fixed` group.

Terms. **Dual-package hazard**: one app loading the same package once through
`import` and once through `require` gets two separate copies of its classes.
**Unreferenced** (for #1874): in the package's API report, but imported by name
from `@zombie-mermaid/<pkg>` by no file outside that package, not re-exported
by the umbrella, and not named in `docs/api-reference.md` or `README.md`. It
marks a candidate, not an unused symbol.

## #1873: ESM-only

### What the evidence shows

- **Payoff is install size, not bundle size.** Removing `.cjs` and the 35-byte
  `.d.cts` stubs takes the seven tarballs from 488,042 to about 306,000 bytes
  (-37%) and unpacked size from 1.39 MB to about 0.85 MB (-39%). A consumer's
  bundle is unchanged, because bundlers already take the `import` build.
- **It is technically safe on the supported Node floor.** `require()` of every
  ESM entry works on Node 24.21 and 22.22 with no top-level await
  (`ERR_REQUIRE_ASYNC_MODULE` never fired), and a CommonJS app rendering SVG
  and ASCII through `require('zombie-mermaid')` worked on both. It fails on Node
  20.11 and 22.9, both below `engines.node >=24`.
- **One type-level break.** A CommonJS TypeScript project with
  `module: node16` gets TS1479; `nodenext`, `commonjs` + `node10` and
  `commonjs` + `bundler` pass on TypeScript 6.0.3.
- **The "attw shows CJS is a liability" trigger in #1873 is not met.** attw is
  clean today; against an ESM-only repack it reports "ESM (dynamic import
  only)" for node16-from-CJS, which is a warning for a layout that works.
- **A real cost of keeping CJS:** the dual-package hazard is present
  (`LimitExceededError` differs between `index.cjs` and `index.js`), plus CJS handling on
  64 lines across the two build configs and the smoke test, a
  `mcp_cjs` environment with an `import.meta.url` shim, and a
  `dist/shared/package.json` `{"type":"commonjs"}` marker that exists only to
  make `.d.cts` stubs resolve.
- **Prior judgment.** The package-size research for [#1373](https://github.com/dfadler/zombie-mermaid/issues/1373) (doc since removed; [last version](https://github.com/dfadler/zombie-mermaid/blob/fefa926492c970aa68be907a0ace11d83ab91478/docs/research/1373-package-size.md), finding 6) called CJS duplication "not actionable" because dropping CJS is breaking. That is the case here too: it is actionable only inside a major.
- **A real cost of dropping it:** CJS was added on purpose
  ([#82](https://github.com/dfadler/zombie-mermaid/pull/82), to stop
  `ERR_PACKAGE_PATH_NOT_EXPORTED`), so some consumers `require()` today. npm
  records no module format, so their number is unknown (about 1,700
  `zombie-mermaid` downloads in the last week). Jest-style runners with their
  own CommonJS loader and embedded-Node hosts were not tested. Under policy
  section 4 only the latest major is supported, so a CJS consumer who cannot
  move stays on a deprecated 5.x.

### Recommendation

**Do it, in the same major as #2119, or not at all this cycle.** The saving is
real but moderate and the break is narrow (CJS on Node below 22.12, which the
floor already excludes, and `module: node16` CJS TypeScript). That is worth
one extra line in a major the project is cutting anyway, and not worth a
major of its own. If the maintainer does not want it in the 6.0.0 batch,
leave CJS as is and re-ask at the next planned major; nothing decays meanwhile.

If taken, the shape is: `exports` per entry collapses to `{ "types", "default" }`,
`main` points at `dist/index.js`, `typesVersions` stays (it already covers the
subpaths for `node10`), `.cjs`, `.d.cts` and the `dist/shared` marker go, and
the `mcp_cjs`/`cjs` build environments go. The existing smoke test already
`require()`s every entry and renders in CommonJS; keep that as the guard, now
exercising `require(esm)`, and change the attw step to `--profile esm-only`.
Add the migration to the 5-to-6 guide that #2119 already creates
(`docs/guides/upgrading-5x-to-6x.md`), including the `node16` TypeScript
workaround (move to `node18`/`nodenext`/`bundler`, or `import()`).

## #1874: named exports

### What the evidence shows

- **The issue's counts are stale.** `export *` lines on main: core 22 (issue:
  17), mermaid-parser 25 (23), svg-renderer 21 (19), plus the umbrella's
  `src/ascii-entry.ts` and `src/mcp-entry.ts` re-exporting a whole package each.
- **Published output is unaffected.** Built `dist/index.js` and
  `dist/shared/index.d.ts` have no `export *`; bundlers flatten them to an
  explicit name list and the package sets `"sideEffects": false`. So the
  tree-shaking argument does not apply; the cost is at the source, where a new
  top-level export in a re-exported file goes public without a barrel edit.
  #2119 is an instance: it exposes `AsciiWidthError` from `zombie-mermaid/ascii`
  through the untouched `src/ascii-entry.ts` star.
- **The API baseline exists**, so #1874's own trigger is met (`etc/api/` since
  [#1870](https://github.com/dfadler/zombie-mermaid/issues/1870); the CI diff
  is report-only).
- **Leakage is concentrated in one package.** Unreferenced names: svg-renderer
  45 of 76 (59%), mermaid-parser 33 of 117 (28%), core 15 of 122 (12%),
  ascii-renderer 3 of 10. Core and mermaid-parser are mostly the contract
  between the repo's own packages (82% and 66% imported by a sibling) and the
  README already calls them internal-only. svg-renderer is published
  standalone and its own header lists modules it intentionally does not
  re-export.
- **Converting is not itself breaking.** A name list equal to today's list gives
  an identical built export list and an empty `etc/api/` diff (expected, not
  yet run). Only removing a name is major.

### Recommendation

**Split the question, and do the first half without waiting for a major.**

1. Convert **`packages/svg-renderer/src/index.ts` only** to a named list equal
   to today's surface. It is the one barrel where the stated intent and the
   `export *` reality diverge, and it carries 45 of the 96 unreferenced names.
   Acceptance: `pnpm run build && pnpm run api:report` shows no `etc/api/`
   change. A normal PR with an empty changeset, no major, not blocked by the gate.
2. **Leave core and mermaid-parser as `export *`.** Their barrels are the
   inter-package contract and little leaks. Revisit if the terminal package
   ([#2457](https://github.com/dfadler/zombie-mermaid/issues/2457)) shows it
   needs a narrower shared surface.
3. **Pruning** (dropping unreferenced svg-renderer names, and the core test hook
   `__resetSvgTitleIdCounterForTests` that is public today) is the breaking
   half. Only do it in a major, only after reviewing each name against the
   caveat in the #1874 comment (many are types reachable from other exports),
   and do not bundle it into 6.0.0 unless the conversion has already landed
   and the list is short.

## Interactions

- **#2119.** Taking the CJS change means a second held PR behind the `breaking` label, merged at the same gate; it touches `package.json` exports and the build configs, which #2119 does not, so the two should not conflict with each other (#2119 already conflicts with `main` on its own). The svg-renderer conversion is a normal PR and does not wait for the gate. #2119 edits `etc/api/*.api.md`, so whichever merges second regenerates the reports.
- **Terminal package #2457** (unscheduled, a child of #2144). If #1873 is
  accepted, the new package should be ESM-only from its first release so it
  never adds CJS surface that a later major has to remove. If #1873 is not
  accepted, it should match the repo's current dual layout. Either way decide
  #1873 before its build config is written. Its dependency on a shared core
  and parser is the reason not to touch the core and mermaid-parser barrels
  yet. It stays inside the lockstep group unless that doc changes.
- **Policy.** Neither change needs a policy edit. If CJS is dropped, the
  deprecation step for 5.x in section 4 applies as for earlier majors.

## Maintainer decisions

1. CJS: include in the 6.0.0 batch with #2119, or defer to a later major?
   Recommendation: include, or defer; do not give it its own major.
2. svg-renderer named-export conversion (non-breaking, any time): go?
   Recommendation: yes.
3. Pruning unreferenced exports: which major, if any? Recommendation: not 6.0.0.
4. Should the report-only `api-report` CI step become blocking once the
   conversion lands? Not covered here; it is a CI-policy call.

## Consequences

- If accepted as recommended: one extra breaking line in the 6.0.0 notes, a
  smaller install (about 37% fewer tarball bytes), one module format to test,
  and svg-renderer's public list becomes an explicit source diff.
- Not decided here: the CJS-consumer count (unknowable from npm), behaviour
  under Jest-style loaders and embedded-Node hosts (untested), and whether any
  external user imports an "unreferenced" name (invisible from the repo).
