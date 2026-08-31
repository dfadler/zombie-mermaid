---
name: verify-ascii-terminal
description: |
  Verify an ASCII-rendering change against a real terminal (a genuine PTY)
  before producing the before/after screenshots a PR or issue description
  needs. Use this whenever the diff touches ASCII output — anything under
  src/ascii/**, ascii-html.ts, demo/client.ts's ASCII path
  (TERMINAL_ASCII_OPTS / applyWideCharWidths), index.ts's `.ascii-panel`
  markup, or __tests__/visual/ascii-samples.visual.test.ts and its
  baselines — and you're about to attach visual-verification screenshots
  per the project's before/after requirement. Do NOT treat the Playwright
  visual-regression screenshots or scripts/visual-diff.ts's HTML report as
  sufficient proof on their own for this category of change: both render
  ASCII output through a browser/HTML approximation of a terminal, not a
  real one, and this repo has already shipped a bug (the
  ascii-terminal-overflow-scroll fix) in that approximation's chrome.
metadata:
  version: "1.0.0"
---

# Verify ASCII output in a real terminal, not just the browser mockup

## Why this exists

This library has two independent ASCII "renderers" a change can affect:

1. **The terminal itself** — `renderMermaidASCII` (`src/ascii/index.ts`),
   consumed via the real CLI (`src/cli.ts` → `zombie-mermaid render --ascii`).
   Column widths, line-wrapping, and color all resolve against a real PTY:
   `detectColorMode()` (`src/ascii/ansi.ts`) inspects `process.stdout.isTTY`,
   `COLORTERM`, and `TERM` to pick `truecolor`/`ansi256`/`ansi16`/`none`, and
   a real terminal gives every wide (CJK/emoji) glyph exactly two columns.
2. **The browser mockup** — `ascii-html.ts` / `demo/client.ts`'s
   `applyWideCharWidths`, which reimplement that column math as HTML
   (`<span style="width:Nch">`) inside a `.terminal-window` CSS shell
   (`__tests__/visual/helpers/terminal-panel.ts`) so the live demo and the
   Playwright visual-regression suite have something to screenshot without
   spawning a real terminal.

`ascii-html.ts`'s own header comment names the risk directly: *"A browser
gives \[a wide glyph] whatever the fallback font's advance happens to be"* —
the HTML mockup can only *approximate* real terminal geometry, not guarantee
it. The `ascii-terminal-overflow-scroll` fix (this branch) was a bug in that
approximation's CSS, not in `renderMermaidASCII` itself — proof the two can
drift independently. `scripts/visual-diff.ts`, the tool this repo's
CONTRIBUTING.md points to for before/after PR reports, renders ASCII output
through this same `ascii-html.ts` path — so relying on it alone for a PR
screenshot never actually exercises a real terminal, on either side of the
diff. **A plain `Bash` call doesn't fill that gap either**: it's not a TTY,
so `detectColorMode()` resolves to `'none'` regardless of what a real user's
terminal would show — you need an actual PTY.

## When to use

Before attaching before/after screenshots to a PR/issue (per the global
visual-verification requirement) whose diff touches any of the files listed
in this skill's `description`. Skip it for changes that only touch the SVG
renderer, layout math with no ASCII-specific path, or non-rendering code.

## Procedure

1. **Pick a sample.** Reuse an existing entry from `samples-data.ts` that
   exercises the changed behavior where possible, rather than inventing a
   new `.mmd` fixture.

2. **Get the base-ref renderer without a full worktree.** Mirror
   `scripts/visual-diff.ts`'s own extraction (`loadRendererAt`): `git
   archive <base-sha> src | tar -x -C <scratch-dir>` pulls `src/` at the
   base commit into a scratch directory you can `import()` from — no
   worktree needed just to diff a renderer function.

3. **Render both sides through a real PTY**, using the
   `detached-terminal` skill so `renderMermaidASCII`'s `'auto'` color-mode
   detection sees a genuine terminal rather than a pipe:

   ```bash
   # after (working tree)
   agent_term.py start ascii-after --cwd "$PWD" -- \
     tsx src/cli.ts render <sample>.mmd --ascii
   agent_term.py read ascii-after --history > after.txt

   # before (base ref, extracted per step 2 into <scratch-dir>)
   agent_term.py start ascii-before --cwd "<scratch-dir>" -- \
     tsx src/cli.ts render <sample>.mmd --ascii
   agent_term.py read ascii-before --history > before.txt
   ```

   (`src/cli.ts` needs its sibling `src/` modules and `package.json`
   present to resolve its own version string — if the scratch dir from
   `git archive` lacks `package.json`, copy the working tree's `cli.ts`
   invocation against the extracted `src/` via a relative import instead
   of trying to run the base ref's `cli.ts` standalone; the point is
   exercising `renderMermaidASCII` from each ref through a real PTY, not
   necessarily the full CLI binary on both sides.)

4. **Diff `before.txt` vs `after.txt`.** Confirm the change is exactly
   what's intended — no incidental column-width, wrapping, or color
   regressions the HTML mockup wouldn't have surfaced.

5. **Only then produce the PR's actual screenshots**, using this repo's
   existing tooling: `pnpm run visual-diff` for the human-reviewable HTML
   report, or the Playwright baselines (`pnpm run test:visual:update`) for
   the committed PNGs — per CONTRIBUTING.md's "Visual regression tests"
   section.

6. **If the real-terminal capture and the HTML-mockup screenshot disagree**
   — the terminal shows one thing, the browser shows another — that's a
   bug (in the mockup, or in your fix), not a discrepancy to paper over.
   Fix it, or call it out explicitly in the PR description next to the
   screenshots.
