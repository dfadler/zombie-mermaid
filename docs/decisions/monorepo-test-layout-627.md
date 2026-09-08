# Monorepo test layout (#627): per-package trees, one shared config

## Context

[#627](https://github.com/dfadler/zombie-mermaid/issues/627) (part of the
[#620](https://github.com/dfadler/zombie-mermaid/issues/620) umbrella) asks
where tests should live once the workspace split scoped in
[`monorepo-conversion-scoping.md`](./monorepo-conversion-scoping.md) actually
happens: move each package's tests alongside it, or keep a shared top-level
test tree. The scoping pass explicitly left this open.

The question as posed is a false binary, and the "shared top-level tree"
framing doesn't describe what the repo has today. Three separate test roots
already exist, discovered by one root `vitest.config.ts`:

| Root                | `.test.ts` files | Runner     |
| ------------------- | ---------------- | ---------- |
| `src/__tests__/`    | 146              | Vitest     |
| `__tests__/`        | 13               | Vitest     |
| `editor/__tests__/` | 5                | Vitest     |
| `__tests__/visual/` | 6                | Playwright |

(#627's body says 140 under `src/__tests__/`; it is 146 now, plus 3
non-`.test.ts` helper modules and 100 `.txt` fixtures under `testdata/`. The
count has grown since the issue was filed and will keep growing — nothing
here depends on the exact number.)

So the real decision has two independent axes — where test _files_ sit, and
how many _configs_ discover them — and they should be answered separately.
The rest of this section is the measured state that decides them; every
number below was grepped against the tree at the time of writing, not
inferred.

**Tests are not colocated today, and the `__tests__/`-directory convention is
universal.** Zero `*.test.ts` files sit next to their source anywhere in the
repo — 146/146 under `src/` use the `src/__tests__/` directory. #627's phrase
"not colocated with the source they test" describes a real fact but is not
itself an argument for changing it.

**Only `src/` tests are type checked.** `tsconfig.json` sets
`"include": ["src/**/*"]`, so `pnpm run typecheck` (`tsc --noEmit`) covers
exactly the 149 `.ts` files under `src/__tests__/` and no test file outside
`src/` (verified with `tsc --noEmit --listFilesOnly`).
`eslint.config.js` lints `__tests__/**/*.ts` but ignores `editor/**`
wholesale. The upshot: **`__tests__/` is linted but not type checked, and
`editor/__tests__/` is neither.** The repo already ran the experiment of
moving tests out of `src/` into a sibling tree, and both static gates
silently stopped applying to them. That is the strongest single argument
against a shared out-of-`src` test tree, and it is a live regression, not a
hypothetical.

**Coverage is centralized and has two consumers that assume one run.**
`vitest.config.ts` declares a single v8 coverage config —
`include: ['src/**/*.ts']`, `exclude: ['src/__tests__/**']`, and four
repo-wide thresholds (statements 88, branches 77, functions 93, lines 90).
The one `coverage/lcov.info` it produces feeds both the Codecov upload (the
README badge) and `check-diff-coverage.ts`, which enforces a stricter 90%
bar on diff-touched lines and hardcodes `INCLUDE_DIR = 'src/'` /
`EXCLUDE_PREFIX = 'src/__tests__/'` with a comment saying it mirrors the
vitest config.

**The package boundary is already clean in the test tree.** 88 test files
import `../ascii/*`; 5 import `../mcp`; 32 import `../index` (the SVG
entry). Only 6 files import both `../ascii` and `../index` —
`class-integration`, `class-notes`, `class-styling`, `cli-render`,
`direction-override`, `resolve-colors`. The two `helpers/` modules
(`ascii-form.ts`, `terminal-display-width.ts`) have 9 users between them and
every one is an ASCII test; the 100 `testdata/` fixtures have 2 users, both
ASCII tests. Both move with `ascii-renderer` cleanly rather than becoming a
cross-package dependency.

The one exception is `src/__tests__/cli-test-helpers.ts`, used by
`ascii-hyperlinks` (ASCII), `cli-diagrams`, and `cli-render` (CLI, which
#626 keeps as an app in the umbrella rather than a package). It is the only
shared test module that genuinely straddles the boundary, and it is small —
either duplicate the ASCII-relevant part into `ascii-renderer`'s tree or
leave it in the umbrella and have the one ASCII test that needs it move to
the integration tree with the other six. Worth naming so #623 doesn't
rediscover it mid-move; not big enough to change the decision.

**The extraction has to touch these files anyway.**
[#623](https://github.com/dfadler/zombie-mermaid/issues/623) moves
`src/ascii/**` into its own package directory. The moment it does, all 88
`from '../ascii/…'` specifiers in `src/__tests__/` stop resolving. #623 must
rewrite every one of those import lines whether or not the files themselves
move. Checked while writing this: #623 has no branch, no PR, and no comments
— it has not started — so #627's answer is a **precondition on** #623 rather
than a cleanup after it.

## Decision

Tests move with their package, into a `<package>/src/__tests__/` tree that
keeps the existing directory convention; one root Vitest config keeps
discovering all of them; coverage stays a single run against a single
threshold set.

Concretely, five sub-decisions:

1. **Move tests into each package; do not keep a shared library test tree.**
   `src/__tests__/`'s 88 ASCII files and 5 MCP files go to
   `packages/ascii-renderer/src/__tests__/` and
   `packages/mcp/src/__tests__/` under #623, and the same rule applies to
   #624 and #625.

2. **Keep the `__tests__/`-directory convention. Do not switch to colocated
   `*.test.ts` files.** The package boundary is what's changing; the
   directory convention is orthogonal, uniform across all 146 files, and
   changing it would churn every test path for no benefit this issue asked
   for. Note the `src/` level is retained inside each package
   (`<package>/src/__tests__/`, not `<package>/__tests__/`) specifically so
   each package's `tsconfig.json` can keep the existing
   `"include": ["src/**/*"]` shape and its tests stay type checked by
   default.

3. **Keep one root `vitest.config.ts`. Do not add per-package Vitest
   configs.** Widening the `include` globs to cover
   `packages/*/src/__tests__/**/*.test.ts` is the whole change. Reach for
   Vitest's `projects` only if a package later needs a genuinely different
   environment or setup file — the one such case today (`editor/__tests__/`
   needing jsdom) is already handled by `environmentMatchGlobs` in the same
   single config.

4. **Keep coverage centralized: one `--coverage` run, one merged
   `lcov.info`, one repo-wide threshold set.** Do not introduce per-package
   coverage configs or per-package thresholds. `coverage.include` widens
   from `src/**/*.ts` to also cover `packages/*/src/**/*.ts`, and
   `coverage.exclude` widens correspondingly.

5. **Keep the top-level `__tests__/` for what it already is** — repo tooling
   and cross-package integration tests (`check-diff-coverage.test.ts`,
   `dashboard.test.ts`, `guides-sample-counts.test.ts`, the Playwright
   `__tests__/visual/` suite, etc.). Route the 6 files that import across
   the ASCII/SVG boundary here, since they belong to neither package. Fold
   this tree into `tsconfig.json`'s `include` at the same time, closing the
   type-check gap described above rather than propagating it.

**Each extraction issue moves its own tests in the same commit as its
source.** Do not open a separate "move the tests" sweep issue. #623 has to
rewrite all 88 ASCII import specifiers regardless; doing the `git mv` in the
same commit is nearly free, and the alternative leaves a window where a
package's source lives in `packages/` while its tests sit in `src/__tests__/`
reaching across the boundary they were just meant to establish.

### Why not the alternatives

**A shared top-level test tree (all tests in one `__tests__/`)** is rejected
on the type-check evidence above: it is the exact shape `editor/__tests__/`
already has, and that tree gets neither `tsc` nor `eslint` today. It also
makes each package non-self-contained — a package whose tests live in
another package's directory can't be built, tested, or eventually extracted
in isolation, which is most of the point of the workspace split.

**Per-package Vitest configs with per-package coverage thresholds** is
rejected as premature. Four global thresholds are one number each to reason
about; eight packages × four thresholds is 32, and per-package percentages
get jumpier as the denominator shrinks — a small package's number swings
several points on one uncovered branch, which makes the gate noisy rather
than protective. Merging N lcov files back into the one artifact Codecov and
`check-diff-coverage.ts` both expect is also work with no upside; the single
run already produces it. This is the same reasoning the scoping doc used to
defer Turborepo/Nx: adopt the orchestration when the scale demands it, with
a checkable trigger. The trigger here is a package that genuinely needs a
different environment or setup file, not package count.

**Colocated `*.test.ts` next to source** is rejected as unrelated scope. It
would touch all 146 files to answer a question nobody asked.

## Consequences

Prerequisites this creates for the extraction issues — each of these breaks
under #623 whether or not tests move, except where noted:

- **`check-diff-coverage.ts` must stop hardcoding one path prefix.**
  `INCLUDE_DIR = 'src/'` and `EXCLUDE_PREFIX = 'src/__tests__/'` become
  patterns covering `packages/*/src/`. This breaks under #623 on the source
  move alone, so it is a #623 blocker independent of this decision — but its
  exclude prefix must be widened in lockstep with the test move, or every
  moved test file starts counting as diff-covered source.
  `__tests__/check-diff-coverage.test.ts` covers this script and should be
  extended alongside.
- **Every new package's `tsconfig.json` must `include` its own `src/**/*`**,
  which sub-decision 2's directory shape makes automatic. Verify per package
  with `tsc --noEmit --listFilesOnly | grep __tests__` after each
  extraction — the failure mode here is silent, not a build error.
- **`eslint.config.js`'s `files` list must gain a `packages/*/src/**/*.ts`
  glob.** Also silent on failure: an unlinted package produces no error, just
  no findings. Note `reportUnusedDisableDirectives: 'error'` means a package
  that falls out of linting also stops enforcing its own stale-disable rule.
- **`vitest.config.ts`'s `include`, `coverage.include`, and
  `coverage.exclude` widen** as described. `environmentMatchGlobs` and the
  `__tests__/visual/**` exclusion are unaffected.
- **The repo-wide coverage thresholds will move when files move.** A source
  file that changes path changes nothing about which lines execute, so the
  aggregate should hold. Watch for the one case where it doesn't: a v8-style
  trace-based provider counts nothing for a file the run never executes, so
  a file that becomes reachable for the first time as a side effect of the
  move enters the denominator with all its previously invisible lines at
  once and can drag the aggregate down even though nothing got worse. Re-run
  `pnpm run test:coverage` after each extraction before assuming the
  thresholds still pass, and fix by covering the newly visible lines rather
  than lowering the floor.

What this rules out: a future proposal to consolidate tests back into one
top-level tree, and a future proposal to give each package its own coverage
gate. Both would need to re-argue against the type-check and
single-lcov-consumer evidence above.

`vite.config.lib.ts` needs no change on this axis — its
`exclude: ['src/__tests__/**', '**/*.test.ts']` already catches any test file
by name regardless of directory. `playwright.config.ts`'s
`testDir: '__tests__/visual'` and `snapshotDir` also stay as-is; the visual
suite renders the whole pipeline and is correctly a top-level,
cross-package suite under sub-decision 5.
