# Project instructions

Repo-specific mechanics for working in zombie-mermaid. General cross-project habits
(git worktree discipline, PR conventions, etc.) live in the global `CLAUDE.md`
instead — this file only holds what's specific to _this_ repo's tooling.

## Default check loop: `pnpm run verify`

After a change, run `pnpm run verify` (typecheck in parallel, lint/format on changed files,
`vitest run --changed origin/main`) instead of separate full-repo typecheck/oxlint/oxfmt/coverage
runs. For a single source file, `pnpm exec vitest related <file> --run -c config/vitest.config.ts`; for a test file, `pnpm exec vitest run -c config/vitest.config.ts <test-file>`.
Path-to-suite map: `packages/ascii-renderer/**` -> its `__tests__` plus
`pnpm exec playwright test -g ascii-samples`. Reserve `pnpm run verify --full` (CI parity) for
the end. `pnpm run doctor` diagnoses a broken local toolchain.

## Worktree cleanup

This repo's dev server (`vite.config.ts`, run via `pnpm run dev` / `vite`) has two
properties that make worktree cleanup easy to get wrong:

- **Port: 3456 for the main checkout, hashed per worktree.** `vite.config.ts` reads
  `PORT` first (`PORT=3457 pnpm run dev`); unset, the main checkout uses 3456 and a
  worktree under `.claude/worktrees/` gets a stable 3500-3999 port hashed from its
  path (`defaultPort`), so parallel batches rarely collide. Hash collisions are still
  possible and killing by port is still unsafe: verify the owner (see below).
- **Each worktree is ~600 MB** with its own `node_modules`; finished ones aren't swept
  unless `worktree.autoPrune` is set (dfadler/agent-config#651), so clean up after yourself.
- **Live reload keeps the connection open.** Vite's HMR client holds a WebSocket open
  (`/@vite/client`) for as long as a tab is connected, so that tab never goes
  network-idle. A headless capture (`chrome --headless --screenshot`) against a
  _live_ dev-server page hangs waiting for network idle — build a static snapshot
  instead (`pnpm run build:site`, serve the resulting `site/` with a plain static
  server) for any headless screenshot, before/after comparison, or CI-style capture.
- **`preview_start` won't follow you into a worktree.** It resolves
  `.claude/launch.json` against the _original_ repo root regardless of where
  `EnterWorktree` switched the session's cwd (see the global `CLAUDE.md`'s worktree
  section). To preview a worktree's own dev server, run it manually from inside that
  worktree — `cd <worktree-path> && PORT=<port> pnpm run dev` (use the repo's
  declared `pnpm` scripts, not bare `npx`: this repo has no
  `worktree.symlinkDirectories` configured, so `node_modules` isn't shared between
  worktrees, and a worktree that `pnpm add`ed something new — Vite itself, say — has
  its own separate install that only `cd`ing in first and using `pnpm run` reliably
  resolves) — as a background `Bash` process, and track that PID yourself; nothing
  else will.

## ASCII rendering changes: the PR screenshot must be a real terminal; mockup-only changes use the probes

Before attaching before/after screenshots to a PR/issue for any change touching
ASCII output (`packages/ascii-renderer/**`, `packages/site/ascii-html.ts`, `src/cli.ts`'s ASCII path,
`__tests__/visual/helpers/terminal-panel.ts`'s `TERMINAL_ASCII_OPTS`/`applyWideCharWidths`, `packages/site/ssr/home-routes.ts`'s `.ascii-panel`,
`scripts/visual-diff.ts`, `__tests__/visual/helpers/terminal-panel.ts`, or
`__tests__/visual/ascii-samples.visual.test.ts`), invoke the
`verify-ascii-terminal` skill first. This is a hard requirement on the
_attached image itself_, not just a correctness check that gets discarded
in favor of a browser-rendered screenshot afterward: `scripts/ascii-terminal-capture.sh`
(what the skill drives) captures `renderMermaidASCII` through a real PTY —
headlessly, via `asciinema` + `agg`, so no GUI window ever opens — and its
`.png` output is what gets attached. The Playwright visual-regression suite
and `scripts/visual-diff.ts` (the tool CONTRIBUTING.md points to for a
before/after report **during development**) both render ASCII output
through `packages/site/ascii-html.ts`'s HTML approximation of a terminal, never a real
one — this repo has already shipped a bug (the `ascii-terminal-overflow-scroll`
fix) in that approximation's chrome while the underlying renderer was fine
— so they stay useful for iterating locally but must never supply the
screenshot that ends up in a PR/issue body for this category of change.

