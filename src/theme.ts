// ============================================================================
// Theme system — CSS custom property-based theming for mermaid SVG diagrams.
//
// Architecture:
//   - Two required variables: --bg (background) and --fg (foreground)
//   - Five optional enrichment variables: --line, --accent, --muted, --surface, --border
//   - Unset optionals fall back to color-mix() derivations from bg + fg
//   - All derived values computed in a <style> block inside the SVG
//
// This means the SVG is a function of its CSS variables. The caller provides
// colors, and the SVG adapts. No light/dark mode detection needed.
// ============================================================================

import { escapeXml, escapeAttr } from './multiline-utils.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * How the renderers emit their two inline-style surfaces — the `<style>`
 * element(s) and the root `<svg style="--bg: …">` attribute. Both exist so a
 * host page with a strict `Content-Security-Policy` (`style-src` without
 * `'unsafe-inline'`) can still render diagrams with their colours intact;
 * see `RenderOptions.nonce` / `RenderOptions.styleAttribute` in src/types.ts
 * and GitHub issue #216. Threaded as one object through every diagram
 * renderer so the two options can't drift apart per diagram type.
 */
export interface SvgEmitOptions {
  /** Value for a `nonce` attribute on every emitted `<style>` element. */
  nonce?: string
  /** Emit the root `style="--bg: …"` attribute. Default: true. */
  styleAttribute?: boolean
}

/**
 * Diagram color configuration.
 *
 * Required: bg + fg give you a clean mono diagram.
 * Optional: line, accent, muted, surface, border bring in richer color
 * from Shiki themes or custom palettes. Each falls back to a color-mix()
 * derivation from bg + fg if not set.
 */
export interface DiagramColors {
  /** Background color → CSS variable --bg */
  bg: string
  /** Foreground / primary text color → CSS variable --fg */
  fg: string

  // -- Optional enrichment (each falls back to color-mix from bg+fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights, special nodes → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string
}

// ============================================================================
// Defaults
// ============================================================================

/** Default bg/fg when no colors are provided (zinc light) */
export const DEFAULTS: Readonly<{ bg: string; fg: string }> = {
  bg: '#FFFFFF',
  fg: '#27272A',
} as const

// ============================================================================
// color-mix() weights for derived CSS variables
//
// When an optional enrichment variable is NOT set, we compute the derived
// value by mixing --fg into --bg at these percentages. This produces a
// coherent mono hierarchy on any bg/fg combination.
// ============================================================================

export const MIX = {
  /** Primary text: near-full fg */
  text: 100, // just use --fg directly
  /** Secondary text (group headers): fg mixed at 60% */
  textSec: 60,
  /** Muted text (edge labels, notes): fg mixed at 40% */
  textMuted: 40,
  /** Faint text (de-emphasized): fg mixed at 25% */
  textFaint: 25,
  /** Edge/connector lines: fg mixed at 50% for clear visibility */
  line: 50,
  /** Arrow head fill: fg mixed at 85% for clear visibility */
  arrow: 85,
  /** Node fill tint: fg mixed at 3% */
  nodeFill: 3,
  /** Node/group stroke: fg mixed at 20% */
  nodeStroke: 20,
  /** Group header band tint: fg mixed at 5% */
  groupHeader: 5,
  /** Inner divider strokes: fg mixed at 12% */
  innerStroke: 12,
  /** Key badge background opacity (ER diagrams) */
  keyBadge: 10,
} as const

// ============================================================================
// Well-known theme palettes
//
// Curated bg/fg pairs (+ optional enrichment) for popular editor themes.
// Users can also extract from Shiki theme objects via fromShikiTheme().
// ============================================================================

