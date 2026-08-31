# Choosing and customizing a theme

Getting a diagram to match the page it sits on, in four escalating steps. Stop
at whichever one is enough.

If you want to understand _how_ the color system works rather than how to use
it, read [Theming](../theming.md) instead — it documents every derivation.

## 1. Try the built-in themes

The [live demo](https://dfadler.github.io/zombie-mermaid/) has a theme picker
in the top bar. Three are shown inline; the **"16 Themes"** button opens the
rest — 15 built-in themes plus **Default**.

Switching re-themes every diagram on the page instantly, without re-rendering
any of them. That is not an optimization detail you can ignore: it is the same
mechanism you get in your own app (see step 4), so what you see in the picker
is what live theme switching will actually cost you.

Your choice is remembered between visits, and **Random Theme** cycles through
them if you are undecided.

The 15 built-ins — 6 light, 9 dark:

**Light** — `zinc-light`, `github-light`, `solarized-light`,
`tokyo-night-light`, `nord-light`, `catppuccin-latte`

**Dark** — `zinc-dark`, `github-dark`, `solarized-dark`, `tokyo-night`,
`tokyo-night-storm`, `nord`, `dracula`, `catppuccin-mocha`, `one-dark`

From code:

```typescript
import { renderMermaidSVG, THEMES } from 'zombie-mermaid'

const svg = renderMermaidSVG(source, THEMES['tokyo-night'])
```

Or from the terminal:

```bash
zombie-mermaid themes                            # list the names
zombie-mermaid render diagram.mmd --ascii --theme dracula
```

## 2. Use your own two colors

If none of the built-ins match your site, you usually do not need a theme at
all — just a background and a foreground:

```typescript
const svg = renderMermaidSVG(source, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
})
```

Everything else — node fills, strokes, edge colors, secondary text — is
derived from those two with `color-mix()`. This is **mono mode**, and for most
diagrams it is all you need. Two colors that already work together on your
page will produce a diagram that works on it too.

## 3. Add accent colors where it matters

When mono mode is close but something needs to stand out, override only that:

```typescript
const svg = renderMermaidSVG(source, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  accent: '#7aa2f7', // arrow heads and highlights
  line: '#3d59a1', // edge connectors
})
```

Any enrichment color you leave out falls back to its derivation, so you can
override one thing without having to specify the other six.

The full set is `line`, `accent`, `muted`, `surface`, and `border` —
see [Theming](../theming.md#enriched-mode) for what each drives.

## 4. Switch themes live, without re-rendering

Colors are emitted as CSS custom properties, not baked into each element. So
if you render once with `transparent: true` and CSS variables:

```typescript
const svg = renderMermaidSVG(source, {
  bg: 'var(--background)',
  fg: 'var(--foreground)',
  transparent: true,
})
```

…then the diagram follows your page's theme automatically. Flip your
site's dark mode and the diagram flips with it — no re-render, no flash, no
second SVG to ship.

This is what the demo's picker does.

## Reusing your editor theme

If your app already has a Shiki (VS Code) theme loaded, you can derive a
matching diagram theme from it rather than hand-picking colors twice:

```typescript
import { fromShikiTheme, renderMermaidSVG } from 'zombie-mermaid'

const svg = renderMermaidSVG(source, fromShikiTheme(myShikiTheme))
```

It reads `editor.background`, `editor.foreground`, and a few token colors,
falling back to sensible defaults for anything the theme does not define.

## Theming ASCII output

ASCII rendering has its own color modes, since a terminal is not a browser:

```typescript
import { renderMermaidASCII } from 'zombie-mermaid'

renderMermaidASCII(source, { colorMode: 'none' }) // plain text
renderMermaidASCII(source, { colorMode: 'ansi256' }) // 256-color terminal
renderMermaidASCII(source, { colorMode: 'truecolor' }) // 24-bit terminal
renderMermaidASCII(source, { colorMode: 'html' }) // <span> tags for a browser
```

Use `none` for anything that gets committed to a repo — escape codes in a
README help nobody.

## Next

- [Theming reference](../theming.md) — every derivation, custom theme objects
- [Browsing and using the samples](samples.md) — see themes applied across all
  88 samples at once
