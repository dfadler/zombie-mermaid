---
name: pr-visual-verification
description: |
  Build the "Visual verification" section of a PR or issue body for any change that
  could alter a rendered result (src/, packages/*/src, demo/ and the CLI are examples,
  not a full list). Returns the section (Mermaid source block, SVG and ASCII
  before/after) or an N/A line. Use before opening or updating such a PR, or when asked
  for "visual verification", "before/after screenshots", or N/A on a byte-identical change. Not for the ASCII capture
  alone (verify-ascii-terminal) or the checklist boxes (pr-checklist).
metadata:
  internal: true
---

# pr-visual-verification

## Contract

- **Input:** a diff or PR that could change a rendered result.
- **Output:** the complete "Visual verification" section in the PR body, or an
  `N/A: <reason>` checklist line when the diff cannot change a render.
- **Does not:** judge parity with mermaid.js, replace `verify-ascii-terminal` for the
  ASCII capture, or edit the checklist boxes (`pr-checklist` owns them).

## 1. Decide: is verification required?

Run the check the PR hook uses:

```bash
scripts/pre-pr-check.sh --body-file /dev/null
```

A warning that starts "Rendering paths changed" means the section is required. Its
path list (the `files` test in `scripts/pre-pr-check.sh`) is the one list of rendering
paths; it also covers a change you believe is byte-identical, so show the before and
after matching. No such warning, and the diff touches only docs, CI, tooling or tests:
write `Visual verification: N/A: <reason tied to this diff>` on the checklist line and
leave the section out. A diff outside that path list that still changes a render
(theme tokens, text measurement) is required too.

## 2. Pick the sample

Use the smallest Mermaid source that reaches the changed code path (diagram type
plus the construct touched). Prefer a `samples/samples-data.ts` entry, else a
minimal inline source. Use that one source for each render in the section, so the
reader compares like with like. Several constructs changed: several sources,
each its own sub-section.

## 3. Fill the section, in this order

````markdown
## Visual verification

**Source** (verified against: <mermaid version, or "n/a, no parity claim">)

```mermaid
<exact source used for each render in this section>
```

### SVG (only if SVG can change)

| Before (main @ <sha>) | After (this PR) |
| --------------------- | --------------- |
| ![before](…)          | ![after](…)     |

### ASCII (only if ASCII can change; real terminal)

| Before (main @ <sha>) | After (this PR) |
| --------------------- | --------------- |
| ![before](…)          | ![after](…)     |
````

GitHub [renders a fenced `mermaid` block as a diagram](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
in issues, pull requests and Markdown files; the rendered block is the reference.

Rules:

- Put the source block first, right after the heading, before any image.
- Use two columns and tight crops, and label the before column with the base sha.
- Delete the heading and table of a half that does not apply, and add one line
  saying why ("SVG unchanged: ASCII-only path").
- Mockup-only change (`.ascii-output` CSS, `ascii-html.ts` chrome): follow
  `verify-ascii-terminal`'s mockup branch and label the images "browser mockup".
- Parity claims ("matches mermaid") name the version checked and compare against
  what users see (CLAUDE.md, "Parity with mermaid.js").

## 4. Produce the images

**Base renderer without a worktree.** Extract it into a scratch directory outside the
repo (the session scratchpad when the environment names one, else a fresh
`mktemp -d /tmp/scratch.XXXXXX`) and link the repo's `node_modules` into it. You delete
that directory in check 5.

```bash
scratch=$(mktemp -d /tmp/scratch.XXXXXX)   # or the session scratchpad
mkdir "$scratch/base" && git archive origin/main src packages tsconfig.json | tar -x -C "$scratch/base"
ln -s "$PWD/node_modules" "$scratch/base/node_modules"
```

**SVG** (browser render, so a browser screenshot is legitimate). Put the source in
`$scratch/s.mmd`, then one command per side:

```bash
pnpm exec tsx .claude/skills/pr-visual-verification/svg-shot.mjs ./src/index.ts "$scratch/s.mmd" "$scratch/after.png"
pnpm exec tsx --tsconfig "$scratch/base/tsconfig.json" .claude/skills/pr-visual-verification/svg-shot.mjs "$scratch/base/src/index.ts" "$scratch/s.mmd" "$scratch/before.png"
```

Each also writes the `.svg` next to the PNG.

When a change is expected, confirm `before.svg` differs from `after.svg` (`cmp`).
Identical bytes mean the base resolved to your working tree: re-extract, and
check that `$scratch/base/tsconfig.json` exists.

**ASCII**: invoke `verify-ascii-terminal` and use its `before.png`/`after.png`.
Take the ASCII images from that skill, never from Playwright or `visual-diff`.

**Attach**: `gh-attach-image` for each PNG. Edit the body from a file
(`gh pr edit --body-file`), not a heredoc inside `$()`.

## 5. Check before reporting done

1. `gh pr view <n> --json body -q .body | grep -c '^```mermaid'` is at least 1.
2. Every image URL in the section resolves (open the saved PR, not the draft).
3. The SVG and ASCII halves match what the diff can change: no missing half, no
   half for a renderer the diff cannot reach.
4. After any later push that changes output, regenerate the images; stale images are
   a wrong claim.
5. Run `rm -rf "$scratch"`.

`scripts/pre-pr-check.sh` warns (without blocking) at `gh pr create` when rendering
paths changed and the body has no `mermaid` block. Tick the PR checklist box for this
section only as `pr-checklist` says.