export const THEMES: Record<string, DiagramColors> = {
  'zinc-light': {
    bg: '#FFFFFF',
    fg: '#27272A',
  },
  'zinc-dark': {
    bg: '#18181B',
    fg: '#FAFAFA',
  },
  'tokyo-night': {
    bg: '#1a1b26',
    fg: '#a9b1d6',
    line: '#3d59a1',
    accent: '#7aa2f7',
    muted: '#565f89',
  },
  'tokyo-night-storm': {
    bg: '#24283b',
    fg: '#a9b1d6',
    line: '#3d59a1',
    accent: '#7aa2f7',
    muted: '#565f89',
  },
  'tokyo-night-light': {
    bg: '#d5d6db',
    fg: '#343b58',
    line: '#34548a',
    accent: '#34548a',
    muted: '#9699a3',
  },
  'catppuccin-mocha': {
    bg: '#1e1e2e',
    fg: '#cdd6f4',
    line: '#585b70',
    accent: '#cba6f7',
    muted: '#6c7086',
  },
  'catppuccin-latte': {
    bg: '#eff1f5',
    fg: '#4c4f69',
    line: '#9ca0b0',
    accent: '#8839ef',
    muted: '#9ca0b0',
  },
  nord: {
    bg: '#2e3440',
    fg: '#d8dee9',
    line: '#4c566a',
    accent: '#88c0d0',
    muted: '#616e88',
  },
  'nord-light': {
    bg: '#eceff4',
    fg: '#2e3440',
    line: '#aab1c0',
    accent: '#5e81ac',
    muted: '#7b88a1',
  },
  dracula: {
    bg: '#282a36',
    fg: '#f8f8f2',
    line: '#6272a4',
    accent: '#bd93f9',
    muted: '#6272a4',
  },
  'github-light': {
    bg: '#ffffff',
    fg: '#1f2328',
    line: '#d1d9e0',
    accent: '#0969da',
    muted: '#59636e',
  },
  'github-dark': {
    bg: '#0d1117',
    fg: '#e6edf3',
    line: '#3d444d',
    accent: '#4493f8',
    muted: '#9198a1',
  },
  'solarized-light': {
    bg: '#fdf6e3',
    fg: '#657b83',
    line: '#93a1a1',
    accent: '#268bd2',
    muted: '#93a1a1',
  },
  'solarized-dark': {
    bg: '#002b36',
    fg: '#839496',
    line: '#586e75',
    accent: '#268bd2',
    muted: '#586e75',
  },
  'one-dark': {
    bg: '#282c34',
    fg: '#abb2bf',
    line: '#4b5263',
    accent: '#c678dd',
    muted: '#5c6370',
  },
} as const

export type ThemeName = keyof typeof THEMES

// ============================================================================
// Shiki theme extraction
//
// Extracts DiagramColors from a Shiki ThemeRegistrationResolved object.
// This provides native compatibility with any VS Code / TextMate theme.
// ============================================================================

/**
 * Minimal subset of Shiki's ThemeRegistrationResolved that we need.
 * We don't import from shiki to avoid a hard dependency.
 */
interface ShikiThemeLike {
  type?: string
  colors?: Record<string, string>
  tokenColors?: Array<{
    scope?: string | string[]
    settings?: { foreground?: string }
  }>
}

/**
 * Extract diagram colors from a Shiki theme object.
 * Works with any VS Code / TextMate theme loaded by Shiki.
 *
 * Maps editor UI colors to diagram roles:
 *   editor.background         → bg
 *   editor.foreground         → fg
 *   editorLineNumber.fg       → line (optional)
 *   focusBorder / keyword     → accent (optional)
 *   comment token             → muted (optional)
 *   editor.selectionBackground→ surface (optional)
 *   editorWidget.border       → border (optional)
 *
 * @example
 * ```ts
 * import { getSingletonHighlighter } from 'shiki'
 * import { fromShikiTheme } from 'zombie-mermaid'
 *
 * const hl = await getSingletonHighlighter({ themes: ['tokyo-night'] })
 * const colors = fromShikiTheme(hl.getTheme('tokyo-night'))
 * const svg = renderMermaidSVG(code, colors)
 * ```
 */