The mockup's own fidelity is checked separately, by tests rather than by
eye: `__tests__/visual/ascii-geometry.visual.test.ts` (every glyph sits in the
right cell with the right color, against an `@xterm/headless` oracle),
`ascii-seams.visual.test.ts` (adjacent line and block glyphs join),
`ascii-legibility.visual.test.ts` (connectors keep clear of text) and
`ascii-crispness.visual.test.ts` (vertical strokes are one crisp pixel column,
not split across two). A change that
only touches the mockup (`.ascii-output` CSS in `demo/styles.css`,
`packages/site/ascii-html.ts`'s chrome, the visual helpers) leaves what a
terminal prints unchanged, so a real-terminal capture would show nothing: for
those, run the four tests and attach before/after mockup screenshots, each
labeled as a browser mockup, not a terminal. Any change to what the renderer
emits still needs the real-terminal image above. A real-PTY golden suite was
considered and not adopted (#1151, #1186).

Whenever a PR or issue includes a "Visual verification" (or equivalent
before/after) section for this category of change, paste the exact Mermaid
source used to produce both renders inline, in a fenced ` ```mermaid ` code
block directly after that heading — before the before/after image table, not
after it — rather than only linking to a sample index or a separate issue's
reproduction. A reviewer (or a future reader) must be able to verify the
screenshots from the PR/issue body alone, without chasing down another issue
that may no longer contain a matching repro. See
[#402](https://github.com/dfadler/zombie-mermaid/issues/402), which this
requirement exists to close.

## Research and measurement: findings go in the issue

For investigation, measurement or spike work on an issue, post the findings as an issue
comment (long ones in a collapsed `<details>`), with a permalink to any script or other
artifact in the repo. Do not add a `docs/research/*.md` doc: write one only when something
else (a guide, a code comment, a script) links to it and it is worth keeping current.
`pnpm run check:docs` fails on a doc under `docs/research/` that nothing outside it
references, and `scripts/pre-pr-check.sh` (the warn-only `gh pr create` hook) warns when a PR adds one, and
`scripts/research-nudge.sh` (a warn-only `Write` hook) nudges when you create one. Former research docs and where their findings now live are indexed in
[`docs/research/README.md`](docs/research/README.md). See
[#1479](https://github.com/dfadler/zombie-mermaid/issues/1479) and
[#1642](https://github.com/dfadler/zombie-mermaid/issues/1642).

## Parity with mermaid.js: check what users see, not only the pinned oracle

For any issue or PR whose premise is "match mermaid.js" (or another renderer), render
the sample in what users actually compare against before writing code: a
GitHub-rendered ` ```mermaid ` block or mermaid.live (via Chrome), and the latest
`mermaid` from npm run headless through `scripts/lib/real-mermaid.ts`, next to the
pinned oracle (`mermaid` in `package.json`, used by `pnpm run layout:oracle`). If they
disagree, stop and report that; don't build on the pin. `pnpm run doctor` and the
oracle warn when the pin is behind npm latest. A user's screenshot of a real render
outranks the issue text. Don't write "matches mermaid" in a PR body without naming the
version it was checked against. See
[#1699](https://github.com/dfadler/zombie-mermaid/issues/1699): the pin (11.17.2)
flipped uncrossed subgraphs, current mermaid and GitHub do not, and
[#1820](https://github.com/dfadler/zombie-mermaid/pull/1820) built on the stale
behavior.

## Rules that used to live only in per-machine memory

Subagents do not see auto-memory, so these repo rules live here (#1612). Batching
issues across subagents: see the `issue-batch` skill (default cap 8 in flight across
distinct modules, not a fixed 20).

- **Releases:** never bump `package.json` versions or edit `CHANGELOG.md` in a feature
  PR. Add a `.changeset/*.md` instead; only the bot's "Version Packages" PR
  (`changeset-release/main`) consumes it. A version diff in a PR is fine only when
  inherited through a merge of `main` that already carries it. See CONTRIBUTING.md
  "Changesets".
- **Snapshots cover both renderers:** every snapshot/golden case, edge cases and option
  variants included, gets both an SVG and an ASCII snapshot. If a case has no analogue
  in one renderer, say so in the PR rather than skipping silently. Hand-written
  expected strings are not a substitute.
- **`demo/` refactors need screenshots:** a PR touching anything under `demo/` gets a
  "Visual verification" section with real before/after screenshots (default state plus
  any interactive state the diff touches), taken from a static build, even when a
  byte-diff already shows zero change. Pure non-rendering changes are exempt.

## Decision docs: run the self-review checklist before opening the PR

Before opening a PR that adds or edits a `docs/decisions/*.md` file, walk through
the self-review checklist in
[`docs/decisions/decision-doc-self-review-checklist-977.md`](docs/decisions/decision-doc-self-review-checklist-977.md#decision)
against the draft — degenerate/edge-case inputs, boundary and off-by-one
arithmetic, ambiguous terminology, claims about a sub-issue's scope, and cited
precedent. This applies whether the doc was drafted by a human or an agent; an
agent-authored draft just makes the checklist easier to silently skip. See
[#1063](https://github.com/dfadler/zombie-mermaid/issues/1063) for why this
pointer exists: writing the checklist down in a doc nothing links to doesn't
make it get used.

Before removing a worktree in this repo (`ExitWorktree`, or by hand), stop only the
processes _you_ started for it — don't kill by port or by a generic name pattern
alone, since another worktree (or the main checkout) can easily share the same
default port or process name:

1. **Prefer killing by PID.** Capture it when you launch anything — the
   background-task PID the `Bash` tool returns, or `$!` right after backgrounding a
   plain shell command. This matters most for the dev server: its default port (3456)
   is shared unless you passed `PORT=` (see above), so two sessions can each think of
   "the" dev server as theirs without being the same process — killing by port risks
   taking down someone else's server, not just your own.
2. If you didn't capture a PID, verify before killing: `lsof -i:<port>` shows the
   owning command — confirm it's actually the server you started before killing that
   PID, rather than piping `lsof -ti` straight into `xargs kill`. Same for a
   throwaway static-file server you spun up for a headless capture
   (`python3 -m http.server <port>`, `npx http-server`).
3. For a headless Chrome instance launched for screenshots, match on the `--headless`
   flag itself (`ps aux | grep -- --headless`), not on the default profile directory
   name (`Chrome-headless`) — passing an explicit `--user-data-dir` (worth doing if
   you're running more than one capture at once, to avoid profile-lock collisions)
   changes that path but not the flag. Filter to processes you actually started;
   don't broadly `pkill` a generic "Chrome Helper" pattern, which can also match the
   user's real browser.
4. Generated build artifacts (`site/`, `.site-ssr/`, `.site-dev/`) are gitignored — safe to leave, no cleanup needed. `public/hero.svg` is **not** gitignored
   (it's the committed README asset, regenerated by `scripts/generate-hero.ts`) — if
   you regenerated it inside a worktree for comparison purposes only, don't let a
   throwaway copy leak back into the main checkout or another branch.
