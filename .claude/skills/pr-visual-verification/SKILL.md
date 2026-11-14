---
name: pr-visual-verification
description: |
  Build the complete "Visual verification" section of a PR or issue body for any
  change that could alter a rendered result. Use before opening or updating a PR
  whose diff touches src/, packages/{ascii-renderer,svg-renderer,core,ascii-layout,
  elk-layout,mermaid-parser}/src, demo/, packages/site/ascii-html.ts or the CLI, or
  when asked for "visual verification", "before/after screenshots" or "show it
  renders right". Fixes the section's shape: the Mermaid source in a fenced
  `mermaid` block (GitHub renders it, the reference), then SVG before/after if SVG
  can change, then ASCII before/after (real terminal) if ASCII can change. Drives
  verify-ascii-terminal for the ASCII half; never replaces it.
metadata:
  internal: true
---

# pr-visual-verification

PRs kept shipping with a missing or jumbled visual section. The rule is the same
every time, so the section has one fixed shape and this skill fills it.

## 1. Decide: is verification required?

Required if the diff **could** change a rendered result, even when you believe it
doesn't (parser, layout, theme, text measurement, CLI ASCII path, `demo/`
rendering, `packages/site/ascii-html.ts`). Check with the diff, not memory:

```bash
git diff --name-only origin/main...HEAD | grep -Ev '(__tests__|\.test\.)'
```

Not required only for docs, CI, tooling, and test-only diffs. Then write
`Visual verification: N/A: <reason tied to this diff>` on the checklist line and
leave the section out. A change you think is byte-identical still gets the
section: show the before and after matching (that is the evidence).

## 2. Pick the sample

Use the smallest Mermaid source that reaches the changed code path (diagram type
plus the construct touched). Prefer a `samples/samples-data.ts` entry, else a
minimal inline source. One source is used for **every** render below, so the
reader compares like with like. Several constructs changed: several sources,
each its own sub-section.

## 3. Fill the section, in this order

````markdown
## Visual verification

**Source** (verified against: <mermaid version, or "n/a, no parity claim">)

```mermaid
<exact source used for every render below>
```

<!-- GitHub renders the block above itself: that is the "as GitHub renders it" reference. -->

### SVG (only if SVG can change)

| Before (main @ <sha>) | After (this PR) |
| --------------------- | --------------- |
| ![before](…)          | ![after](…)     |

### ASCII (only if ASCII can change; real terminal)

| Before (main @ <sha>) | After (this PR) |
| --------------------- | --------------- |
| ![before](…)          | ![after](…)     |
````

Rules:

- Source block comes **first**, right after the heading, before any image.
- Two columns, tight crops, labeled with the base sha. A heading or sentence for
  a half that does not apply is deleted, not left empty. Say why in one line
  ("SVG unchanged: ASCII-only path") so the omission is deliberate.
- Mockup-only change (`.ascii-output` CSS, `ascii-html.ts` chrome): follow
  `verify-ascii-terminal`'s mockup branch and label the images "browser mockup".
- Parity claims ("matches mermaid") name the version checked and compare against
  what users see (CLAUDE.md, "Parity with mermaid.js").

## 4. Produce the images

**Base renderer without a worktree** (same trick as `verify-ascii-terminal`):

```bash
mkdir -p tmp-base-ref && git archive origin/main src packages tsconfig.json | tar -x -C tmp-base-ref
```

**SVG** (browser render, so a browser screenshot is legitimate). Put the source in
`<scratch>/s.mmd`, then one command per side:

```bash
pnpm exec tsx .claude/skills/pr-visual-verification/svg-shot.mjs ./src/index.ts <scratch>/s.mmd <scratch>/after.png
pnpm exec tsx --tsconfig tmp-base-ref/tsconfig.json .claude/skills/pr-visual-verification/svg-shot.mjs ./tmp-base-ref/src/index.ts <scratch>/s.mmd <scratch>/before.png
```

Each also writes the `.svg` next to the PNG.

Confirm `before.svg` differs from `after.svg` when a change is expected
(`cmp`); identical bytes with an expected change means the base resolved to
your working tree (see the `tmp-base-ref` note in `verify-ascii-terminal`).

**ASCII**: invoke `verify-ascii-terminal` and use its `before.png`/`after.png`.
Never Playwright or `visual-diff` output for ASCII.

**Attach**: `gh-attach-image` for each PNG. Edit the body from a file
(`gh pr edit --body-file`), never a heredoc inside `$()`.

## 5. Check before reporting done

1. `gh pr view <n> --json body -q .body | grep -c '^```mermaid'` is at least 1.
2. Every image URL in the section resolves (open the saved PR, not the draft).
3. The SVG and ASCII halves match what the diff can change: no missing half, no
   half for a renderer the diff cannot reach.
4. Re-check after any later push that changes output; stale images are a wrong claim.
5. Delete `tmp-base-ref/`.

`scripts/pre-pr-check.sh` warns (never blocks) at `gh pr create` when rendering
paths changed and the body has no `mermaid` block. The PR checklist box for this
section follows `pr-checklist`: tick it only with evidence from this session.
