---
name: verify-ascii-terminal
description: |
  Produce the before/after screenshots a PR or issue description needs for
  an ASCII-rendering change — as a real-terminal capture (via
  scripts/ascii-terminal-capture.sh), never a browser/HTML screenshot. Use
  this whenever the diff touches ASCII output — anything under
  src/ascii/**, ascii-html.ts, src/cli.ts's ASCII path, demo/client.ts's
  ASCII path (TERMINAL_ASCII_OPTS / applyWideCharWidths), index.ts's
  `.ascii-panel` markup, scripts/visual-diff.ts,
  __tests__/visual/helpers/terminal-panel.ts, or
  __tests__/visual/ascii-samples.visual.test.ts and its baselines — and
  you're about to attach visual-verification screenshots per the project's
  before/after requirement. Never substitute the Playwright
  visual-regression screenshots or scripts/visual-diff.ts's HTML report for
  this category of change's PR screenshot, and never screenshot a real GUI
  terminal window either: both render ASCII output through a browser/HTML
  approximation of a terminal, not a real one (this repo has already
  shipped a bug — the ascii-terminal-overflow-scroll fix — in that
  approximation's chrome), and a GUI window steals focus. Only this skill's
  headless real-PTY capture satisfies the requirement.
metadata:
  version: '2.0.0'
---

# Verify ASCII output in a real terminal — and screenshot that, not the browser mockup

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
it. The `ascii-terminal-overflow-scroll` fix (the branch that introduced
this skill) was a bug in that approximation's CSS, not in
`renderMermaidASCII` itself — proof the two can drift independently.
`scripts/visual-diff.ts`, the tool CONTRIBUTING.md points to for a
human-reviewable before/after **report during development**, renders ASCII
output through this same `ascii-html.ts` path — so it (and the Playwright
visual-regression baselines, which use the identical chrome) is fine for
iterating locally, but its screenshot must never be what ends up attached to
a PR/issue as ASCII visual-verification evidence: it never exercised a real
terminal on either side of the diff. **A plain `Bash` call doesn't fill that
gap either**: it's not a TTY, so `detectColorMode()` resolves to `'none'`
regardless of what a real user's terminal would show — you need an actual
PTY. And a real GUI terminal window (`open -a Terminal`, iTerm, etc.) isn't
the fix either: it takes focus away from whatever the human is doing, which
this repo's (and the global) CLAUDE.md both forbid as a side effect of a
task.

`scripts/ascii-terminal-capture.sh` resolves all three constraints at once:
it drives `renderMermaidASCII` inside a real PTY via
[`asciinema`](https://asciinema.org)'s headless recording mode (no
interactive terminal or GUI window required), then rasterizes that
recording to a PNG with [`agg`](https://github.com/asciinema/agg) — a real
font-shaping pipeline (the same one asciinema's own GIF exports use), not a
hand-rolled HTML approximation. Nothing is ever drawn on screen.

## When to use

Before attaching before/after screenshots to a PR/issue (per the global
visual-verification requirement) whose diff touches any of the files listed
in this skill's `description`. Skip it for changes that only touch the SVG
renderer, layout math with no ASCII-specific path, or non-rendering code.

## One-time setup

```bash
brew install asciinema agg
pip3 install pillow
```

A real invocation of `scripts/ascii-terminal-capture.sh` checks for all four
(`asciinema`, `agg`, `python3`, and `tsx` via the project's own
`node_modules/.bin`) before recording anything, and fails fast with a clear
message naming whichever is missing, rather than a confusing failure partway
through. (`--help` on its own exits before that check runs — it doesn't
validate anything, just prints usage.)

## Procedure

1. **Pick a sample.** Reuse an existing entry from `samples-data.ts` if one
   exercises the changed behavior — but don't assume it does: `samples-data.ts`
   is a curated, hand-maintained catalog with no automated check that it
   stays current with every diagram feature. Confirm the entry you pick
   actually reaches the changed code path (the diagram type and syntax
   construct the change touches), and if none does, write a minimal inline
   Mermaid source string covering it rather than skipping verification —
   pass a path to a `.mmd` file in that case instead of a numeric index.

2. **Get the base-ref renderer without a full worktree.** Mirror
   `scripts/visual-diff.ts`'s own extraction (`loadRendererAt`):

   ```bash
   mkdir -p tmp-base-ref
   git archive main src | tar -x -C tmp-base-ref
   ```

   pulls `src/` at the base commit into a scratch directory — no worktree
   needed just to diff a renderer function. This is also why `src/cli.ts`
   isn't the right tool for the "before" side: it reads `../package.json`
   (for its `--version` string) relative to its own file, which the scratch
   dir doesn't have. `scripts/ascii-render-runner.mjs` (what the capture
   script runs inside the PTY) imports `renderMermaidASCII` directly
   instead — the same function `cli.ts` itself calls — and skips the CLI
   entirely on both sides. Delete `tmp-base-ref/` once done; it's a scratch
   extraction, not something to commit.

3. **Capture both sides** — replace `12` with the sample's actual index (or
   a `.mmd` file path for the inline-fallback case from step 1); the sample
   always comes from the _working tree's_ `samples-data.ts`, per
   `scripts/visual-diff.ts`'s own comment, even when comparing an older
   renderer:

   ```bash
   scripts/ascii-terminal-capture.sh ./src/index.ts 12 /tmp/after
   scripts/ascii-terminal-capture.sh ./tmp-base-ref/src/index.ts 12 /tmp/before
   ```

   Each invocation writes `<prefix>.cast` (the raw recording), `<prefix>.txt`
   (a plain-text export, for diffing), and `<prefix>.png` (a real-terminal
   screenshot, auto-cropped to content).

4. **Diff `/tmp/before.txt` vs `/tmp/after.txt`.** Confirm the change is
   exactly what's intended — no incidental column-width, wrapping, or color
   regressions the HTML mockup wouldn't have surfaced.

5. **Attach `/tmp/before.png` and `/tmp/after.png`** to the PR/issue (e.g.
   via the `gh-attach-image` skill) as the visual-verification evidence.
   These _are_ the PR's actual screenshots — there's no separate "now
   produce the real screenshot" step through `visual-diff`/Playwright; using
   either of those for the attached image is exactly the mistake this skill
   exists to prevent, even after doing the real-PTY check in steps 3–4.

6. **If the real-terminal capture and an HTML-mockup rendering (e.g. the
   live demo, or a Playwright baseline) disagree** — the terminal shows one
   thing, the browser shows another — that's a bug (in the mockup, or in
   your fix), not a discrepancy to paper over. Fix it, or call it out
   explicitly in the PR description next to the screenshots.
