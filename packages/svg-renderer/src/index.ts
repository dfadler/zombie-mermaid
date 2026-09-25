// ============================================================================
// @zombie-mermaid/svg-renderer — SVG emission and ELK-backed layout
//
// Every file re-exported below was grep-verified (zombie-mermaid#625,
// umbrella #620) as unreachable from `src/ascii/index.ts` except through
// the SVG-side modules the umbrella still owns — so nothing here can put
// `elkjs` on the ASCII renderer's dependency path once #623 extracts it.
//
// This package depends on `@zombie-mermaid/core` and, since #624, on
// `@zombie-mermaid/mermaid-parser` too — an ordinary, acyclic dependency
// (both `svg-renderer` and the future `ascii-renderer` depend on
// `mermaid-parser` directly, per the scoping doc's finding 2), not a cycle:
// every per-type `layout.ts`/`renderer.ts` below needs the positioned-
// diagram types `mermaid-parser`'s `types.ts` halves own, and
// `class/layout.ts` needs `formatClassMember` from `mermaid-parser`'s
// `class/format.ts`. It deliberately does NOT re-export the internal
// `layout-engine/` modules the umbrella never imports
// (`constants.ts` — whose `DEFAULTS` would collide with `core`'s theme
// `DEFAULTS` anyway — plus `edge-bundling.ts`, `from-elk.ts`,
// `layer-alignment.ts` and `to-elk.ts`): they are `layoutGraphSync()`'s
// implementation, not its API. `elk-graph-builder.ts` is the exception:
// `class/layout.ts` and `er/layout.ts` (moved into this package under
// #624) call its primitives directly (zombie-mermaid#616), so it is part
// of the public API alongside `elk-adapter-utils.ts`.
//
// `layout.ts` used to be a thin re-export of `layoutGraphSync` from
// `layout-engine.ts`; it was folded into `layout-engine.ts` directly
// (#1109), so `layoutGraphSync` now comes from the one star-export below.
//
// `class/`, `er/`, `sequence/`, `xychart/` hold each diagram type's
// renderer half (`layout.ts` + `renderer.ts`) — the other half
// (`parser.ts`/`types.ts`, plus `class/format.ts`, `sequence/box-color.ts`,
// `sequence/activation-check.ts`, `xychart/colors.ts`) moved to
// `@zombie-mermaid/mermaid-parser` under the same issue (#624), per the
// scoping doc's finding 1: each per-type directory used to mix both halves
// in one place, and the split point already existed at the file level.
//
// `renderMermaidSVG` (below) is the single "Mermaid text in, SVG out" front
// door — moved here from the umbrella's `src/index.ts` under issue #1111,
// for parity with `@zombie-mermaid/ascii-renderer`'s `renderMermaidASCII`.
// `./registry.ts` (not re-exported — same as ascii-renderer's own
// `registry.ts` — it's this front door's internal dispatch table, not part
// of the public API) drives per-diagram-type dispatch; see that file's
// header for why it's a separate module from the ASCII side's table.
// ============================================================================

export * from './edge-curves.ts'
export * from './elk-instance.ts'
export * from './layout-engine.ts'
export * from './layout-engine/elk-adapter-utils.ts'
export * from './layout-engine/elk-graph-builder.ts'
export * from './renderer.ts'
export * from './resolve-colors.ts'
export * from './shape-clipping.ts'
export * from './styles.ts'

export * from './class/layout.ts'
export * from './class/renderer.ts'
export * from './er/layout.ts'
export * from './er/renderer.ts'
export * from './sequence/layout.ts'
export * from './sequence/renderer.ts'
export * from './xychart/layout.ts'
export * from './xychart/renderer.ts'

