# Writing a blog post

Add a `.md` file here. `blog.ts` (run via `pnpm run blog`, or as part of
`pnpm run build:site`) picks up every file in this directory and renders it
to `blog/<slug>.html`.

## Frontmatter

Each file starts with a frontmatter block:

```markdown
---
title: What it's been like maintaining a Mermaid fork
date: 2026-09-04
description: A few months in — what's changed, what surprised us.
---

Regular Markdown from here on.
```

- `title` — required.
- `date` — required, `YYYY-MM-DD`. Drives sort order on `blog/index.html`
  and `blog/feed.xml`'s publish date.
- `description` — required. Used as the page's meta description, the
  excerpt shown on `blog/index.html`, and the RSS item description.
- `slug` — optional. See below.

## Slugs and filenames

The filename (without `.md`) is the post's slug and becomes its URL:
`blog-posts/maintaining-the-fork.md` → `blog/maintaining-the-fork.html`.

Filenames must already be clean kebab-case — lowercase letters, digits, and
hyphens only. No date prefix (`2026-09-04-maintaining-the-fork.md`): the
date lives in frontmatter, not the filename, so it can't drift between the
two.

If you need to rename the source file without changing the published URL,
add an explicit `slug:` field to the frontmatter — it overrides the
filename.

`index` and `feed` are reserved slugs (`blog/index.html` and
`blog/feed.xml` already use them) and two posts can't resolve to the same
slug — both are build-time errors, not a silent overwrite.

## Code blocks

Fenced code blocks are syntax-highlighted at build time via `shiki`. Use a
standard language tag (` ```ts `, ` ```bash `, ` ```json `, etc.) — an
unrecognized or missing language falls back to plain text.

### Mermaid: source vs. rendered diagram

A ` ```mermaid ` fence is syntax-highlighted like any other code block — it
does **not** render as a diagram. Use this for:

- The exact source used to produce an adjacent before/after screenshot
  (real-terminal or SVG) — CLAUDE.md requires the raw source stay pasted
  inline so the screenshot is verifiable from the post body alone.
- A repro of an _upstream_ (or otherwise no-longer-true) bug. Auto-rendering
  it through this fork's own (fixed) renderer would show different output
  than the bug being described, which would contradict the post.

Use ` ```mermaid-render ` instead when the diagram itself — not its source
text — is the point (e.g. a chart illustrating data the post discusses, with
no accompanying screenshot). That fence renders to an inline SVG at build
time via the same `renderMermaidSVG` the per-diagram-type gallery pages use,
as a white card (see demo/blog.css's `.mermaid-diagram`). A source syntax
error in one of these fails the whole build, same as a bad frontmatter
field — see blog.ts's `renderMermaidDiagram`.
