# Theming

The theming system is the heart of `zombie-mermaid`. It's designed to be both powerful and dead simple.

## The Two-Color Foundation

Every diagram needs just two colors: **background** (`bg`) and **foreground** (`fg`). That's it. From these two colors, the entire diagram is derived using `color-mix()`:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: '#1a1b26', // Background
  fg: '#a9b1d6', // Foreground
})
```

This is **Mono Mode**—a coherent, beautiful diagram from just two colors. The system automatically derives:

| Element        | Derivation                |
| -------------- | ------------------------- |
| Text           | `--fg` at 100%            |
| Secondary text | `--fg` at 60% into `--bg` |
| Edge labels    | `--fg` at 40% into `--bg` |
| Faint text     | `--fg` at 25% into `--bg` |
| Connectors     | `--fg` at 50% into `--bg` |
| Arrow heads    | `--fg` at 85% into `--bg` |
| Node fill      | `--fg` at 3% into `--bg`  |
| Group header   | `--fg` at 5% into `--bg`  |
| Inner strokes  | `--fg` at 12% into `--bg` |
| Node stroke    | `--fg` at 20% into `--bg` |

## Enriched Mode

For richer themes, you can provide optional "enrichment" colors that override specific derivations:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  // Optional enrichment:
  line: '#3d59a1', // Edge/connector color
  accent: '#7aa2f7', // Arrow heads, highlights
  muted: '#565f89', // Secondary text, labels
  surface: '#292e42', // Node fill tint
  border: '#3d59a1', // Node stroke
})
```

If an enrichment color isn't provided, it falls back to the `color-mix()` derivation. This means you can provide just the colors you care about.

## CSS Custom Properties = Live Switching

All colors are CSS custom properties on the `<svg>` element. This means you can switch themes instantly without re-rendering:

```javascript
// Switch theme by updating CSS variables
svg.style.setProperty('--bg', '#282a36')
svg.style.setProperty('--fg', '#f8f8f2')
// The entire diagram updates immediately
```

For React apps, pass CSS variable references instead of hex values:

```typescript
const svg = renderMermaidSVG(diagram, {
  bg: 'var(--background)',
  fg: 'var(--foreground)',
  accent: 'var(--accent)',
  transparent: true,
})
// Theme switches apply automatically via CSS cascade — no re-render needed
```

## Built-in Themes

15 carefully curated themes ship out of the box:

| Theme               | Type  | Background | Accent    |
| ------------------- | ----- | ---------- | --------- |
| `zinc-light`        | Light | `#FFFFFF`  | Derived   |
| `zinc-dark`         | Dark  | `#18181B`  | Derived   |
| `tokyo-night`       | Dark  | `#1a1b26`  | `#7aa2f7` |
| `tokyo-night-storm` | Dark  | `#24283b`  | `#7aa2f7` |
| `tokyo-night-light` | Light | `#d5d6db`  | `#34548a` |
| `catppuccin-mocha`  | Dark  | `#1e1e2e`  | `#cba6f7` |
| `catppuccin-latte`  | Light | `#eff1f5`  | `#8839ef` |
| `nord`              | Dark  | `#2e3440`  | `#88c0d0` |
| `nord-light`        | Light | `#eceff4`  | `#5e81ac` |
| `dracula`           | Dark  | `#282a36`  | `#bd93f9` |
| `github-light`      | Light | `#ffffff`  | `#0969da` |
| `github-dark`       | Dark  | `#0d1117`  | `#4493f8` |
| `solarized-light`   | Light | `#fdf6e3`  | `#268bd2` |
| `solarized-dark`    | Dark  | `#002b36`  | `#268bd2` |
| `one-dark`          | Dark  | `#282c34`  | `#c678dd` |

```typescript
import { renderMermaidSVG, THEMES } from 'zombie-mermaid'

const svg = renderMermaidSVG(diagram, THEMES['tokyo-night'])
```

## Adding Your Own Theme

Creating a theme is trivial. At minimum, just provide `bg` and `fg`:

```typescript
const myTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
}

const svg = renderMermaidSVG(diagram, myTheme)
```

Want richer colors? Add any of the optional enrichments:

```typescript
const myRichTheme = {
  bg: '#0f0f0f',
  fg: '#e0e0e0',
  accent: '#ff6b6b', // Pop of color for arrows
  muted: '#666666', // Subdued labels
}
```

## Full Shiki Compatibility

Use **any VS Code theme** directly via Shiki integration. This gives you access to hundreds of community themes:

```typescript
import { getSingletonHighlighter } from 'shiki'
import { renderMermaidSVG, fromShikiTheme } from 'zombie-mermaid'

// Load any theme from Shiki's registry
const highlighter = await getSingletonHighlighter({
  themes: ['vitesse-dark', 'rose-pine', 'material-theme-darker'],
})

// Extract diagram colors from the theme
const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))

const svg = renderMermaidSVG(diagram, colors)
```

The `fromShikiTheme()` function intelligently maps VS Code editor colors to diagram roles:

| Editor Color                  | Diagram Role |
| ------------------------------ | ------------ |
| `editor.background`           | `bg`         |
| `editor.foreground`           | `fg`         |
| `editorLineNumber.foreground` | `line`       |
| `focusBorder` / keyword token | `accent`     |
| comment token                 | `muted`      |
| `editor.selectionBackground`  | `surface`    |
| `editorWidget.border`         | `border`     |
