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
