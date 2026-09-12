# Contributing to zombie-mermaid

`zombie-mermaid` is a maintained fork of [`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid). It exists because upstream development has stalled — this repo pulls in upstream fixes, gives stuck upstream PRs a home, and actually ships releases. Contributions of both kinds (new fixes, and ports of things stuck upstream) are welcome.

## Getting set up

```bash
git clone https://github.com/dfadler/zombie-mermaid.git
cd zombie-mermaid
pnpm install
```

Requires Node 22+ and pnpm (the repo pins `packageManager` in `package.json`; `corepack enable` will pick that up automatically).

### Malware protection for installs (Aikido Safe Chain)

[Aikido Safe Chain](https://github.com/AikidoSec/safe-chain) is a free, tokenless CLI that wraps `npm`/`npx`/`pnpm`/`pnpm dlx`/`yarn`/etc. and blocks installs of packages flagged as malware or published in the last 48 hours (a common window for supply-chain attacks). It's optional but recommended for local development — it isn't (and can't be) enforced in CI, since it works by intercepting package-manager commands run in your own shell.

Install it once, machine-wide, via the official installer (not as a project dependency — it needs to hook your shell, so a per-project `devDependency` wouldn't work):

```bash
curl -fsSL https://github.com/AikidoSec/safe-chain/releases/download/1.5.15/install-safe-chain.sh -o /tmp/install-safe-chain.sh \
  && echo "de0565e3d6346407a604e84e639e95fea8758748063da2216bbfdca5feda5dd2  /tmp/install-safe-chain.sh" | sha256sum -c - \
  && sh /tmp/install-safe-chain.sh \
  && rm /tmp/install-safe-chain.sh
```

Restart your terminal afterward, then verify it's active with `pnpm safe-chain-verify` (or `npm safe-chain-verify`). Once installed, it transparently wraps your normal `pnpm install` — no change to your workflow. See the [Safe Chain README](https://github.com/AikidoSec/safe-chain#readme) for Windows instructions, uninstalling, and configuration (logging, minimum package age, etc.).

Full Aikido SCA/secrets scanning as a CI/dashboard product is a separate, paid-account feature and is intentionally not wired into this repo's CI — see the note in `.github/workflows/ci.yml` next to the Semgrep job.

Useful scripts while developing (see `package.json` for the full list):

- `pnpm test` — run the unit/integration test suite once (Vitest)
- `pnpm run test:watch` — Vitest in watch mode
- `pnpm run test:coverage` — Vitest with coverage
- `pnpm run test:visual` — visual regression suite (real-browser screenshots of every sample; see "Visual regression tests" below)
- `pnpm run test:visual:update` — regenerate visual baselines after an intentional rendering change
- `pnpm run visual-diff` — render every sample with the working tree's renderer vs. a base ref (default `main`) into `visual-diff.html` for manual review
- `scripts/docker-test-visual.sh` — run the ASCII half, the SVG half, or the full visual suite (`--suite ascii|svg|all`, default `all`) inside the font-corrected Linux container, against the `-chromium-linux.png` baselines CI gates on (needs Docker; see "Visual regression tests" below)
- `pnpm run fork-fixes` — build `fork-fixes.html`; if you add or change a `render: 'ascii'` entry in `demo/fork-fixes-data.ts`, also re-run `tsx scripts/capture-fork-fixes-terminal.ts` (needs `asciinema`, `agg`, `ffmpeg` on PATH) and commit the regenerated PNGs under `public/fork-fixes-screenshots/` — those real-terminal screenshots are the before/after shown on that page, not a live render
- `pnpm run lint` — ESLint
- `pnpm run build` — build the publishable package with Vite's library mode (`vite build --app --config vite.config.lib.ts`; the config's header comment explains why it's one environment per entry point)
- `pnpm run samples` — render the marketing home page (`index.ts`) to `index.html` (the script name predates #590's redesign; see that file's header comment)
- `pnpm run editor` — build the live editor page (`editor.ts`) to `editor.html`
- `pnpm run dashboard` — build the maintenance-transparency dashboard (`dashboard.ts`) to `dashboard.html`, reading the committed `demo/dashboard-data.json` snapshot. Its markup comes from React components in `demo/components/` rendered with `react-dom/server` (the [#423](https://github.com/dfadler/zombie-mermaid/issues/423) pilot); every `.tsx` file there must open with `/** @jsxRuntime automatic */` — see the `jsx` comment in `demo/tsconfig.json` for why
- `pnpm run dashboard:data` — refresh that snapshot via the `gh` CLI (needs `gh auth status` to be logged in); not run by `build:site` or the `test`/`ci.yml` jobs, but runs on its own weekly schedule via `.github/workflows/dashboard-refresh.yml` (see that file), which commits the refreshed snapshot to `main` automatically if it changed — you shouldn't normally need to run this by hand
- `pnpm run fork-fixes` — render the fork-fixes showcase (`fork-fixes.ts`) to `fork-fixes.html`; see "Adding a fork-fixes entry" below
- `pnpm run blog` — render the blog (`blog.ts`) from `blog-posts/*.md` to `blog/`; must run after `pnpm run pages` in `build:site` since it appends to the `sitemap.xml` that `pages.ts` generates. See `blog-posts/README.md` for the post frontmatter format.
- `pnpm run dev` — Vite dev server with live reload (`vite.config.ts`); serves `/` (marketing home page) and `/editor` (live editor), rebuilding on relevant file changes
- `pnpm run badge:bundle-size` — regenerate `badges/bundle-size.json` (the README's Bundle Size badge data) from the built `dist/index.js` (run `pnpm run build` first). Wired into `.github/workflows/publish.yml` to run automatically after every npm publish — you shouldn't normally need to run this by hand.
- `pnpm run bench` — render benchmarks (full end-to-end SVG + ASCII render time)
- `pnpm run bench:compare` — compare a `bench.ts --json=` summary against `bench-baseline.json` (what CI's benchmark regression gate runs)
- `pnpm run bench:core` / `bench:mermaid-parser` / `bench:svg-renderer` / `bench:ascii-renderer` — isolated per-package benchmarks that time only one package's own code (see each script's header comment for exactly what's included), so a regression can be attributed to a specific package instead of just "render got slower"
- `pnpm run bench:package-compare -- <current.json> --baseline=<path>` — the per-package analog of `bench:compare`; no-ops until a maintainer seeds that package's baseline from a real CI run (same reasoning as `bench-baseline.json` — see `scripts/bench-package-compare.ts`'s header)
- `pnpm run bench:history:append` — append a `bench.ts --json=` summary to the tracked trend history (`bench-history.jsonl`); wired into `.github/workflows/bench-trend.yml`'s weekly schedule (not every push to `main`, and not on PRs) — you shouldn't normally need to run this by hand
- `pnpm run bench:trend` — print how the combined render total (and each category) has moved across the most recent entries in `bench-history.jsonl`, for a "weeks/months of drift" view that complements `bench:compare`'s single current-vs-baseline check
- `pnpm run bench:mcp` — benchmark the `packages/mcp` server's own request/response overhead (Zod validation, tool dispatch, transport round-trip) by driving a real MCP `Client` against `createMcpServer()` over `InMemoryTransport`; reports mean/median/p95 latency per tool. Supports `--json=<path>` in `bench.ts`'s own summary shape, `--iterations=<n>` (default 50), and `--warmup=<n>` (default 5)
- `pnpm run check:bundle-size` — check `dist/` gzip sizes against `bundle-size-budget.json` (run `pnpm run build` first)
- `pnpm run format` — format the codebase with Prettier
- `pnpm run format:check` — check formatting without writing changes

Type-check with:

```bash
pnpm exec tsc --noEmit
```

## Before opening a PR

Double-check the base repository in GitHub's compare view: it should be `dfadler/zombie-mermaid`, not the upstream `lukilabs/beautiful-mermaid`. GitHub's "Contribute" button on a fork often defaults to the upstream repo, which is almost never what you want here — CI and publishing are wired up on this fork, not upstream, and only run when `github.repository == 'dfadler/zombie-mermaid'` (see `.github/workflows/ci.yml` and `publish.yml`).

CI (`.github/workflows/ci.yml`) runs on every push and PR against `main` and must pass:

1. `pnpm install --frozen-lockfile`
2. `pnpm run test:coverage`
3. `pnpm exec tsc --noEmit`
4. `pnpm run test:visual` (a separate CI job, sharded 4-way for wall-clock speed, and run inside the pinned `mcr.microsoft.com/playwright` image rather than on a bare runner; locally it needs `pnpm exec playwright install --with-deps chromium` first — see "Visual regression tests" below)
5. `scripts/check-snapshot-allowlist.sh` (guards against a new whole-tree snapshot or string-pin test creeping into demo/editor component tests outside a reviewed allow-list — see "Testing conventions for demo/editor components" below)

Run those locally first, along with `pnpm run lint` and `pnpm run format:check` — both also run in CI and will fail the build on violations. Please also add or update tests under `src/**` for any behavioral change — this is a parser/renderer library, and regressions are easy to introduce silently in layout or parsing code. If the change alters rendered SVG or ASCII output, update the visual baselines too (`pnpm run test:visual:update`) and commit the changed PNGs — but for ASCII output specifically, a passing visual-regression check is not the same as a real-terminal check; see the caveat in "Visual regression tests" below before treating it as final proof.

CI also runs a `semgrep` SAST scan job (`semgrep scan --config auto --error` against Semgrep's free public rulesets, no account/token involved) that fails the build on findings. If it flags something in your PR, either fix the underlying issue or, if it's a genuine false positive, add a scoped `// nosemgrep: <rule-id>` comment on the flagged line with a comment explaining why — don't disable the rule repo-wide.

### Mutation and reassignment

`eslint.config.js` enforces a small, deliberately narrow set of rules against reassignment ([#481](https://github.com/dfadler/zombie-mermaid/issues/481)): [`prefer-const`](https://eslint.org/docs/latest/rules/prefer-const), [`no-var`](https://eslint.org/docs/latest/rules/no-var), and [`no-param-reassign`](https://eslint.org/docs/latest/rules/no-param-reassign) with `props: false`. The line is drawn at the _binding_: a `let` that's never reassigned, a `var`, or a function that overwrites its own parameter (`padding = Math.max(0, padding)` — bind a new `const` instead) is an error. Writing _into_ an object a parameter points at (`canvas[y][x] = ch`, `edge.path = route`, `grid.add(key)`) is not: the ASCII renderer's grid, pathfinding, and layout passes are in-place by design, and rebuilding a canvas or an edge list per step to satisfy a lint rule would cost real time on large diagrams. That in-place work is the performance exception #481 carves out, which is why the stricter variants (`no-param-reassign` with `props: true`, `eslint-plugin-functional`'s `immutable-data`/`no-let`/`no-loop-statements`) are measured and tracked on the issue rather than enabled — each would flag hundreds of lines under `src/ascii/**`.

If you do need to reassign a binding for performance, suppress the rule on that line only, and say why, using ESLint's [`-- description`](https://eslint.org/docs/latest/use/configure/rules#comment-descriptions) form with a `perf:` prefix:

```ts
// eslint-disable-next-line no-param-reassign -- perf: hot loop, avoids a per-cell allocation
```

A reviewer should be able to read the reason without opening the issue. The description isn't optional decoration: [`linterOptions.reportUnusedDisableDirectives`](https://eslint.org/docs/latest/use/configure/rules#report-unused-eslint-disable-comments) is set to `error` (ESLint's default is only `warn`, and CI runs `eslint .` without `--max-warnings`, so a warning would never fail the build), so a suppression whose rule no longer fires on that line — because the code under it was later rewritten — fails lint until it's removed. That keeps the list of exceptions honest over time instead of accreting.

### Test coverage

CI runs `pnpm run test:coverage` (instead of plain `pnpm test`) and uploads the `coverage/` directory (HTML report + `lcov.info`) as a workflow artifact on every run, so you can download and browse it from the Actions run summary. As of 2026-08-26 the baseline is **78.74% statements / 67.91% branches / 83.22% functions / 80.58% lines**. Coverage thresholds are enforced via `coverage.thresholds` in `vitest.config.ts` (statements 75% / branches 62% / functions 81% / lines 77%, kept a bit under the measured baseline as headroom) — `pnpm run test:coverage` fails the build if coverage drops below these, so it's a hard gate against silent regression, not just visibility.

### Testing conventions for demo/editor components

`demo/**` and `editor/**` component tests follow a specific pattern —
`render()` + `screen.getByRole`/`getByText` + `userEvent`, via [React
Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
— rather than a whole-tree snapshot or a raw markup string-pin. See
[docs/testing-conventions.md](docs/testing-conventions.md) for the worked
example, the hydration-testing shape, and — importantly — when a
literal-value assertion (this repo's design-canvas fidelity checks) or a
real snapshot matcher (`__tests__/site-equivalence.test.ts`'s golden-DOM
tests) is still the right call rather than a lapse. `scripts/check-snapshot-allowlist.sh`,
run in CI, fails on a new `toMatchSnapshot`/`toMatchFileSnapshot`/
`toMatchInlineSnapshot` usage outside that doc's named exceptions.

### Visual regression tests

`__tests__/visual/*.visual.test.ts` render every sample in `samples-data.ts` and `xychart-samples-data.ts` in a real headless Chromium page — SVG output directly, ASCII output inside the same terminal-window chrome the live demo uses — and screenshot-diff each one against a committed baseline PNG under `__tests__/visual/__screenshots__/`. This catches regressions a string/snapshot comparison can't: a clipped label, a broken viewBox, a color resolving to the wrong palette entry, box-drawing glyphs misaligning at a given font.

**For ASCII samples, a green run here is not proof a real terminal renders the change correctly.** The `.terminal-window` chrome is `ascii-html.ts`'s HTML/CSS _approximation_ of a terminal, rendered inside a browser — it reimplements column-width math (`applyWideCharWidths`) rather than using an actual PTY, so it can drift from what `renderMermaidASCII` produces in a real shell. `ascii-terminal-overflow-scroll` shipped exactly that kind of bug: a regression in the HTML mockup's CSS that this suite didn't catch, while the underlying renderer was fine the whole time — and the reverse (a real-terminal-only regression this mockup can't see) is just as possible. If your change touches anything ASCII-related, verify it in an actual terminal before trusting this suite's screenshots as final proof — a Claude Code session in this repo should invoke the `verify-ascii-terminal` skill (`.claude/skills/verify-ascii-terminal/`) first; without that tooling, run `zombie-mermaid render --ascii` (or call `renderMermaidASCII` directly) in a real shell on both sides of the change and compare by eye.

They run under [Playwright Test](https://playwright.dev/docs/test-intro) (`playwright.config.ts`), not Vitest — deliberately: an earlier Vitest-browser-mode implementation hit an unfixed, still-open upstream bug (Node↔browser tester sessions could go silently unresponsive with no run-level timeout, hanging CI forever) that reproduced even on Vitest's pre-release fix line. Playwright Test drives the browser entirely from Node (rendering itself already happens in Node — `renderMermaidSVG`/`renderMermaidASCII` are plain string functions — and only DOM mounting runs in the browser, via the bundled harness in `__tests__/visual/helpers/`), so there's no such bridge to hang on. See [#299](https://github.com/dfadler/zombie-mermaid/issues/299) for the full investigation.

Separate from the fast node/jsdom unit suite, and needs a Chromium binary installed once:

```bash
pnpm exec playwright install --with-deps chromium
pnpm run test:visual
```

After an intentional rendering change, regenerate baselines and review the new PNGs before committing them:

```bash
pnpm run test:visual:update
```

Baseline filenames are suffixed with browser + platform (e.g. `-chromium-darwin.png` / `-chromium-linux.png`), so a macOS dev machine and the Linux CI runner keep separate baselines rather than fighting over one — CI generates and commits its own the same way a local run does, there's no cross-platform bootstrapping needed.

Don't trust a **stock** `mcr.microsoft.com/playwright:*` Docker container as a stand-in for CI when checking whether a `-chromium-linux.png` baseline is stale — confirmed in [#326](https://github.com/dfadler/zombie-mermaid/issues/326) to render the ASCII/terminal-panel samples ~100px wider than CI actually does, and later measured at 88 of 90 ASCII samples mismatching. The cause is now known and fixed: the stock image ships no DejaVu family, so generic `monospace` falls back to a CJK face that draws box-drawing glyphs at full width ([#614](https://github.com/dfadler/zombie-mermaid/issues/614), `docs/research/614-docker-font-parity.md`). Installing `fonts-dejavu-core` restores the resolution a bare `ubuntu-latest` runner uses, which is what produced the committed baselines — build `docker/visual-regression.Dockerfile` (it asserts `fc-match monospace` resolves to DejaVu at build time) rather than using the stock tag. The CI job itself now runs the same font-parity fix inside a separate, chromium-only image (`docker/visual-regression-chromium.Dockerfile`, adopted in [#868](https://github.com/dfadler/zombie-mermaid/issues/868)); see `.github/workflows/ci.yml`'s `visual-regression` job and `docs/research/549-ci-container-migration.md`/`docs/research/737-chromium-only-image-pull-timing.md`. That image is what publishes the `visual-regression-chromium-only` entry under this repo's GitHub **Packages** tab (`ghcr.io/dfadler/zombie-mermaid/visual-regression-chromium-only`) — built and pushed manually via the `workflow_dispatch`-only [visual-regression-chromium-image.yml](.github/workflows/visual-regression-chromium-image.yml) workflow, not on every push, so re-run it by hand (and re-pin `ci.yml`'s digest comment) whenever the Dockerfile or pinned Playwright/base-image version changes.

Architecture was once a live variable for the SVG half: an earlier, un-flag-matched **native arm64** container run against the shared x86 baselines produced ~5% intermittent SVG mismatches, over a different set of samples each run ([#615](https://github.com/dfadler/zombie-mermaid/issues/615)). A follow-up spike matched real CI's own flags (`CI=true`, so `playwright.config.ts` applies `retries: 2`) and diffed the exact same commit against a real, concurrently-running x86 CI run: 843/843 executions passed in the final tally on native arm64, while that same-commit CI run showed _more_ jitter than any of the quiet-host arm64 runs ([#545](https://github.com/dfadler/zombie-mermaid/issues/545), `docs/research/545-crossarch-ci-flag-matched-confirmation.md`). **Architecture is ruled out** as a driver of divergence for both halves of the suite once flags are matched.

A different question — whether native macOS Playwright (the actual generator of the `-chromium-darwin.png` baselines) matches the container's output — was answered once the SVG half of the local wrapper existed to make the comparison practical ([#551](https://github.com/dfadler/zombie-mermaid/issues/551), `docs/research/551-native-vs-container-svg-parity.md`): a real, systematic, non-noise difference exists, driven by the two OSes resolving the renderer's font stack (`'Inter', system-ui, sans-serif`, and `'JetBrains Mono', ..., monospace` for class-diagram code text) to genuinely different typefaces (macOS's own San Francisco vs. the container's DejaVu Sans/DejaVu Sans Mono font layer) — 41% of samples showed a cross-platform diff that clearly exceeded the container's own measured run-to-run jitter, including several samples that were byte-identical across two independent container runs while still differing from native macOS by a reproducible amount. **The `-linux`/`-darwin` split stays as-is**: no consolidation (a real fraction of samples would either fail permanently or force the suite's tolerance to loosen suite-wide), and no architecture-based rename either, since architecture isn't the driver and the current naming already reflects the one that is (OS/font-rendering environment). So for a _suspected-stale SVG baseline_, still prefer an actual CI run (or its `visual-regression-failures-<shard>` artifacts — the job is sharded 4-way, so a failure can land in any one of them) over a local container run when in doubt.

#### Checking the Linux baselines locally (containerized)

A macOS contributor _can_ check the Linux baselines — the ones CI actually gates on, which a local `pnpm run test:visual` never touches because it compares against `-chromium-darwin.png`:

```bash
scripts/docker-test-visual.sh                  # build the image if needed, then run the full suite (ASCII + SVG)
scripts/docker-test-visual.sh --suite ascii    # only __tests__/visual/ascii-samples.visual.test.ts
scripts/docker-test-visual.sh --suite svg      # only __tests__/visual/svg-samples.visual.test.ts
scripts/docker-test-visual.sh --help           # options, exit codes, and the full rationale
```

It syncs a copy of your working tree (uncommitted changes included) into a cache directory outside the repo, runs the container as your own UID/GID so nothing it writes is root-owned, and never mounts the repo writable — so it cannot modify a committed baseline. The container run sets `CI=true`, matching real CI's own flags (see above). `--update-snapshots` is rejected outright: the committed PNGs are the measuring instrument for #614/#615/#545, and regenerating them from a container destroys that. Failure diffs and the HTML report land in the cache directory, whose path the script prints.

**The wrapper originally covered ASCII only** ([#550](https://github.com/dfadler/zombie-mermaid/issues/550)) — the `--suite svg`/`--suite all` options above were added in [#837](https://github.com/dfadler/zombie-mermaid/issues/837), once #545's flag-matched spike closed out the #615 concern above. [#549](https://github.com/dfadler/zombie-mermaid/issues/549) (`.github/workflows/ci.yml`'s `visual-regression` job) runs a font-corrected image in real CI — since [#868](https://github.com/dfadler/zombie-mermaid/issues/868), a chromium-only build rather than this wrapper's multi-browser one, though both apply the same DejaVu font-parity fix — see `docs/research/549-ci-container-migration.md`. A suspected-stale SVG `-chromium-linux.png` is still worth cross-checking against a real CI run when the local container result is surprising, the same way you would for any other flaky-prone screenshot test. The full reasoning is in the "#545 closed, architecture ruled out" 2026-09-09 amendment to [`docs/decisions/playwright-docker-image-visual-regression.md`](./docs/decisions/playwright-docker-image-visual-regression.md) (see the later "#551 answered" amendment there for the native-vs-container question).

Font rasterization has genuine run-to-run jitter (see the comments in `playwright.config.ts` next to `expect.toHaveScreenshot`), so the comparison tolerance is deliberately looser than a byte-for-byte diff and CI retries a failing test twice before calling it a real failure. If you're touching rendering code, verify a real regression still fails clearly rather than just tightening tolerances until things pass.

The darwin side has its own analogous false-positive: if a large, cross-category swath of `-chromium-darwin.png` baselines fails locally with the _same_ diff shape — actual images consistently 20-40px taller than expected, with box widths, text, and connector positions otherwise pixel-identical (i.e. a uniform vertical drift that compounds toward the bottom of the image, not a localized content change) — that's a local font-rendering artifact, not real staleness, especially if CI on that exact commit is green. One confirmed cause: having both a variable JetBrains Mono font file (e.g. `JetBrainsMono[wght].ttf`) and its separate static weight instances (`JetBrainsMono-Regular.ttf`, etc.) installed under the same family name, which confuses Chromium's font matching and shifts line-height slightly from whatever produced the committed baseline. Before regenerating darwin baselines over a suspected regression, reproduce on a clean, unmodified `main` checkout first — if the same broad set of files fails there too while `main`'s own CI run is green, treat it as a local-environment problem to fix (e.g. de-duplicating the font install), not a baseline to update.

**Checking for the variable+static JetBrains Mono duplicate specifically** ([#849](https://github.com/dfadler/zombie-mermaid/issues/849)): run `scripts/check-jetbrains-mono-duplicates.sh` before generating or comparing local `-darwin` baselines — it scans the standard macOS font directories for JetBrains Mono files and exits non-zero if it finds both a variable file and separate static weight instances installed under the same family. It's a pre-flight sanity check you run yourself, not a CI gate (this is a macOS-only, contributor-machine-local concern; see `scripts/check-jetbrains-mono-duplicates.sh --help`). Without the script, the same thing is checkable by hand two ways:

- `fc-list | grep -i jetbrains` (if you have fontconfig installed, e.g. via Homebrew) — a healthy install shows one JetBrains Mono entry per style; a duplicate install shows the family resolving from more than one file.
- macOS Font Book (`Applications/Font Book.app`) — search "JetBrains Mono"; Font Book flags duplicate font files with a warning icon and lets you resolve duplicates directly (**Edit → Resolve Duplicates**, or select the duplicate and **File → Remove Font**).

To fix it, remove one of the two installs — keep the variable font (`JetBrainsMono[wght].ttf`) and delete the static weight files (`JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf`, etc.), since the variable font alone covers every weight. If you installed via `brew install --cask font-jetbrains-mono`, check what the cask actually placed under `~/Library/Fonts` or `/Library/Fonts`; if a second install came from somewhere else (a manual download, another cask, a project-bundled copy), remove that one instead of fighting the cask-managed copy. Re-run `scripts/check-jetbrains-mono-duplicates.sh` (or `fc-list`/Font Book) to confirm only one instance remains, then regenerate the local baselines.

For a broader, human-reviewable sweep — not a pass/fail gate, just "what does my in-progress change actually alter" — run `pnpm run visual-diff`. It renders the full catalog with the working tree's renderer against a base ref (`--base=<ref>`, default `main`) into `visual-diff.html`, showing only samples whose output actually differs.

**`visual-diff.html` and the Playwright baselines above are for iterating locally — never for the before/after screenshot in a PR/issue body when the change touches ASCII output.** Both render ASCII through `ascii-html.ts`'s HTML/CSS approximation of a terminal, not a real one, and this repo has already shipped a bug in that approximation's chrome while the underlying renderer was fine. For an ASCII-affecting change, capture the actual PR screenshot with `scripts/ascii-terminal-capture.sh` instead, which renders through a real PTY headlessly (via `asciinema` + `agg` — `brew install asciinema agg && pip3 install pillow` once) and produces a `.png` straight from that real-terminal recording. The recording terminal auto-sizes to fit the sample (never smaller than 100x40; pass explicit `[cols] [rows]` only to force a size), and the script verifies the recorded size from the `.cast` header and fails rather than silently producing a clipped screenshot - see [#483](https://github.com/dfadler/zombie-mermaid/issues/483) for the 80x24-clipped PR screenshots that check exists to prevent. Also install the rasterizer's preferred font once (`brew install --cask font-jetbrains-mono`): `agg` silently falls back to the next font in its list when one is missing, and on a machine without JetBrains Mono that fallback (Menlo) renders box-drawing junction glyphs like `┬` with a visible notch artifact — no error, just a subtly wrong screenshot. Alternatively, set `ASCII_AGG_RUNTIME=docker` (needs `docker` on PATH, no local `agg`/font install) to run agg's own maintainer-published Docker image instead, which bundles JetBrains Mono directly and so can't hit that fallback at all — see [#552](https://github.com/dfadler/zombie-mermaid/issues/552). See `scripts/ascii-terminal-capture.sh --help` for usage, or the `verify-ascii-terminal` skill for the full procedure.

Whatever kind of change produced them, a PR/issue's "Visual verification" (or
equivalent before/after) section must include the exact Mermaid source used
to produce both renders, inline in a fenced ` ```mermaid ` code block
directly after that heading and before the before/after image table — not
just a link to a sample index or a separate issue's reproduction. Without the
inline source, the screenshots aren't verifiable from the PR/issue body
alone; see [#402](https://github.com/dfadler/zombie-mermaid/issues/402).

Keep PRs focused: one fix or feature per PR is much easier to review and, if needed, to revert.

## Porting fixes from upstream

This is the part that makes this fork different from a typical project. Two situations come up:

**Pulling upstream wholesale.** When upstream (`lukilabs/beautiful-mermaid`) has commits worth taking as-is, merge `upstream/main` into a branch and open a PR against `main` from that branch, keeping the original commits (and their authorship) intact rather than squashing. You can see this pattern already in the history — e.g. PRs [#103–#106](https://github.com/lukilabs/beautiful-mermaid/pulls?q=is%3Apr+103..106) were merged upstream and then merged into this fork's `main` with their original commits and merge messages preserved, so `git log` still shows exactly who wrote what and links back to the upstream PR number. Prefer this when you're bringing over a self-contained upstream branch or PR.

**Cherry-picking or re-implementing a single upstream fix.** If you're porting just one commit, or re-writing a stuck upstream PR to get it in a mergeable state, reference the upstream source explicitly:

- In the commit message or PR description, link the upstream PR and/or commit SHA (e.g. `Ports lukilabs/beautiful-mermaid#123` or `Cherry-picked from lukilabs/beautiful-mermaid@<sha>`).
- Keep the original author's name in the commit (`git cherry-pick -x` preserves the source SHA in the message; `--signoff` or a `Co-authored-by:` trailer preserves credit if you had to rewrite the patch).
- If the upstream PR was abandoned or blocked upstream, say so briefly — it helps reviewers understand why the fix is landing here instead of there.

Either way, add a changeset (see below) describing what changed and, where relevant, that it originated upstream.

### Adding a fork-fixes entry

`demo/fork-fixes-data.ts` backs `fork-fixes.ts`, a before/after showcase of bugs this fork has fixed vs. upstream. It's a credible differentiator specifically because every pair is a _real_ render from an actual pre-fix/post-fix commit, not a hand-drawn illustration — the generator fails the build if a pair renders identically (see `fork-fixes.ts`'s own header comment and [#189](https://github.com/dfadler/zombie-mermaid/issues/189)). That evidentiary value only holds up if the page keeps growing with the fork, so treat adding an entry as a standing step for bug-fix PRs, not a one-time backfill (see [#295](https://github.com/dfadler/zombie-mermaid/issues/295)):

- If your PR fixes a bug that changes _rendered_ output (SVG or ASCII — a wrong shape, a dropped edge, a corrupted label, a layout glitch, a crash on previously-malformed input), add an entry to the `forkFixes` array in `demo/fork-fixes-data.ts`: a minimal Mermaid `source` that reproduces the bug, the `fixCommit`, the PR number, and a short `lookFor` describing what changed. Run `pnpm run fork-fixes` locally to confirm your pair actually renders two different things before committing it — see the interface doc comments in `demo/fork-fixes-data.ts` for the full field list (including the optional `excerpt` and `upstreamIssues` fields).
- If the fix is _not_ visible in rendered output (an internal refactor, a type-only fix, a performance fix, a fix to something other than the renderer itself), skip the entry — there's nothing for the showcase to demonstrate.
- The PR template's checklist has a line for this; check it or explain why it doesn't apply.
- A PR labeled `bug` that doesn't touch `demo/fork-fixes-data.ts` gets an automated, non-blocking reminder comment (`.github/workflows/fork-fixes-nudge.yml`) — a nudge to consider adding an entry, not a merge gate. It's fine to ignore when the fix genuinely has no visible rendering change.

### Staying aware of upstream changes

`.github/workflows/upstream-check.yml` runs weekly (Monday mornings UTC, plus `workflow_dispatch` for a manual run) and diffs this fork's `main` against `lukilabs/beautiful-mermaid`'s `main`. If there are commits on upstream that aren't in this fork's history, it finds-or-creates a single open issue labeled [`upstream-tracking`](https://github.com/dfadler/zombie-mermaid/issues?q=is%3Aissue+label%3Aupstream-tracking) and overwrites its body with the current full list (short SHA, subject, link). This is deliberately stateless — no "last checked" marker is tracked, since a commit that's actually been ported into this fork's `main` becomes an ancestor and drops out of the diff on its own, so each run's body is just the true current answer. If there's nothing new, the workflow does nothing and stays silent. This is purely advisory — it's not a merge gate and doesn't imply this fork needs to track upstream compatibility; it just surfaces commits worth a look so someone can decide whether to port them using the process above.

## Releasing

Version bumps and `CHANGELOG.md` entries are generated by [Changesets](https://github.com/changesets/changesets), not hand-edited. If your change is worth calling out in the changelog, run:

```bash
pnpm changeset
```

and commit the generated file under `.changeset/` alongside your change. See [RELEASING.md](./docs/RELEASING.md) for the full release flow (what happens on merge to `main`, and the npm trusted-publishing setup it depends on) — that part is maintainer-only, but the `pnpm changeset` step above is what contributors are expected to do.

## Code of conduct

Be respectful and constructive in issues, PRs, and reviews. There's no separate CODE_OF_CONDUCT.md yet — until there is, the short version is: assume good faith, keep feedback about the code rather than the person, and expect the same in return.

## License

By contributing, you agree your contributions are licensed under this project's [MIT license](LICENSE).
