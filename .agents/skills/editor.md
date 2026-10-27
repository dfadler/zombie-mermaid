---
name: zombie-mermaid-editor
description: >-
  Architecture, patterns, and change guide for the zombie-mermaid live editor.
  Use when modifying packages/site/ssr/editor-routes.ts, adding Config options, changing the UI, adding
  export formats, wiring new diagram options, restyling the editor page or its buttons, debugging the
  editor page, or deciding which source file to edit instead of the generated site/editor.html.
---

# zombie-mermaid — Live Editor

## Key files

The editor's CSS/JS source lives under `editor/` as modular partials that `packages/site/ssr/editor-routes.ts` concatenates in a fixed order; its markup lives in React components under `demo/components/`. The site build (`vite.site.config.ts`) bundles the lot into one self-contained HTML file. Edit the partials/components, not `editor-routes.ts`, for UI/CSS/JS changes.

| File                                                                      | Role                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/site/ssr/editor-routes.ts`                                      | Route — reads the `editor/` partials below, receives the `src/browser.ts` bundle, renders `editor.html`                                                                                                                 |
| `editor/css/*.css`                                                        | Modular stylesheets, concatenated in the order listed in `CSS_ORDER` (packages/site/ssr/editor-routes.ts)                                                                                                               |
| `editor/js/*.js`                                                          | Modular client-side JS, bundled from `editor/js/index.ts` (`editor-app` client environment in vite.site.config.ts)                                                                                                      |
| `demo/components/editor-topbar.tsx` / `demo/components/editor-panels.tsx` | The page's markup, as React components: the topbar, the left panel (source editor + Config panel), and the right panel (preview). Composed by `demo/components/editor-page.tsx`. Replaced `editor/html/*.html` in #589. |
| `__tests__/dom/`                                                          | Vitest tests for the editor modules (jsdom environment) — see `editor-config.test.ts`, `editor-helpers.test.ts`, etc.                                                                                                   |
| `site/editor.html`                                                        | Generated output — never edit directly                                                                                                                                                                                  |
| `vite.config.ts`                                                          | Dev server (Vite); rebuilds the whole site into `.site-dev/` on change and serves it (`/` → showcase, `/editor` → editor)                                                                                               |
| `src/browser.ts`                                                          | Bundles the renderer for the browser as `window.__mermaid`                                                                                                                                                              |
| `packages/core/src/types.ts`                                              | `RenderOptions` — all supported render options                                                                                                                                                                          |
| `packages/core/src/theme.ts`                                              | `THEMES`, `buildStyleBlock`, `svgOpenTag` — CSS variable system                                                                                                                                                         |
| `packages/svg-renderer/src/styles.ts`                                     | `STROKE_WIDTHS`, `FONT_SIZES` — hardcoded constants                                                                                                                                                                     |

Note: the live editor does **not** currently have a sample-preset picker (no `SAMPLES` array). `samples/samples-data.ts` only feeds the separate showcase page (`packages/site/ssr/home-routes.ts` → `index.html`, served at `/` by `vite.config.ts`).

## Build cycle

```
vite.site.config.ts + packages/site/ssr/editor-routes.ts
  ──client env build──►      src/browser.ts bundle (inline JS)
  ──CSS_ORDER──►             editor/css/*.css concatenated
  ──client env build──►      editor/js/index.ts bundled
  ──renderToStaticMarkup──►  demo/components/editor-page.tsx (JSX markup)
  ──►                        site/editor.html  (self-contained, ~1.7 MB)
```

Run manually:

```bash
pnpm run build:site   # builds the whole site into site/
pnpm run dev          # watches src/ + editor/ + demo/ + packages/site/, rebuilds and live-reloads
```

**Always rebuild after editing anything under `editor/` or `packages/site/ssr/`.** The HTML file is the deployed artifact.

---

## Architecture overview

`packages/site/ssr/editor-routes.ts` is one route of the site's SSR prerender:

1. The site build bundles `src/browser.ts` and `editor/js/index.ts` → inline JS strings
2. The route reads and concatenates the CSS partials under `editor/`
3. It renders `EditorPage` (React) to a full HTML document
4. The prerender step writes `editor.html`

The generated page has **no runtime build step** — everything (renderer, UI logic, CSS) is inlined into one file — but the _source_ is modular; don't edit `editor-routes.ts` to change UI/logic, edit the relevant file under `editor/`.

### State model (in the client JS)

```js
state = {
  theme: '', // active diagram theme key ('' = Default)
  zoom: 1, // current preview zoom level
  config: {}, // active RenderOptions overrides (from Config panel)
}

cfgColors = { bg, fg, accent, line, muted, surface } // color overrides
cfgFont = '' // font name (bare, e.g. 'Inter')
cfgPadding = 24 // padding px
cfgEdgeStroke = 1 // edge line stroke width
cfgNodeStroke = 1 // node border stroke width
```

### Render pipeline

```
editor input
  → scheduleRender(debounce ms)
    → doRender()
      → buildOptions()        // merges theme (base) + config (overrides)
      → renderMermaid(source, opts)   // window.__mermaid.renderMermaidSVGAsync
      → previewInner.innerHTML = svg
      → applyStrokeOverrides(svgEl)   // injects <style> for stroke widths
      → applyZoom(state.zoom)         // sets SVG width/height from viewBox × zoom
```

**Important**: `buildOptions()` layers options as `Object.assign(themeBase, state.config)` — config always wins over theme.

---

## How to add a Config option

### Case A: RenderOptions already supports it (colors, font, padding)

1. Add UI in the relevant `config-section` in `demo/components/editor-panels.tsx`
2. Add a JS state variable in `editor/js/config-panel.js` (e.g. `var cfgFoo = defaultVal`)
3. Update `readConfig()` (also in `config-panel.js`) to include it in `state.config`
4. Wire input events in `config-panel.js`
5. Rebuild with `pnpm run build:site`

### Case B: Post-process SVG (stroke widths, opacity, etc.)

Use CSS injection via `applyStrokeOverrides` pattern — no renderer changes needed:

```js
// After render:
var style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
style.id = '__bm-my-override'
style.textContent = 'rect { opacity: 0.8; }'
svgEl.insertBefore(style, svgEl.firstChild)
```

CSS rules override SVG presentation attributes (lower specificity). No `!important` needed.

Call your override function in:

- `doRender()` — after `previewInner.innerHTML = svg`
- Any slider/input `change` handler directly (instant, no re-render)

### Case C: Requires renderer support

Add to `RenderOptions` in `packages/core/src/types.ts`, thread through `buildColors`/`svgOpenTag` in `packages/core/src/theme.ts`, and use via CSS variable in `buildStyleBlock`.

---

## Adding a color field

1. Add to the `cfgColors` object in `editor/js/config-panel.js`: `cfgColors.myColor = ''`
2. Add a `THEME_COLOR_MAP` entry (same file) if the theme has a matching property
3. Add a `<ColorField>` in the Colors section of `demo/components/editor-panels.tsx`:

```tsx
<ColorField label="My Color" cfg="myColor" />
```

4. Update `readConfig()`: `if (cfgColors.myColor) cfg.myColor = cfgColors.myColor`
5. Ensure `refreshAllColorUIs()` covers it (it uses `Object.keys(cfgColors)` so automatic)

---

## Adding a slider (Layout section)

Markup goes in `demo/components/editor-panels.tsx` (a `<PaddingField>`), JS in `editor/js/config-panel.js`.

```tsx
<PaddingField label="My Setting" id="cfg-my-val" min="0" max="100" value="10" />
```

(`<PaddingField>` renders both the number input and its slider, deriving the
slider's id as `<id>-slider`.)

```js
var cfgMyVal = 10
var myNum = document.getElementById('cfg-my-val')
var mySlider = document.getElementById('cfg-my-val-slider')

function setMyVal(v) {
  v = Math.max(0, Math.min(100, parseFloat(v) || 10))
  cfgMyVal = v
  myNum.value = v
  mySlider.value = v
  // apply effect...
}
myNum.addEventListener('input', function () {
  setMyVal(myNum.value)
})
mySlider.addEventListener('input', function () {
  setMyVal(mySlider.value)
})
```

---

## Sample presets

The live editor currently has **no** built-in sample-preset picker (no `SAMPLES` array to edit). Presets by diagram category only exist on the separate showcase page — add/edit entries in `samples/samples-data.ts`, which feeds `packages/site/index.ts` → `index.html` (served at `/` by `vite.config.ts`), not the editor.

---

## Zoom system

Zoom sets the SVG's **actual `width`/`height`** attributes (not CSS `transform: scale`), so the scroll container expands correctly.

```js
function applyZoom(z) {
  state.zoom = clamp(z, 0.1, 8)
  var nat = getSvgNaturalSize(svgEl) // reads viewBox
  svgEl.style.width = nat.w * z + 'px'
  svgEl.style.height = nat.h * z + 'px'
}
```

Always call `applyZoom(state.zoom)` after inserting a new SVG. Zoom is preserved across re-renders.

---

## Theme ↔ dark mode sync

```
applyColorMode(dark)
  → sets :root.light / removes it (editor UI)
  → if diagramThemeIsAuto: sets state.theme = 'zinc-dark' or ''
  → refreshAllColorUIs()
  → scheduleRender(0)
```

`diagramThemeIsAuto = false` once the user manually picks a theme from the dropdown — their choice is then preserved across dark/light toggles.

---

## CSS variable system (diagram SVG)

The renderer injects a `<style>` block into every SVG with derived vars:

```
--bg, --fg  →  user-provided or defaults
--line, --accent, --muted, --surface, --border  →  optional overrides
--_line, --_arrow, --_node-fill, --_node-stroke  →  internal derived (color-mix)
```

Config overrides work by setting `--bg`, `--fg` etc. on the SVG's inline `style` attribute via `svgOpenTag()`. Theme colors are the base; config values override them in `buildOptions()`.

---

## URL sharing

Source + theme are encoded in the URL hash:

```js
// Encode
btoa(unescape(encodeURIComponent(JSON.stringify({ source, theme }))))

// Decode
JSON.parse(decodeURIComponent(escape(atob(hash))))
```

`updateHash()` is called after every successful render and on Copy URL.

---

## Export formats

| Action     | Implementation                                                        |
| ---------- | --------------------------------------------------------------------- |
| Save PNG   | SVG → `<img>` → `<canvas>` → `toBlob('image/png')` → download         |
| Save SVG   | `XMLSerializer.serializeToString(svgEl)` → Blob → download            |
| Copy Image | Same as PNG but `navigator.clipboard.write([new ClipboardItem(...)])` |
| Copy URL   | `updateHash()` then `navigator.clipboard.writeText(location.href)`    |

Scale (1x/2x/4x) multiplies canvas dimensions for PNG export.

---

## Common pitfalls

- **Never edit `editor.html` directly** — it's overwritten on every build
- **Avoid `\'` inside template literals** — use DOM API (`createElement`, `.textContent`) instead of `innerHTML` with quotes
- **Stroke overrides via CSS injection must re-run after every render** — the SVG is replaced in `doRender()`
- **`transform: scale()` breaks scrolling** — always use explicit `width`/`height` for zoom
- **Font option is the bare name** (`Inter`, not `"Inter", sans-serif`) — the renderer wraps it internally