import { decodeXML } from 'entities'
import type {
  RenderOptions,
  DiagramColors,
  SvgEmitOptions,
  DiagramType,
} from '@zombie-mermaid/core'
import {
  DEFAULTS,
  themeStyleDeclarations,
  isMonospaceFont,
  setMonospaceMetrics,
  detectDiagramType,
  splitStatements,
} from '@zombie-mermaid/core'
import { resolveCssColors } from './resolve-colors.ts'
import { resolveFontSizes } from './styles.ts'
import { diagramRegistry } from './registry.ts'
import type { SvgRenderContext } from './registry.ts'

/**
 * Build a DiagramColors object from render options.
 * Uses DEFAULTS for bg/fg when not provided, and passes through
 * optional enrichment colors (line, accent, muted, surface, border).
 */
function buildColors(options: RenderOptions): DiagramColors {
  return {
    bg: options.bg ?? DEFAULTS.bg,
    fg: options.fg ?? DEFAULTS.fg,
    line: options.line,
    accent: options.accent,
    muted: options.muted,
    surface: options.surface,
    border: options.border,
  }
}

/**
 * The exact CSS declaration list the root `<svg style="…">` attribute would
 * carry for these options — `--bg`, `--fg`, whichever enrichment colours
 * were given, and (unless `transparent`) `background: var(--bg)`.
 *
 * For hosts with a strict `Content-Security-Policy`: a `style=` attribute
 * can't be nonced, so a `style-src` without `'unsafe-inline'` drops it and
 * the diagram loses its colours. Render with `styleAttribute: false` and
 * put this string in your own stylesheet on the SVG (or any ancestor —
 * custom properties inherit) instead. Pass the same options object to both
 * calls so the declarations match what the render expects. See
 * `RenderOptions.styleAttribute` / `RenderOptions.nonce` and issue #216.
 *
 * Built by the same function that fills the attribute in normal renders,
 * so there is one variable list to keep in sync. The string is compact
 * (`--bg:#fff;--fg:#000;background:var(--bg)`) — valid inside any rule
 * block — and the colour values are yours, unescaped, exactly as the
 * attribute has always carried them.
 *
 * @example
 * ```ts
 * const opts = { bg: '#1a1b26', fg: '#a9b1d6', nonce, styleAttribute: false }
 * const svg = renderMermaidSVG('graph TD\n  A --> B', opts)
 * const css = `.diagram svg { ${themeCssVariables(opts)} }`
 * ```
 */
export function themeCssVariables(options: RenderOptions = {}): string {
  return themeStyleDeclarations(buildColors(options), options.transparent)
}

/**
 * Resolve the effective strict-CSP emission controls from the public
 * options. Kept as one object so every renderer takes it as a single
 * trailing parameter — see `SvgEmitOptions` in packages/core/src/theme.ts.
 */
function resolveSvgEmit(options: RenderOptions): SvgEmitOptions {
  return {
    nonce: options.nonce,
    styleAttribute: options.styleAttribute,
  }
}

// Interactivity-derived render gates — whether xychart hover tooltips
// render, whether flowchart/state edge animation (`e1@{ animate: true }`)
// plays, and whether `click`-based links/`<title>` tooltips render — all
// now live next to their diagram type's registry entry in ./registry.ts
// (`resolveAnimationEnabled`/`resolveLinksEnabled` there, duplicated rather
// than imported since that module is imported BY this file — see those
// functions' own comments for why), since every diagram type's SVG dispatch
// is fully handled by the registry lookup below and there is no remaining
// switch case here for them to serve.

