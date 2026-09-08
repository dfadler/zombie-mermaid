// ============================================================================
// zombie-mermaid — public API
//
// Renders Mermaid diagrams to styled SVG strings.
// Framework-agnostic, no DOM required. Pure TypeScript.
//
// Supported diagram types:
//   - Flowcharts (graph TD / flowchart LR)
//   - State diagrams (stateDiagram-v2)
//   - Sequence diagrams (sequenceDiagram)
//   - Class diagrams (classDiagram)
//   - ER diagrams (erDiagram)
//
// Theming uses CSS custom properties (--bg, --fg, + optional enrichment).
// See packages/core/src/theme.ts for the full variable system.
//
// Usage:
//   import { renderMermaidSVG } from 'zombie-mermaid'
//   const svg = renderMermaidSVG('graph TD\n  A --> B')
// ============================================================================

export type {
  RenderOptions,
  MermaidGraph,
  NodeInteraction,
  PositionedGraph,
  Direction,
  CommonRenderOptions,
  FlowchartRenderOptions,
  SequenceRenderOptions,
  ClassRenderOptions,
  ErRenderOptions,
  XyChartRenderOptions,
} from '@zombie-mermaid/core'
export type { DiagramColors, ThemeName } from '@zombie-mermaid/core'
export { fromShikiTheme, THEMES, DEFAULTS } from '@zombie-mermaid/core'
export { parseMermaid } from './parser.ts'
import {
  resolveCssColors,
  layoutGraphSync,
  renderSvg,
  resolveFontSizes,
} from '@zombie-mermaid/svg-renderer'
export { renderMermaidASCII, renderMermaidAscii } from './ascii/index.ts'
export type { AsciiRenderOptions } from './ascii/index.ts'
export { createLayoutCache } from '@zombie-mermaid/svg-renderer'
export type { LayoutCache } from '@zombie-mermaid/svg-renderer'

import { decodeXML } from 'entities'
import { parseMermaid } from './parser.ts'
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
  applyInitConfig,
  withDirectionOverride,
  splitStatements,
} from '@zombie-mermaid/core'

import { parseSequenceDiagram } from './sequence/parser.ts'
import { layoutSequenceDiagram } from './sequence/layout.ts'
import { renderSequenceSvg } from './sequence/renderer.ts'
import { parseClassDiagram } from './class/parser.ts'
import { layoutClassDiagramSync } from './class/layout.ts'
import { renderClassSvg } from './class/renderer.ts'
import { diagramRegistry } from './diagram-registry.ts'
import type { SvgRenderContext } from './diagram-registry.ts'

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

/**
 * Resolve the effective interactivity level, defaulting unset to `'static'`.
 * See `RenderOptions.interactivity` for what each level means.
 */
function resolveInteractivity(
  options: RenderOptions,
): 'none' | 'static' | 'full' {
  return options.interactivity ?? 'static'
}

/**
 * Whether flowchart/state-diagram edge animation (`e1@{ animate: true }`)
 * should render. Gated to `'full'` only — CSS animation is tier-2 *motion*
 * (see docs/decisions/no-script-interactivity.md), so the default
 * (`'static'`, tier 1 + tier 2 minus motion) and `'none'` both render the
 * edge as a still line.
 */
function resolveAnimationEnabled(options: RenderOptions): boolean {
  return resolveInteractivity(options) === 'full'
}

/**
 * Whether flowchart `click`-based links (`<a href>`) and `<title>` tooltips
 * should render. Gated behind `interactivity !== 'none'` — `'none'` is meant
 * for print/rasterized output, where a link is meaningless, so it strips
 * both; `'static'` and `'full'` both keep them.
 */
function resolveLinksEnabled(options: RenderOptions): boolean {
  return resolveInteractivity(options) !== 'none'
}

// Whether xychart hover tooltips should render (`interactivity` wins over
// the deprecated `interactive` boolean when both are set) now lives next to
// the xychart registry entry in src/diagram-registry.ts, since xychart's
// SVG dispatch is fully handled by the registry lookup below — there is no
// remaining switch case here for it to serve.

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

  // Registry lookup first (see src/diagram-registry.ts — issue #533):
  // 'xychart' and 'er' are registered there and handled identically to how
  // their switch cases below used to read, just via the shared adapter
  // shape instead. Anything not registered (currently 'sequence', 'class',
  // 'flowchart') falls through to the switch, unchanged.
  const registered = diagramRegistry[diagramType]
  if (registered) {
    const diagram = registered.parse(lines)
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

  switch (diagramType) {
    case 'sequence': {
      const diagram = parseSequenceDiagram(lines)
      const positioned = layoutSequenceDiagram(diagram, options)
      return renderSequenceSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        embedSource,
        title,
        decorative,
        emit,
      )
    }
    case 'class': {
      const diagram = parseClassDiagram(lines)
      const positioned = layoutClassDiagramSync(diagram, options)
      return renderClassSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        embedSource,
        title,
        decorative,
        resolveLinksEnabled(options),
        emit,
      )
    }
    case 'flowchart':
    default: {
      const parsed = parseMermaid(decoded)
      // A diagram's own `%%{init: ...}%%` supplies defaults; an explicit
      // render option always wins. See packages/core/src/init-directive.ts.
      const effective = parsed.initConfig
        ? applyInitConfig(options, parsed.initConfig)
        : options
      // `direction` replaces the header's (or a state diagram's top-level
      // `direction` line's) direction before layout; nested subgraph /
      // composite-state directions live on the subgraph objects and still
      // apply on top of it. See packages/core/src/direction-override.ts.
      const graph = withDirectionOverride(parsed, effective.direction)
      const positioned = layoutGraphSync(graph, effective)
      return renderSvg(
        positioned,
        colors,
        font,
        transparent,
        fontSizes,
        effective.curve ?? 'linear',
        embedSource,
        resolveAnimationEnabled(options),
        resolveLinksEnabled(options),
        title,
        decorative,
        emit,
      )
    }
  }
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