export function fromShikiTheme(theme: ShikiThemeLike): DiagramColors {
  const c = theme.colors ?? {}
  const dark = theme.type === 'dark'

  // Helper: find a token color by scope name
  const tokenColor = (scope: string): string | undefined =>
    theme.tokenColors?.find((t) =>
      Array.isArray(t.scope) ? t.scope.includes(scope) : t.scope === scope,
    )?.settings?.foreground

  return {
    bg: c['editor.background'] ?? (dark ? '#1e1e1e' : '#ffffff'),
    fg: c['editor.foreground'] ?? (dark ? '#d4d4d4' : '#333333'),
    line: c['editorLineNumber.foreground'] ?? undefined,
    accent: c['focusBorder'] ?? tokenColor('keyword') ?? undefined,
    muted:
      tokenColor('comment') ?? c['editorLineNumber.foreground'] ?? undefined,
    surface: c['editor.selectionBackground'] ?? undefined,
    border: c['editorWidget.border'] ?? undefined,
  }
}

// ============================================================================
// SVG style block — the CSS variable derivation system
//
// Generates the <style> content that maps user-facing variables (--bg, --fg,
// --line, etc.) to internal derived variables (--_text, --_line, etc.) using
// color-mix() fallbacks.
// ============================================================================

/**
 * Characters that must never appear in a `font` value once it's embedded in
 * the generated `<style>` block — whether it's treated as a CSS `var()`
 * reference or as a literal font name. Angle brackets would let the value
 * break out of the `<style>...</style>` element (e.g. a literal `</style>`
 * or an injected `<script>`); semicolons/braces would let it terminate the
 * current CSS declaration/rule and inject new ones.
 */
const UNSAFE_FONT_CHARS_RE = /[<>{};]/

/**
 * Detect a syntactically well-formed CSS `var()` reference, e.g.
 * `var(--font-family-body)` or `var(--font, 'Fallback Font')` (a `var()`
 * with a quoted fallback argument). Requires balanced parens and rejects
 * any of `UNSAFE_FONT_CHARS_RE`.
 *
 * `font.startsWith('var(')` alone isn't enough: a caller could pass
 * something that merely starts with `var(` but isn't actually one (e.g.
 * `var(--x); } .evil{...}`). Anything that fails this stricter check is
 * treated as an untrusted/malformed value and falls back to being quoted
 * as a literal font name below — which neutralizes it, since a quoted
 * string isn't parsed as a `var()` call by CSS.
 */
function isSafeCssVarReference(font: string): boolean {
  const trimmed = font.trim()
  if (!trimmed.startsWith('var(') || !trimmed.endsWith(')')) return false
  if (UNSAFE_FONT_CHARS_RE.test(trimmed)) return false
  let depth = 0
  for (const ch of trimmed) {
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

/**
 * CSS generic font-family keywords. These are resolved by the browser/user
 * agent to a locally available font and are never real font names a Google
 * Fonts `@import` could fetch.
 */
const GENERIC_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
])

/**
 * Detect a `font` value that names a font *stack* (comma-separated list,
 * e.g. `"ui-sans-serif, system-ui, sans-serif"`) or a single CSS generic
 * family keyword (e.g. `"system-ui"`) rather than a single concrete font
 * name. Neither is something a Google Fonts `@import` could ever
 * successfully fetch: a stack has no single `family=` value to request, and
 * a generic keyword is resolved locally by the browser, not hosted by
 * Google Fonts. Skipping the `@import` for these avoids baking a dead,
 * always-404 request into the SVG (see #223).
 */
function isFontStackOrGenericFamily(font: string): boolean {
  const trimmed = font.trim()
  if (trimmed.includes(',')) return true
  return GENERIC_FONT_FAMILIES.has(trimmed.toLowerCase())
}