/**
 * Render Mermaid diagram text to an SVG string — synchronously.
 *
 * Uses elk.bundled.js with a direct FakeWorker bypass (no setTimeout(0) delay).
 * The ELK singleton is created lazily on first use and cached forever.
 *
 * Use this in React components with useMemo() to avoid flash:
 *   const svg = useMemo(() => renderMermaidSVG(code, opts), [code])
 *
 * @param text - Mermaid source text
 * @param options - Rendering options (colors, font, spacing)
 * @returns A self-contained SVG string
 *
 * @example
 * ```ts
 * const svg = renderMermaidSVG('graph TD\n  A --> B')
 *
 * // With theme
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: '#1a1b26', fg: '#a9b1d6'
 * })
 *
 * // With CSS variables (for live theme switching)
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   bg: 'var(--background)', fg: 'var(--foreground)', transparent: true
 * })
 *
 * // With the original source stamped onto the root <svg> as data-src —
 * // handy for a "copy source" button or an "open in Mermaid Live" link
 * // without re-attaching it via string surgery on the output.
 * const svg = renderMermaidSVG('graph TD\n  A --> B', { embedSource: true })
 *
 * // With an accessible name — role="img" + aria-labelledby pointing at a
 * // <title> child, so assistive tech announces the diagram instead of
 * // reading every node label individually (see issue #215).
 * const svg = renderMermaidSVG('graph TD\n  A --> B', {
 *   title: 'Flowchart: Build → Test → Ship'
 * })
 *
 * // Decorative diagram — already described in surrounding prose, so it's
 * // hidden from assistive tech (aria-hidden="true") instead of named.
 * const svg = renderMermaidSVG('graph TD\n  A --> B', { decorative: true })
 * ```
 */
export function renderMermaidSVG(
  text: string,
  options: RenderOptions = {},
): string {
  const svg = renderMermaidSVGRaw(text, options)
  return options.resolveColors
    ? resolveCssColors(svg, buildColors(options))
    : svg
}

/** The renderer proper — `renderMermaidSVG` minus the optional `resolveColors` post-pass. */
function renderMermaidSVGRaw(text: string, options: RenderOptions): string {
  // Decode XML entities that may leak from markdown parsers (e.g. rehype-raw).
  // Without this, escapeXml() double-encodes them: &lt; → &amp;lt; → literal "&lt;" in SVG.
  // `text` itself is left untouched so `embedSource` below stamps the exact
  // string the caller passed in, not this entity-decoded copy used
  // internally for parsing.
  const decoded = decodeXML(text)

  const colors = buildColors(options)
  const font = options.font ?? 'Inter'
  // Box sizing depends on the metrics model, so pick it before any layout runs.
  setMonospaceMetrics(isMonospaceFont(font))
  const transparent = options.transparent ?? false
  const fontSizes = resolveFontSizes(options.fontSizes)
  const diagramType: DiagramType = detectDiagramType(decoded)
  const embedSource = options.embedSource ? text : undefined
  const title = options.title
  const decorative = options.decorative
  const emit = resolveSvgEmit(options)

  const lines = splitStatements(decoded)

  // Registry dispatch (see ./registry.ts): every diagram type, including
  // 'flowchart' (and the 'state' pipeline it shares), is registered there.
  // `parse` takes both `lines` (what every already-registered type's parser
  // wants) and `decoded` (the raw text flowchart/state's parser needs
  // instead — see the `parse` doc comment on `DiagramModule` in
  // ./registry.ts).
  const registered = diagramRegistry[diagramType]
  const diagram = registered.parse(lines, decoded)
  const positioned = registered.layoutForSvg(diagram, options)
  const ctx: SvgRenderContext = {
    colors,
    font,
    transparent,
    fontSizes,
    embedSource,
    title,
    decorative,
    emit,
  }
  return registered.renderSvg(positioned, ctx, options)
}

/**
 * Render Mermaid diagram text to an SVG string — async.
 *
 * Same result as renderMermaidSVG() but returns a Promise.
 * Useful in async contexts (server handlers, data loaders, etc.)
 */
export async function renderMermaidSVGAsync(
  text: string,
  options: RenderOptions = {},
): Promise<string> {
  return renderMermaidSVG(text, options)
}

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

/** @deprecated Use `renderMermaidSVG` */
export const renderMermaidSync = renderMermaidSVG

/** @deprecated Use `renderMermaidSVGAsync` */
export const renderMermaid = renderMermaidSVGAsync
