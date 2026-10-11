# Brand

How the product name is spelled in rendered UI text, and why it isn't
spelled the same way everywhere.

## Two wordmark forms

The icon (two rounded squares over a bracket, drawn in `--cyan`/`--violet`/
`--pink`) never changes. The text beside it does, depending on whether the
icon is actually there:

- **`ZombieMermaid`** (merged, PascalCase) — used only in a **logo
  lockup**: the icon rendered directly next to the wordmark, as one unit.
  There are exactly three of these in the demo site, each its own component
  instance (they share no runtime state — see nav.tsx's module doc):
  - `NAV_WORDMARK` in [`demo/components/nav.tsx`](../demo/components/nav.tsx) — the site nav bar
  - `FOOTER_WORDMARK` in [`demo/components/footer.tsx`](../demo/components/footer.tsx) — the footer's brand block (`FooterMark` + wordmark)
  - `EditorLogo` in [`demo/components/editor-topbar.tsx`](../demo/components/editor-topbar.tsx) — the editor's own icon + wordmark + "Live Editor" lockup
- **`Zombie Mermaid`** (two words, space, title case) — used everywhere
  else the product is named in visible or semantic UI text, with no icon
  alongside it: page `<title>`s, `og:title`/`twitter:title`, the JSON-LD
  `SoftwareApplication.name`, the footer's copyright line, the editor
  preview pane's credit text, and diagram-page titles.

If you're adding new UI text that names the product, ask: **is the icon
rendered right next to this text, as a single unit?** If yes, it's a
lockup — use `ZombieMermaid`. If no — a page title, a credit line, a
sentence of body copy — use `Zombie Mermaid`.

## What neither form touches

Structural identifiers stay exactly `zombie-mermaid` (all lowercase,
hyphenated) regardless of the rule above, because they're things a user
types or a URL that has to keep resolving, not brand typography:

- The npm package name (`zombie-mermaid`) and every `@zombie-mermaid/*`
  workspace package
- The GitHub repo slug (`dfadler/zombie-mermaid`) and any link built from it
- The site's `/zombie-mermaid/` GitHub Pages base path
- CLI command examples shown in copy (`npm install zombie-mermaid`,
  `zombie-mermaid render`, `zombie-mermaid mcp`)

## History

The wordmark was rebranded from the original hyphenated `zombie-mermaid` to
`ZombieMermaid`/`Zombie Mermaid` through a Claude Design typography
exploration (icon fixed, several wordmark directions compared side by
side, then narrowed and refined) — see
[#916](https://github.com/dfadler/zombie-mermaid/pull/916).