/**
 * The opening `<style>` tag every renderer uses — with a `nonce` attribute
 * when the caller supplied one (see `RenderOptions.nonce`, #216).
 *
 * All `<style>` emission points go through this one function so a nonce
 * can't be missed on one of them: under a nonce-based CSP a single
 * un-nonced `<style>` is silently dropped by the browser, which for the
 * theme block means an unstyled diagram with no console hint as to why.
 *
 * An empty/whitespace-only nonce is treated as unset — `nonce=""` would
 * authorise nothing and only mislead a reader into thinking it did.
 * The value is attribute-escaped; a real nonce is base64 and never needs
 * escaping, but the option is a plain string and this keeps a stray `"`
 * from breaking out of the attribute.
 */
export function styleOpenTag(nonce?: string): string {
  if (nonce === undefined || nonce.trim() === '') return '<style>'
  return `<style nonce="${escapeAttr(nonce)}">`
}

/**
 * Build the CSS variable derivation rules for the SVG <style> block.
 *
 * When an optional variable (--line, --accent, etc.) is set on the SVG or
 * a parent element, it's used directly. When unset, the fallback computes
 * a blended value from --fg and --bg using color-mix().
 *
 * `nonce`, when given, lands on the `<style>` element as a `nonce`
 * attribute — see `styleOpenTag()`.
 *
 * `font` is user-supplied input. When it's a CSS `var(...)` reference (e.g.
 * `var(--font-family-body)`, letting the SVG inherit a host page's
 * design-system font), the Google Fonts `@import` is skipped — it would
 * otherwise URL-encode the literal `var(...)` string into a `family=` query
 * param and produce a guaranteed no-op request — and the value is emitted
 * unquoted, since a quoted string isn't parsed as a `var()` call by CSS.
 *
 * The `@import` is likewise skipped when `font` is a font *stack* (a
 * comma-separated list, e.g. `"ui-sans-serif, system-ui, sans-serif"`) or a
 * single CSS generic family keyword (e.g. `"system-ui"`) — see
 * `isFontStackOrGenericFamily`. Neither names a single concrete font that
 * Google Fonts could host, so importing one always produces a dead,
 * always-404 request (#223). This is additive to the `var()` skip above,
 * and only affects the `@import` decision — the `text { font-family: ... }`
 * rule still renders the literal value exactly as it does today.
 *
 * Any other value is treated as a literal font name: sanitized and quoted
 * exactly as before.
 */
