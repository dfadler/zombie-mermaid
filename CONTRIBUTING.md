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
- `pnpm run lint` — ESLint
- `pnpm run build` — build the publishable package with tsup
- `pnpm run samples` — render the sample gallery (`index.ts`) to `index.html`
- `pnpm run editor` — build the live editor page (`editor.ts`) to `editor.html`
- `pnpm run dev` — Vite dev server with live reload (`vite.config.ts`); serves `/` (samples showcase) and `/editor` (live editor), rebuilding on relevant file changes
- `pnpm run bench` — render benchmarks
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
4. `pnpm run test:visual` (a separate CI job; needs `pnpm exec playwright install --with-deps chromium` first — see "Visual regression tests" below)

Run those locally first, along with `pnpm run lint` and `pnpm run format:check` — both also run in CI and will fail the build on violations. Please also add or update tests under `src/**` for any behavioral change — this is a parser/renderer library, and regressions are easy to introduce silently in layout or parsing code. If the change alters rendered SVG or ASCII output, update the visual baselines too (`pnpm run test:visual:update`) and commit the changed PNGs — but for ASCII output specifically, a passing visual-regression check is not the same as a real-terminal check; see the caveat in "Visual regression tests" below before treating it as final proof.

CI also runs a `semgrep` SAST scan job (`semgrep scan --config auto --error` against Semgrep's free public rulesets, no account/token involved) that fails the build on findings. If it flags something in your PR, either fix the underlying issue or, if it's a genuine false positive, add a scoped `// nosemgrep: <rule-id>` comment on the flagged line with a comment explaining why — don't disable the rule repo-wide.

### Test coverage

CI runs `pnpm run test:coverage` (instead of plain `pnpm test`) and uploads the `coverage/` directory (HTML report + `lcov.info`) as a workflow artifact on every run, so you can download and browse it from the Actions run summary. As of 2026-08-26 the baseline is **78.74% statements / 67.91% branches / 83.22% functions / 80.58% lines**. Coverage thresholds are enforced via `coverage.thresholds` in `vitest.config.ts` (statements 75% / branches 62% / functions 81% / lines 77%, kept a bit under the measured baseline as headroom) — `pnpm run test:coverage` fails the build if coverage drops below these, so it's a hard gate against silent regression, not just visibility.

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

Don't trust a `mcr.microsoft.com/playwright:*` Docker container as a stand-in for the real `ubuntu-latest` CI runner when checking whether a `-chromium-linux.png` baseline is stale — confirmed in [#326](https://github.com/dfadler/zombie-mermaid/issues/326) to render the ASCII/terminal-panel samples ~100px wider than CI actually does (almost certainly a font-substitution difference between the image's own bundled fonts and what `playwright install --with-deps chromium` installs on bare `ubuntu-latest`), producing baseline "staleness" that doesn't reproduce in CI at all. If a linux baseline is suspected stale, verify against an actual CI run (or its `visual-regression-failures` artifact) rather than a local Docker approximation.

Font rasterization has genuine run-to-run jitter (see the comments in `playwright.config.ts` next to `expect.toHaveScreenshot`), so the comparison tolerance is deliberately looser than a byte-for-byte diff and CI retries a failing test twice before calling it a real failure. If you're touching rendering code, verify a real regression still fails clearly rather than just tightening tolerances until things pass.

For a broader, human-reviewable sweep — not a pass/fail gate, just "what does my in-progress change actually alter" — run `pnpm run visual-diff`. It renders the full catalog with the working tree's renderer against a base ref (`--base=<ref>`, default `main`) into `visual-diff.html`, showing only samples whose output actually differs.

Keep PRs focused: one fix or feature per PR is much easier to review and, if needed, to revert.

## Porting fixes from upstream

This is the part that makes this fork different from a typical project. Two situations come up:

**Pulling upstream wholesale.** When upstream (`lukilabs/beautiful-mermaid`) has commits worth taking as-is, merge `upstream/main` into a branch and open a PR against `main` from that branch, keeping the original commits (and their authorship) intact rather than squashing. You can see this pattern already in the history — e.g. PRs [#103–#106](https://github.com/lukilabs/beautiful-mermaid/pulls?q=is%3Apr+103..106) were merged upstream and then merged into this fork's `main` with their original commits and merge messages preserved, so `git log` still shows exactly who wrote what and links back to the upstream PR number. Prefer this when you're bringing over a self-contained upstream branch or PR.

**Cherry-picking or re-implementing a single upstream fix.** If you're porting just one commit, or re-writing a stuck upstream PR to get it in a mergeable state, reference the upstream source explicitly:

- In the commit message or PR description, link the upstream PR and/or commit SHA (e.g. `Ports lukilabs/beautiful-mermaid#123` or `Cherry-picked from lukilabs/beautiful-mermaid@<sha>`).
- Keep the original author's name in the commit (`git cherry-pick -x` preserves the source SHA in the message; `--signoff` or a `Co-authored-by:` trailer preserves credit if you had to rewrite the patch).
- If the upstream PR was abandoned or blocked upstream, say so briefly — it helps reviewers understand why the fix is landing here instead of there.

Either way, add a changeset (see below) describing what changed and, where relevant, that it originated upstream.

### Staying aware of upstream changes

`.github/workflows/upstream-check.yml` runs weekly (Monday mornings UTC, plus `workflow_dispatch` for a manual run) and diffs this fork's `main` against `lukilabs/beautiful-mermaid`'s `main`. If there are commits on upstream that aren't in this fork's history, it finds-or-creates a single open issue labeled [`upstream-tracking`](https://github.com/dfadler/zombie-mermaid/issues?q=is%3Aissue+label%3Aupstream-tracking) and overwrites its body with the current full list (short SHA, subject, link). This is deliberately stateless — no "last checked" marker is tracked, since a commit that's actually been ported into this fork's `main` becomes an ancestor and drops out of the diff on its own, so each run's body is just the true current answer. If there's nothing new, the workflow does nothing and stays silent. This is purely advisory — it's not a merge gate and doesn't imply this fork needs to track upstream compatibility; it just surfaces commits worth a look so someone can decide whether to port them using the process above.

## Releasing

Version bumps and `CHANGELOG.md` entries are generated by [Changesets](https://github.com/changesets/changesets), not hand-edited. If your change is worth calling out in the changelog, run:

```bash
pnpm changeset
```

and commit the generated file under `.changeset/` alongside your change. See [RELEASING.md](./RELEASING.md) for the full release flow (what happens on merge to `main`, and the npm trusted-publishing setup it depends on) — that part is maintainer-only, but the `pnpm changeset` step above is what contributors are expected to do.

## Code of conduct

Be respectful and constructive in issues, PRs, and reviews. There's no separate CODE_OF_CONDUCT.md yet — until there is, the short version is: assume good faith, keep feedback about the code rather than the person, and expect the same in return.

## License

By contributing, you agree your contributions are licensed under this project's [MIT license](LICENSE).
