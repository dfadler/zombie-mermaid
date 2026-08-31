---
name: verify-ascii-terminal
description: |
  Verify an ASCII-rendering change against a real terminal (a genuine PTY)
  before producing the before/after screenshots a PR or issue description
  needs. Use this whenever the diff touches ASCII output — anything under
  src/ascii/**, ascii-html.ts, src/cli.ts's ASCII path, demo/client.ts's
  ASCII path (TERMINAL_ASCII_OPTS / applyWideCharWidths), index.ts's
  `.ascii-panel` markup, scripts/visual-diff.ts,
  __tests__/visual/helpers/terminal-panel.ts, or
  __tests__/visual/ascii-samples.visual.test.ts and its baselines — and
  you're about to attach visual-verification screenshots
  per the project's before/after requirement. Do NOT treat the Playwright
  visual-regression screenshots or scripts/visual-diff.ts's HTML report as
  sufficient proof on their own for this category of change: both render
  ASCII output through a browser/HTML approximation of a terminal, not a
  real one, and this repo has already shipped a bug (the
  ascii-terminal-overflow-scroll fix) in that approximation's chrome.
metadata:
  version: '1.0.0'
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

`ascii-html.ts`'s own header comment names the risk directly: _"A browser
gives \[a wide glyph] whatever the fallback font's advance happens to be"_ —
the HTML mockup can only _approximate_ real terminal geometry, not guarantee
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

1. **Pick a sample.** Reuse an existing entry from `samples-data.ts` if one
   exercises the changed behavior — but don't assume it does: `samples-data.ts`
   is a curated, hand-maintained catalog with no automated check that it
   stays current with every diagram feature. Confirm the entry you pick
   actually reaches the changed code path (the diagram type and syntax
   construct the change touches), and if none does, write a minimal inline
   Mermaid source string covering it rather than skipping verification.

2. **Get the base-ref renderer without a full worktree.** Mirror
   `scripts/visual-diff.ts`'s own extraction (`loadRendererAt`): `git
archive <base-sha> src | tar -x -C <scratch-dir>` pulls `src/` at the
   base commit into a scratch directory — no worktree needed just to diff
   a renderer function. This is also why `src/cli.ts` isn't the right tool
   for the "before" side: it reads `../package.json` (for its `--version`
   string) relative to its own file, which the scratch dir doesn't have.
   Import `renderMermaidASCII` directly instead — the same function
   `cli.ts` itself calls — and skip the CLI entirely on both sides.

3. **Render both sides through a real PTY**, using the
   `detached-terminal` skill so `renderMermaidASCII`'s `'auto'` color-mode
   detection sees a genuine terminal rather than a pipe. Write a small
   throwaway runner once (the sample always comes from the _working
   tree's_ `samples-data.ts`, per `scripts/visual-diff.ts`'s own comment,
   even when comparing an older renderer):

   ```js
   // /tmp/verify-ascii.mjs — usage: tsx verify-ascii.mjs <path-to-src/index.ts> <sample-index-or-file>
   // Second arg is a numeric samples-data.ts index (e.g. "12"), or a path to
   // a .mmd file — for the step 1 inline-fallback case, when no existing
   // sample reaches the changed code path.
   import { readFileSync } from 'node:fs'
   import { resolve } from 'node:path'
   import { pathToFileURL } from 'node:url'
   const [, , indexModulePath, sampleArg] = process.argv
   // Resolved from cwd rather than hardcoded, so the runner works unmodified
   // regardless of which checkout it's copied into — both invocations below
   // run with --cwd "$PWD" (the repo root), matching "the sample always
   // comes from the working tree's samples-data.ts" from step 3's intro.
   const source = /^\d+$/.test(sampleArg)
     ? (await import(pathToFileURL(resolve('samples-data.ts')).href)).samples[
         Number(sampleArg)
       ].source
     : readFileSync(sampleArg, 'utf8')
   // A relative specifier passed to import() resolves against this script's
   // own URL (/tmp/…), not process.cwd() — resolve to an absolute file URL
   // first so a relative ./src/index.ts arg lands on the right ref's tree.
   const { renderMermaidASCII } = await import(
     pathToFileURL(resolve(indexModulePath)).href
   )
   process.stdout.write(renderMermaidASCII(source, { colorMode: 'auto' }))
   ```

   then run it against each ref's `src/index.ts` inside a PTY — replace `12`
   below with the sample's actual index (or a `.mmd` file path for the
   inline-fallback case):

   ```bash
   # after (working tree)
   agent_term.py start ascii-after --cwd "$PWD" -- \
     tsx /tmp/verify-ascii.mjs ./src/index.ts 12
   agent_term.py read ascii-after --history > after.txt

   # before (base ref, extracted per step 2 into <scratch-dir>)
   agent_term.py start ascii-before --cwd "$PWD" -- \
     tsx /tmp/verify-ascii.mjs <scratch-dir>/src/index.ts 12
   agent_term.py read ascii-before --history > before.txt
   ```

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