export function buildStyleBlock(
  font: string,
  hasMonoFont: boolean,
  nonce?: string,
): string {
  const isVarReference = isSafeCssVarReference(font)
  // Literal font names are sanitized before quoting (strip characters that
  // could break out of the CSS string or the <style> block). A validated
  // var() reference is passed through as-is so `var(--x, 'Fallback')` keeps
  // its own internal quotes intact.
  const safeFont = isVarReference ? font.trim() : font.replace(/[<>{};'"]/g, '')
  const skipImport = isVarReference || isFontStackOrGenericFamily(font)

  const fontImports = [
    ...(skipImport
      ? []
      : [
          `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeFont)}:wght@400;500;600;700&amp;display=swap');`,
        ]),
    ...(hasMonoFont
      ? [
          `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&amp;display=swap');`,
        ]
      : []),
  ]

  // Derived CSS variables: use override if set, else mix from bg+fg.
  // The --_ prefix signals "private/derived" — not meant for external override.
  const derivedVars = `
    /* Derived from --bg and --fg (overridable via --line, --accent, etc.) */
    --_text:          var(--fg);
    --_text-sec:      var(--muted, color-mix(in srgb, var(--fg) ${MIX.textSec}%, var(--bg)));
    --_text-muted:    var(--muted, color-mix(in srgb, var(--fg) ${MIX.textMuted}%, var(--bg)));
    --_text-faint:    color-mix(in srgb, var(--fg) ${MIX.textFaint}%, var(--bg));
    --_line:          var(--line, color-mix(in srgb, var(--fg) ${MIX.line}%, var(--bg)));
    --_arrow:         var(--accent, color-mix(in srgb, var(--fg) ${MIX.arrow}%, var(--bg)));
    --_node-fill:     var(--surface, color-mix(in srgb, var(--fg) ${MIX.nodeFill}%, var(--bg)));
    --_node-stroke:   var(--border, color-mix(in srgb, var(--fg) ${MIX.nodeStroke}%, var(--bg)));
    --_group-fill:    var(--bg);
    --_group-hdr:     color-mix(in srgb, var(--fg) ${MIX.groupHeader}%, var(--bg));
    --_inner-stroke:  color-mix(in srgb, var(--fg) ${MIX.innerStroke}%, var(--bg));
    --_key-badge:     color-mix(in srgb, var(--fg) ${MIX.keyBadge}%, var(--bg));`

  return [
    styleOpenTag(nonce),
    ...(fontImports.length > 0 ? [`  ${fontImports.join('\n  ')}`] : []),
    `  text { font-family: ${isVarReference ? safeFont : `'${safeFont}'`}, system-ui, sans-serif; }`,
    ...(hasMonoFont
      ? [
          `  .mono { font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, monospace; }`,
        ]
      : []),
    `  svg {${derivedVars}`,
    `  }`,
    '</style>',
  ].join('\n')
}

// ============================================================================
// Fill → text color contrast
//
// When a node has a custom `fill` (from classDef/style) but no explicit
// `color`, defaulting text to the ambient theme foreground can be unreadable
// (e.g. white text on a light pastel fill in dark mode). If the fill is a
// concrete, resolvable color (hex), compute a readable black/white text
// color from its perceptual luminance. Anything else (CSS variable
// references, named colors, malformed values) is left alone — the caller
// falls back to the theme foreground.
// ============================================================================

/** Matches #rgb, #rgba, #rrggbb, #rrggbbaa hex color literals. */
const HEX_COLOR_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Parse a hex color string into 0-255 RGB components.
 * Returns null for anything that isn't a well-formed hex literal (e.g.
 * `var(--foo)`, named CSS colors, or attribute-injection payloads) — the
 * caller should treat those as unresolvable and fall back.
 */
function parseHexColor(value: string): [number, number, number] | null {
  const match = HEX_COLOR_RE.exec(value.trim())
  if (!match) return null
  // HEX_COLOR_RE has exactly one, non-optional capture group, so it's always
  // populated when `match` is non-null — but that's a fact about the regex's
  // construction, not something the type checker can see. Guard explicitly
  // (falling back to "unresolvable", same as a non-match) rather than
  // asserting past it, so a future edit to the pattern can't silently turn
  // this into a runtime `undefined`.
  const captured = match[1]
  if (captured === undefined) return null
  let hex = captured
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

/**
 * Perceptual luminance of an sRGB color on a 0-1 scale (0 = black, 1 =
 * white), using the ITU-R BT.601 luma weights (0.299/0.587/0.114).
 *
 * This is the simple, non-gamma-corrected "perceived brightness" formula
 * (as opposed to the gamma-corrected WCAG relative-luminance formula used
 * for contrast-ratio math). It's the right tool here: we just need a
 * black-vs-white pick, and BT.601 luma crosses black/white legibility at
 * ~0.5 on its own 0-1 scale, so the threshold in getReadableTextColor()
 * lines up directly with the formula instead of needing a separately
 * derived crossover constant. (True WCAG relative luminance would need a
 * ~0.18 threshold, not 0.5, to give the same black/white picks — see
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef.)
 */
function perceptualLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Pick a readable text color for a given fill color.
 *
 * If `fill` is a concrete, resolvable hex color, returns pure black or
 * white depending on the fill's perceptual luminance (threshold 0.5: light
 * fills get dark text, dark fills get light text). If `fill` is undefined
 * or isn't a resolvable color (a `var(...)` reference, a named CSS color,
 * or malformed input), returns `fallback` unchanged so callers don't guess
 * at colors they can't actually evaluate.
 */
export function getReadableTextColor(
  fill: string | undefined,
  fallback: string,
): string {
  if (!fill) return fallback
  const rgb = parseHexColor(fill)
  if (!rgb) return fallback
  const luminance = perceptualLuminance(...rgb)
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

/**
 * Page-unique suffix generator for the root accessible-name `<title>` id.
 *
 * Mirrors `markerSuffix()` in src/renderer.ts, which solves the same
 * "multiple SVGs inlined into one HTML page share a single id namespace"
 * problem for arrow-marker ids — a marker's id is sanitized from its stroke
 * color, since two markers with the same color are meant to share one
 * definition. A title has no such natural per-call input (two diagrams can
 * easily have the same title text and must still get distinct ids), so this
 * increments a module-level counter instead: every `svgOpenTag()` call that
 * renders a title gets a fresh, never-repeated id for the lifetime of the
 * process, which is exactly what's needed for `aria-labelledby` to resolve
 * correctly when several rendered diagrams are concatenated into one page.
 */
let titleIdCounter = 0

function nextTitleId(): string {
  titleIdCounter += 1
  return `zm-title-${titleIdCounter}`
}

/**
 * Test-only: reset the title-id counter so id assertions in tests don't
 * depend on how many titled diagrams earlier tests in the same file rendered.
 * Not part of the public API (not re-exported from src/index.ts).
 */
export function __resetSvgTitleIdCounterForTests(): void {
  titleIdCounter = 0
}

/**
 * The exact CSS declaration list the root `<svg style="…">` attribute
 * carries: the theme custom properties (`--bg`, `--fg`, plus whichever
 * enrichment variables were actually provided — unset ones fall back to the
 * color-mix() derivations in the `<style>` block) and, unless `transparent`,
 * a `background: var(--bg)`.
 *
 * Exposed (via `themeCssVariables()` in src/index.ts) so a host that turns
 * the attribute off with `styleAttribute: false` — because its
 * Content-Security-Policy forbids `style=` attributes, which a nonce can
 * never authorise (#216) — can put the very same declarations in its own
 * stylesheet on a wrapper instead. Single source of truth for the variable
 * list: `svgOpenTag()` and the helper both call this, so the two can't
 * drift.
 *
 * Emitted compactly (`--bg:#fff;--fg:#000;background:var(--bg)`) rather
 * than pretty-printed: it's the same string the attribute has always
 * carried, so default output stays byte-identical. Colour values are the
 * caller's own `RenderOptions` and are not escaped here — same as before.
 */
export function themeStyleDeclarations(
  colors: DiagramColors,
  transparent?: boolean,
): string {
  const vars = [
    `--bg:${colors.bg}`,
    `--fg:${colors.fg}`,
    colors.line ? `--line:${colors.line}` : '',
    colors.accent ? `--accent:${colors.accent}` : '',
    colors.muted ? `--muted:${colors.muted}` : '',
    colors.surface ? `--surface:${colors.surface}` : '',
    colors.border ? `--border:${colors.border}` : '',
  ]
    .filter(Boolean)
    .join(';')

  const bgStyle = transparent ? '' : ';background:var(--bg)'
  return `${vars}${bgStyle}`
}

/**
 * Build the SVG opening tag with CSS variables set as inline styles.
 * Only includes optional variables that are actually provided — unset ones
 * will fall back to the color-mix() derivations in the <style> block.
 *
 * `styleAttribute: false` drops the `style="…"` attribute entirely (the
 * host supplies those declarations from its own stylesheet — see
 * `themeStyleDeclarations()` and `RenderOptions.styleAttribute`, #216).
 * Every other attribute — `xmlns`, `viewBox`, `width`/`height`, the
 * `role`/`aria-*` accessibility attributes, and anything a caller splices
 * on afterwards (`data-src`, `data-xychart-colors`) — is unaffected.
 *
 * Also handles the SVG's accessible name (see `RenderOptions.title` /
 * `RenderOptions.decorative` in src/types.ts, and GitHub issue #215):
 *
 * - `decorative: true` → `aria-hidden="true"` on the root, no `role` or
 *   name. Use for a diagram already described in surrounding prose; `title`
 *   is ignored when this is set.
 * - `title` given (and not decorative) → `role="img"` +
 *   `aria-labelledby="zm-title-N"` on the root, plus a `<title id="zm-title-N">`
 *   as the SVG's first child holding the escaped text. This is the standard
 *   SVG/WAI-ARIA "accessible name via a referenced title element" technique
 *   (see MDN "SVG accessibility" and the WAI-ARIA `img` role: an element
 *   with `role="img"` needs a computed accessible name to be meaningful to
 *   assistive tech; `aria-labelledby` pointing at a `<title>` is the
 *   documented way to supply one for inline SVG).
 * - Neither given → `role="img"` only, no name. This still stops assistive
 *   tech from treating the SVG as a plain group (which announces every
 *   node/edge label individually, out of reading order — the core bug in
 *   #215), without fabricating a name the library can't honestly claim. It
 *   reads the same as an `<img>` with no `alt`: present as a single image,
 *   unlabeled.
 *
 * `hasInteractiveLinks` overrides all of the above (see #239): a `click A
 * "url"` statement renders a real, focusable `<a href>` inside the SVG, and
 * both `role="img"` and `aria-hidden="true"` are unsafe on an ancestor of a
 * focusable element — `role="img"` tells assistive tech to stop descending
 * into children (the link becomes unreachable by screen reader while still
 * Tab-focusable), and `aria-hidden="true"` on a focusable descendant is an
 * explicit WAI-ARIA violation (the link vanishes from the accessibility tree
 * but not from the tab order). When any node has a link, the root gets no
 * `role` at all — `decorative` is silently overridden rather than honored,
 * since aria-hiding a diagram that contains an actionable link is not a safe
 * request to fulfill — but `title`/`aria-labelledby` still apply if given:
 * an accessible name is still valid on an element with no explicit role.
 *
 * The per-node/per-point `<title>` tooltips added by earlier work (nested
 * inside `<g>` elements, with no `id` attribute) are unaffected: they never
 * collide with the root title's generated id, and a root `<title>` alongside
 * unrelated descendant `<title>` elements is valid SVG.
 *
 * @param transparent - If true, omits the background style for transparent SVGs
 * @param title - Accessible name text. Ignored when `decorative` is true
 *                and there are no interactive links (see `hasInteractiveLinks`).
 * @param decorative - Marks the SVG as decorative (`aria-hidden="true"`).
 *                      Overridden when `hasInteractiveLinks` is true.
 * @param hasInteractiveLinks - True if any node has a `click`-based `href`.
 *                              See #239 — forces no root `role` so the link
 *                              stays reachable, regardless of `decorative`.
 * @param styleAttribute - Emit the root `style="…"` attribute. Default true.
 */
export function svgOpenTag(
  width: number,
  height: number,
  colors: DiagramColors,
  transparent?: boolean,
  title?: string,
  decorative?: boolean,
  hasInteractiveLinks?: boolean,
  styleAttribute: boolean = true,
): string {
  const styleAttr = styleAttribute
    ? ` style="${themeStyleDeclarations(colors, transparent)}"`
    : ''

  let a11yAttrs = ''
  let titleEl = ''
  if (hasInteractiveLinks) {
    // No root role: role="img" or aria-hidden would hide a real, focusable
    // <a href> descendant from assistive tech while leaving it Tab-reachable.
    if (title) {
      const id = nextTitleId()
      a11yAttrs = ` aria-labelledby="${id}"`
      titleEl = `\n  <title id="${id}">${escapeXml(title)}</title>`
    }
  } else if (decorative) {
    a11yAttrs = ' aria-hidden="true"'
  } else {
    a11yAttrs = ' role="img"'
    if (title) {
      const id = nextTitleId()
      a11yAttrs += ` aria-labelledby="${id}"`
      titleEl = `\n  <title id="${id}">${escapeXml(title)}</title>`
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}"${a11yAttrs}${styleAttr}>` +
    titleEl
  )
}
