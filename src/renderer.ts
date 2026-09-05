import type {
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  PositionedGroup,
  Point,
} from './types.ts'
import type { DiagramColors, SvgEmitOptions } from './theme.ts'
import {
  svgOpenTag,
  buildStyleBlock,
  styleOpenTag,
  getReadableTextColor,
} from './theme.ts'
import type { FontSizes } from './styles.ts'
import {
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
  ARROW_HEAD,
} from './styles.ts'
import { measureMultilineText } from './text-metrics.ts'
import {
  renderMultilineText,
  renderMultilineTextWithBackground,
  escapeXml,
  escapeAttr,
} from './multiline-utils.ts'
import { pointsToPath } from './edge-curves.ts'
import type { CurveStyle } from './init-directive.ts'
import { safeHref } from './click-directive.ts'

// ============================================================================
// SVG renderer — converts a PositionedGraph into an SVG string.
//
// Pure string concatenation, no DOM manipulation.
// Renders back-to-front: groups → edges → arrow heads → edge labels → nodes → node labels.
//
// All colors are referenced via CSS custom properties (var(--_xxx)) defined
// in the <style> block. The caller provides bg/fg (+ optional enrichment
// colors) via DiagramColors, which are set as inline CSS variables on the
// <svg> tag. See src/theme.ts for the full variable system.
//
// Style spec:
// - All corners rx=0 ry=0 (sharp)
// - Stroke widths: outer box 1px, inner box 0.75px, connectors 0.75px
// - Arrow heads: filled triangles, 8px wide × 4.8px tall
// - Dashed edges: stroke-dasharray="4 4"
// - Font: Inter with weight per element type
// ============================================================================

/**
 * Render a positioned graph as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 *                 These are set as CSS custom properties on the <svg> tag.
 *                 All element colors reference derived --_xxx variables.
 * @param transparent - If true, renders with transparent background.
 * @param embedSource - Original diagram source to stamp onto the root `<svg>`
 *                       as `data-src` (from `options.embedSource`). Omitted
 *                       when the option is off.
 * @param animationEnabled - Whether `e1@{ animate: true }` edges actually
 *                            animate (from `options.interactivity === 'full'`,
 *                            see `resolveAnimationEnabled` in src/index.ts).
 *                            Default true — preserves the previously-ungated
 *                            behavior for callers who don't pass it.
 * @param linksEnabled - Whether `click`-based `<a href>` links and `<title>`
 *                       tooltips render (from
 *                       `options.interactivity !== 'none'`, see
 *                       `resolveLinksEnabled` in src/index.ts). Default true
 *                       — preserves the previously-ungated behavior for
 *                       callers who don't pass it.
 * @param title - Accessible name (from `options.title`). See svgOpenTag() in
 *                src/theme.ts.
 * @param decorative - Marks the SVG decorative (from `options.decorative`).
 * @param emit - Strict-CSP controls (from `options.nonce` /
 *               `options.styleAttribute`, see #216): a `nonce` for every
 *               `<style>` element, and whether the root `style="…"`
 *               attribute is emitted at all. Default: no nonce, attribute on.
 */
export function renderSvg(
  graph: PositionedGraph,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  fontSizes: FontSizes = FONT_SIZES,
  curve: CurveStyle = 'linear',
  embedSource?: string,
  animationEnabled: boolean = true,
  linksEnabled: boolean = true,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const parts: string[] = []

  // See #239: a click-based link renders as a focusable <a href> inside the
  // SVG, which role="img"/aria-hidden would hide from assistive tech while
  // leaving it Tab-reachable — svgOpenTag forces no root role in that case.
  // Uses the same safeHref() check renderNode uses to decide whether an <a>
  // is actually emitted — a rejected scheme or control character means no
  // link renders, so it shouldn't affect the SVG's accessibility semantics.
  // Gated by linksEnabled too: `interactivity: 'none'` strips the <a> below,
  // so it shouldn't count toward this decision either.
  const hasInteractiveLinks =
    linksEnabled &&
    graph.nodes.some((n) => Boolean(safeHref(n.interaction?.href)))

  // SVG root with CSS variables + style block + defs
  parts.push(
    withDataSrc(
      svgOpenTag(
        graph.width,
        graph.height,
        colors,
        transparent,
        title,
        decorative,
        hasInteractiveLinks,
        emit.styleAttribute,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, false, emit.nonce))
  // Keyframes for animated edges (`e1@{ animate: true }`). Emitted only when
  // an animated edge exists and animation is enabled, so an ordinary diagram
  // (or one rendered with `interactivity: 'none'`) gains no extra markup.
  if (animationEnabled && graph.edges.some((e) => e.animate)) {
    parts.push(edgeAnimationStyle(emit.nonce))
  }
  parts.push('<defs>')
  parts.push(arrowMarkerDefs())
  // Per-color arrow markers for edges with custom stroke via linkStyle
  const customStrokeColors = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.inlineStyle?.stroke) {
      customStrokeColors.add(edge.inlineStyle.stroke)
    }
  }
  for (const color of customStrokeColors) {
    parts.push(arrowMarkerDefsForColor(color))
  }
  parts.push('</defs>')

  // 1. Subgraph backgrounds (group rectangles with header bands)
  for (const group of graph.groups) {
    parts.push(renderGroup(group, font, fontSizes))
  }

  // 2. Edges (paths — rendered behind nodes)
  // Each edge is a <path> with semantic data-* attributes
  for (const edge of graph.edges) {
    parts.push(renderEdge(edge, curve, animationEnabled))
  }

  // 3. Edge labels (positioned at midpoint of edge)
  // Each label is wrapped in <g class="edge-label">
  for (const edge of graph.edges) {
    if (edge.label) {
      parts.push(renderEdgeLabel(edge, font, fontSizes))
    }
  }

  // 4. Nodes (shape + label wrapped in <g class="node">)
  for (const node of graph.nodes) {
    parts.push(renderNode(node, font, fontSizes, linksEnabled))
  }

  parts.push('</svg>')

  return parts.join('\n')
}

// ============================================================================
// Arrow marker definitions
// ============================================================================

/**
 * Keyframes for `e1@{ animate: true }` edges — a marching-ants dash.
 *
 * CSS animation rather than SMIL: SMIL is deprecated in browsers, while a
 * CSS `@keyframes` block inside the SVG animates in browsers and is simply
 * ignored by static rasterizers, which render the first frame. The
 * `prefers-reduced-motion` guard stops the animation for users who have asked
 * the system for less movement — the edge still renders, just still.
 *
 * A second `<style>` element, so it takes the same `nonce` as the theme
 * block (see `styleOpenTag`) — under a nonce-based CSP it would otherwise be
 * the one un-nonced element on the page and get silently dropped.
 */
function edgeAnimationStyle(nonce?: string): string {
  return [
    styleOpenTag(nonce),
    '  @keyframes zm-edge-dash { to { stroke-dashoffset: -28; } }',
    '  .edge-animated { animation: zm-edge-dash 1s linear infinite; }',
    '  @media (prefers-reduced-motion: reduce) {',
    '    .edge-animated { animation: none; }',
    '  }',
    '</style>',
  ].join('\n')
}

/**
 * Reusable arrow head markers — both forward (end) and reverse (start) variants.
 * Arrow color uses the var(--_arrow) CSS variable.
 */
function arrowMarkerDefs(): string {
  return arrowMarkerPair('var(--_arrow)', '')
}

/**
 * Arrow markers tinted to a specific color (for linkStyle stroke overrides).
 * IDs are suffixed with a sanitized color string to avoid collisions.
 */
function arrowMarkerDefsForColor(color: string): string {
  return arrowMarkerPair(escapeAttr(color), `-${markerSuffix(color)}`)
}

/**
 * Build the forward (marker-end) + reverse (marker-start) arrow-head marker pair.
 *
 * Both heads share one polygon. The reverse head differs only by
 * orient="auto-start-reverse", which flips it 180° to point back out of
 * the start node — so the polygon must NOT be pre-reversed. Reversing both is
 * a double reversal: the head points into the line and vanishes in
 * librsvg/Inkscape/browsers.
 */
function arrowMarkerPair(color: string, idSuffix: string): string {
  const w = ARROW_HEAD.width
  const h = ARROW_HEAD.height
  // Pull arrowhead back slightly (refX = w - 1) to prevent clipping at node boundaries.
  const refX = w - 1
  // Both fill and a thin stroke for better definition at small sizes.
  const style = `fill="${color}" stroke="${color}" stroke-width="0.75" stroke-linejoin="round"`
  const polygon = `<polygon points="0 0, ${w} ${h / 2}, 0 ${h}" ${style} />`
  const marker = (id: string, orient: string) =>
    `  <marker id="${id}" markerWidth="${w}" markerHeight="${h}" refX="${refX}" refY="${h / 2}" orient="${orient}">` +
    `\n    ${polygon}` +
    `\n  </marker>`
  return (
    marker(`arrowhead${idSuffix}`, 'auto') +
    '\n' +
    marker(`arrowhead-start${idSuffix}`, 'auto-start-reverse')
  )
}

/** Sanitize a color value into a collision-free SVG ID suffix.
 *  Non-alphanumeric chars are hex-encoded so distinct inputs never collapse
 *  (e.g. "var(--line-1)" → "var28--line2d129", "var(--line1)" → "var28--line129"). */
function markerSuffix(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, (ch) => ch.charCodeAt(0).toString(16))
}

// ============================================================================
// Group rendering (subgraph backgrounds)
// ============================================================================

function renderGroup(
  group: PositionedGroup,
  font: string,
  fontSizes: FontSizes,
): string {
  const headerHeight = fontSizes.groupHeader + 16
  const parts: string[] = []

  // Opening <g> with semantic attributes for subgraph identification
  // data-id: original Mermaid subgraph ID
  // data-label: display label (may differ from ID)
  parts.push(
    `<g class="subgraph" data-id="${escapeAttr(group.id)}" data-label="${escapeAttr(group.label)}">`,
  )

  // Outer rectangle
  parts.push(
    `  <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" ` +
      `rx="0" ry="0" fill="var(--_group-fill)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )

  // Header band
  parts.push(
    `  <rect x="${group.x}" y="${group.y}" width="${group.width}" height="${headerHeight}" ` +
      `rx="0" ry="0" fill="var(--_group-hdr)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.outerBox}" />`,
  )

  // Header label (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        group.label,
        group.x + 12,
        group.y + headerHeight / 2,
        fontSizes.groupHeader,
        `font-size="${fontSizes.groupHeader}" font-weight="${FONT_WEIGHTS.groupHeader}" fill="var(--_text-sec)"`,
      ),
  )

  // Render nested groups recursively (inside this group)
  for (const child of group.children) {
    parts.push(renderGroup(child, font, fontSizes))
  }

  parts.push('</g>')

  return parts.join('\n')
}

// ============================================================================
// Edge rendering
// ============================================================================

function renderEdge(
  edge: PositionedEdge,
  curve: CurveStyle,
  animationEnabled: boolean = true,
): string {
  if (edge.points.length < 2) return ''

  // `interactivity: 'none'` strips motion: the edge still renders (id,
  // data-* attributes, arrowheads) but never gets the animated class or dash.
  const animate = animationEnabled && (edge.animate ?? false)

  /*
   * A curved edge must be a <path>; only a path can express the
   * interpolations Mermaid's `flowchart.curve` selects.
   *
   * The default (`linear`) deliberately keeps emitting <polyline>. A path of
   * straight `L` segments would be geometrically identical, but changing the
   * element for every diagram would break any consumer selecting
   * `polyline.edge` — for no benefit to a diagram that asked for no curve.
   * So the element changes only when the author opts into a curve.
   */
  const curved = curve !== 'linear'

  /*
   * An invisible link (`A ~~~ B`) still occupies its layout slot — that is
   * the whole point of the syntax — so the element is emitted with its data
   * attributes intact and only its paint suppressed. Omitting the element
   * entirely would lose it from DOM inspection and from `data-style` queries.
   */
  const invisible = edge.style === 'invisible'

  const dashArray = edge.style === 'dotted' ? ' stroke-dasharray="4 4"' : ''
  const baseStrokeWidth =
    edge.style === 'thick'
      ? STROKE_WIDTHS.connector * 2
      : STROKE_WIDTHS.connector
  const strokeColor = invisible
    ? 'none'
    : escapeAttr(edge.inlineStyle?.stroke ?? 'var(--_line)')
  const strokeWidth = escapeAttr(
    edge.inlineStyle?.['stroke-width'] ?? String(baseStrokeWidth),
  )

  // Build marker attributes based on arrow direction flags
  // Use color-specific markers when edge has a custom stroke from linkStyle
  const suffix = edge.inlineStyle?.stroke
    ? `-${markerSuffix(edge.inlineStyle.stroke)}`
    : ''
  let markers = ''
  if (!invisible) {
    if (edge.hasArrowEnd) markers += ` marker-end="url(#arrowhead${suffix})"`
    if (edge.hasArrowStart)
      markers += ` marker-start="url(#arrowhead-start${suffix})"`
  }

  // Semantic data attributes for edge identification and inspection:
  // - class="edge": CSS targeting and type identification
  // - data-from/data-to: source and target node IDs
  // - data-style: edge style (solid, dotted, thick)
  // - data-arrow-start/end: arrow presence flags
  // - data-label: edge label if present (for quick lookup without traversing DOM)
  const dataAttrs = [
    // An animated edge (`e1@{ animate: true }`, with animation enabled)
    // carries an extra class; its keyframes live in the shared style block.
    `class="edge${animate ? ' edge-animated' : ''}"`,
    `data-from="${escapeAttr(edge.source)}"`,
    `data-to="${escapeAttr(edge.target)}"`,
    `data-style="${edge.style}"`,
    `data-arrow-start="${edge.hasArrowStart}"`,
    `data-arrow-end="${edge.hasArrowEnd}"`,
  ]
  if (edge.label) {
    dataAttrs.push(`data-label="${escapeAttr(edge.label)}"`)
  }
  if (edge.id) {
    // Mermaid edge id (`A e1@--> B`), used to target the edge from CSS and
    // to attach the animation below.
    dataAttrs.push(`data-id="${escapeAttr(edge.id)}"`)
  }

  // Marching ants need a dash pattern to march; supply one only when the
  // edge's own style hasn't already set stroke-dasharray.
  const animatedDash = animate && !dashArray ? ' stroke-dasharray="8 6"' : ''

  const geometry = curved
    ? `d="${pointsToPath(edge.points, curve)}"`
    : `points="${pointsToPolylinePath(edge.points)}"`

  return (
    `<${curved ? 'path' : 'polyline'} ${dataAttrs.join(' ')} ${geometry} ` +
    `fill="none" stroke="${strokeColor}" ` +
    `stroke-width="${strokeWidth}"${dashArray}${animatedDash}${markers} />`
  )
}

/** Convert points to SVG polyline points attribute: "x1,y1 x2,y2 ..." */
function pointsToPolylinePath(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

// `_font` isn't read here but is kept to match the `(entity, font)` signature
// threaded through the rest of the render* functions in this file.
function renderEdgeLabel(
  edge: PositionedEdge,
  _font: string,
  fontSizes: FontSizes,
): string {
  // Only called when edge.label is set (see call site), but narrow it here
  // too rather than trusting that invariant across the function boundary.
  if (!edge.label) return ''
  const label = edge.label

  // Use layout-computed label position when available (layout-aware, avoids collisions).
  // Fall back to geometric midpoint of the edge polyline.
  const mid = edge.labelPosition ?? edgeMidpoint(edge.points)
  const padding = 8

  // Measure text (works for both single and multi-line)
  const metrics = measureMultilineText(
    label,
    fontSizes.edgeLabel,
    FONT_WEIGHTS.edgeLabel,
  )

  // Wrap in <g class="edge-label"> with reference to the edge it belongs to
  const content = renderMultilineTextWithBackground(
    label,
    mid.x,
    mid.y,
    metrics.width,
    metrics.height,
    fontSizes.edgeLabel,
    padding,
    // Use --_text-sec for better contrast (was --_text-muted)
    `text-anchor="middle" font-size="${fontSizes.edgeLabel}" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-sec)"`,
    // Increased stroke width from 0.5 to 1 for better label separation from edges
    `rx="2" ry="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="1"`,
  )

  // Semantic wrapper: links label to its edge via data-from/data-to
  return (
    `<g class="edge-label" data-from="${escapeAttr(edge.source)}" data-to="${escapeAttr(edge.target)}" data-label="${escapeAttr(label)}">\n` +
    `  ${content.replace(/\n/g, '\n  ')}\n` +
    `</g>`
  )
}

/**
 * Get the point at `index`, throwing instead of silently producing
 * `undefined` (and downstream `NaN`s). The loops in `edgeMidpoint` only ever
 * pass indices derived from `points.length`, so this should never actually
 * throw — it exists because `noUncheckedIndexedAccess` can't prove that from
 * the loop bounds alone, and a loud failure here is far easier to diagnose
 * than silently corrupted coordinates.
 */
function requirePoint(points: Point[], index: number): Point {
  const point = points[index]
  if (!point) {
    // Unreachable — both call sites in edgeMidpoint only ever pass indices
    // in [0, points.length - 1].
    /* v8 ignore next */
    throw new Error(`edgeMidpoint: missing point at index ${index}`)
  }
  return point
}

/** Get the midpoint of a polyline (by walking segments) */
function edgeMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]!

  // Calculate total length
  let totalLength = 0
  for (let i = 1; i < points.length; i++) {
    totalLength += dist(requirePoint(points, i - 1), requirePoint(points, i))
  }

  // Walk to the halfway point
  let remaining = totalLength / 2
  for (let i = 1; i < points.length; i++) {
    const prev = requirePoint(points, i - 1)
    const curr = requirePoint(points, i)
    const segLen = dist(prev, curr)
    if (remaining <= segLen) {
      const t = remaining / segLen
      return {
        x: prev.x + t * (curr.x - prev.x),
        y: prev.y + t * (curr.y - prev.y),
      }
    }
    remaining -= segLen
  }

  return points[points.length - 1]!
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
}

// ============================================================================
// Node rendering
// ============================================================================

/**
 * Render a complete node: shape + label wrapped in a semantic <g> element.
 *
 * The group includes data attributes for:
 * - data-id: original Mermaid node ID (for edge matching)
 * - data-label: display label text
 * - data-shape: shape type (rectangle, diamond, circle, etc.)
 *
 * @param linksEnabled - Whether a `click`-based `<a href>` link and `<title>`
 *                       tooltip render (from `options.interactivity !==
 *                       'none'`). Default true.
 */
function renderNode(
  node: PositionedNode,
  font: string,
  fontSizes: FontSizes,
  linksEnabled: boolean = true,
): string {
  const shape = renderNodeShape(node)
  const label = renderNodeLabel(node, font, fontSizes)

  // Combine shape and label inside a semantic group
  // This enables reliable node identification without heuristics
  const parts: string[] = []
  const safeClassName = sanitizeClassName(node.className)
  const classAttr = safeClassName ? `node ${safeClassName}` : 'node'

  const interaction = node.interaction
  const groupAttrs = [
    `class="${classAttr}"`,
    `data-id="${escapeAttr(node.id)}"`,
    `data-label="${escapeAttr(node.label)}"`,
    `data-shape="${node.shape}"`,
  ]
  /*
   * `click A call fn()` is deliberately absent from the markup. This renderer
   * produces a static SVG string and executes nothing a diagram supplies —
   * running diagram-authored script would make every rendered diagram an
   * execution vector. The binding is exposed as data instead, on the
   * `interactions` map `parseMermaid()` returns, and the `data-id` attribute
   * above is the hook a host binds it to. The inert `data-click-callback`
   * attribute once emitted here was removed in #216 — see
   * docs/decisions/no-script-interactivity.md.
   */
  parts.push(`<g ${groupAttrs.join(' ')}>`)

  // An href becomes a real SVG link, which needs no script to work.
  // `interactivity: 'none'` strips it — a link is meaningless in
  // print/rasterized output, the target that level is meant for.
  const href = linksEnabled ? safeHref(interaction?.href) : undefined
  const indent = href ? '    ' : '  '
  if (href) {
    const targetAttr = interaction?.target
      ? ` target="${escapeAttr(interaction.target)}"`
      : ''
    parts.push(`  <a href="${escapeAttr(href)}"${targetAttr}>`)
  }

  if (linksEnabled && interaction?.tooltip) {
    // <title> is SVG's native tooltip — no script, no CSS. Gated by
    // linksEnabled alongside href above: both come from the same `click`
    // statement, and 'none' strips both.
    parts.push(`${indent}<title>${escapeXml(interaction.tooltip)}</title>`)
  }

  parts.push(`${indent}${shape.replace(/\n/g, `\n${indent}`)}`)
  if (label) {
    parts.push(`${indent}${label.replace(/\n/g, `\n${indent}`)}`)
  }

  if (href) parts.push('  </a>')
  parts.push('</g>')

  return parts.join('\n')
}

function renderNodeShape(node: PositionedNode): string {
  const { x, y, width, height, shape, inlineStyle } = node

  // Resolve fill and stroke — inline styles (from mermaid `style` directives)
  // override the CSS variable defaults. When no inline style is present, the
  // CSS variable handles theming automatically via color-mix() derivation.
  const fill = escapeAttr(inlineStyle?.fill ?? 'var(--_node-fill)')
  const stroke = escapeAttr(inlineStyle?.stroke ?? 'var(--_node-stroke)')
  const sw = escapeAttr(
    inlineStyle?.['stroke-width'] ?? String(STROKE_WIDTHS.innerBox),
  )

  switch (shape) {
    case 'diamond':
      return renderDiamond(x, y, width, height, fill, stroke, sw)
    case 'rounded':
      return renderRoundedRect(x, y, width, height, fill, stroke, sw)
    case 'stadium':
      return renderStadium(x, y, width, height, fill, stroke, sw)
    case 'circle':
      return renderCircle(x, y, width, height, fill, stroke, sw)
    case 'subroutine':
      return renderSubroutine(x, y, width, height, fill, stroke, sw)
    case 'doublecircle':
      return renderDoubleCircle(x, y, width, height, fill, stroke, sw)
    case 'hexagon':
      return renderHexagon(x, y, width, height, fill, stroke, sw)
    case 'cylinder':
      return renderCylinder(x, y, width, height, fill, stroke, sw)
    case 'asymmetric':
      return renderAsymmetric(x, y, width, height, fill, stroke, sw)
    case 'trapezoid':
      return renderTrapezoid(x, y, width, height, fill, stroke, sw)
    case 'trapezoid-alt':
      return renderTrapezoidAlt(x, y, width, height, fill, stroke, sw)
    case 'parallelogram':
      return renderParallelogram(x, y, width, height, fill, stroke, sw)
    case 'parallelogram-alt':
      return renderParallelogramAlt(x, y, width, height, fill, stroke, sw)
    case 'state-start':
      return renderStateStart(x, y, width, height)
    case 'state-end':
      return renderStateEnd(x, y, width, height)

    // --- Expanded-syntax shapes (`A@{ shape: ... }`) ---
    case 'document':
      return renderDocument(x, y, width, height, fill, stroke, sw)
    case 'stacked-document':
      return renderStacked(x, y, width, height, fill, stroke, sw, true)
    case 'stacked-process':
      return renderStacked(x, y, width, height, fill, stroke, sw, false)
    case 'card':
      return renderCard(x, y, width, height, fill, stroke, sw)
    case 'lined-process':
      return renderLinedProcess(x, y, width, height, fill, stroke, sw)
    case 'divided-process':
      return renderDividedProcess(x, y, width, height, fill, stroke, sw)
    case 'window-pane':
      return renderWindowPane(x, y, width, height, fill, stroke, sw)
    case 'triangle':
      return renderTriangle(x, y, width, height, fill, stroke, sw, false)
    case 'flipped-triangle':
      return renderTriangle(x, y, width, height, fill, stroke, sw, true)
    case 'filled-circle':
      return renderFilledCircle(x, y, width, height, stroke)
    case 'crossed-circle':
      return renderCrossedCircle(x, y, width, height, fill, stroke, sw)
    case 'fork-join':
      return renderForkJoin(x, y, width, height, stroke)
    case 'notched-pentagon':
      return renderNotchedPentagon(x, y, width, height, fill, stroke, sw)
    case 'sloped-rectangle':
      return renderSlopedRectangle(x, y, width, height, fill, stroke, sw)
    case 'flag':
      return renderFlag(x, y, width, height, fill, stroke, sw)
    case 'bow-tie-rectangle':
      return renderBowTie(x, y, width, height, fill, stroke, sw)
    case 'half-rounded-rectangle':
      return renderHalfRounded(x, y, width, height, fill, stroke, sw)
    case 'brace':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'left')
    case 'brace-right':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'right')
    case 'braces':
      return renderBraces(x, y, width, height, fill, stroke, sw, 'both')
    case 'bolt':
      return renderBolt(x, y, width, height, fill, stroke, sw)
    case 'text':
    case 'anchor':
      // No outline — the label (rendered separately) is the whole node.
      return ''

    case 'rectangle':
    default:
      return renderRect(x, y, width, height, fill, stroke, sw)
  }
}

// --- Basic shapes ---

function renderRect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderStadium(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const r = h / 2
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

function renderDiamond(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const hw = w / 2
  const hh = h / 2
  const points = [
    `${cx},${cy - hh}`, // top
    `${cx + hw},${cy}`, // right
    `${cx},${cy + hh}`, // bottom
    `${cx - hw},${cy}`, // left
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 1 shapes ---

/** Subroutine: rectangle with double vertical borders on left and right */
function renderSubroutine(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = 8 // distance from edge to inner vertical line
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" ` +
    `stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + w - inset}" y1="${y}" x2="${x + w - inset}" y2="${y + h}" ` +
    `stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Double circle: two concentric circles with a gap between them */
function renderDoubleCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const outerR = Math.min(w, h) / 2
  const innerR = outerR - 5 // 5px gap between rings
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<circle cx="${cx}" cy="${cy}" r="${innerR}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Hexagon: 6-point polygon with flat top/bottom and angled sides */
function renderHexagon(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = h / 4 // horizontal inset for the angled sides
  const points = [
    `${x + inset},${y}`, // top-left
    `${x + w - inset},${y}`, // top-right
    `${x + w},${y + h / 2}`, // mid-right
    `${x + w - inset},${y + h}`, // bottom-right
    `${x + inset},${y + h}`, // bottom-left
    `${x},${y + h / 2}`, // mid-left
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Batch 2 shapes ---

/** Cylinder / database: top ellipse cap + body rect + bottom ellipse */
function renderCylinder(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const ry = 7 // ellipse vertical radius for the cap
  const cx = x + w / 2
  const bodyTop = y + ry
  const bodyH = h - 2 * ry

  return (
    // Body rectangle (no top border — covered by top ellipse)
    `<rect x="${x}" y="${bodyTop}" width="${w}" height="${bodyH}" ` +
    `fill="${fill}" stroke="none" />` +
    // Left and right body borders
    `\n<line x1="${x}" y1="${bodyTop}" x2="${x}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    `\n<line x1="${x + w}" y1="${bodyTop}" x2="${x + w}" y2="${bodyTop + bodyH}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Bottom ellipse (half visible)
    `\n<ellipse cx="${cx}" cy="${y + h - ry}" rx="${w / 2}" ry="${ry}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />` +
    // Top ellipse (full, on top)
    `\n<ellipse cx="${cx}" cy="${bodyTop}" rx="${w / 2}" ry="${ry}" ` +
    `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Asymmetric / flag: rectangle with a pointed left edge */
function renderAsymmetric(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const indent = 12 // how far the point indents
  const points = [
    `${x + indent},${y}`, // top-left (indented)
    `${x + w},${y}`, // top-right
    `${x + w},${y + h}`, // bottom-right
    `${x + indent},${y + h}`, // bottom-left (indented)
    `${x},${y + h / 2}`, // left point
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid [/text\]: wider bottom, narrower top */
function renderTrapezoid(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15 // top edge is narrower by this amount on each side
  const points = [
    `${x + inset},${y}`, // top-left (indented)
    `${x + w - inset},${y}`, // top-right (indented)
    `${x + w},${y + h}`, // bottom-right (full width)
    `${x},${y + h}`, // bottom-left (full width)
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Trapezoid-alt [\text/]: wider top, narrower bottom */
function renderTrapezoidAlt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15 // bottom edge is narrower
  const points = [
    `${x},${y}`, // top-left (full width)
    `${x + w},${y}`, // top-right (full width)
    `${x + w - inset},${y + h}`, // bottom-right (indented)
    `${x + inset},${y + h}`, // bottom-left (indented)
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/**
 * Parallelogram [/text/]: leans right.
 *
 * Unlike the trapezoids, both sloped sides run the same direction — the top
 * edge shifts right by `inset` and the bottom edge shifts left by the same
 * amount, so opposite sides stay parallel.
 */
function renderParallelogram(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15
  const points = [
    `${x + inset},${y}`, // top-left (shifted right)
    `${x + w},${y}`, // top-right
    `${x + w - inset},${y + h}`, // bottom-right (shifted left)
    `${x},${y + h}`, // bottom-left
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

/** Parallelogram-alt [\text\]: leans left — the mirror of renderParallelogram. */
function renderParallelogramAlt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = w * 0.15
  const points = [
    `${x},${y}`, // top-left
    `${x + w - inset},${y}`, // top-right (shifted left)
    `${x + w},${y + h}`, // bottom-right
    `${x + inset},${y + h}`, // bottom-left (shifted right)
  ].join(' ')

  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" />`
}

// --- Expanded-syntax shapes (`A@{ shape: ... }`) ---
//
// Each of these is reachable only through the expanded metadata syntax; the
// classic bracket forms have no spelling for them. See src/expanded-shapes.ts
// for the semantic-name → geometry alias table.

/** Shared attribute string for a filled, stroked path. */
function shapeAttrs(fill: string, stroke: string, sw: string): string {
  return `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`
}

/**
 * Document: rectangle with a wavy bottom edge.
 *
 * The wave is two cubic segments — down then up — so the edge returns to its
 * starting height at the right corner and the shape tiles cleanly when
 * stacked (see renderStacked).
 */
function renderDocument(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const waveH = Math.min(10, h * 0.16)
  const base = y + h - waveH
  // Both ends land on `base`, so the left and right sides are the same
  // height. Ending the curve anywhere else makes every document node
  // visibly lopsided.
  const d =
    `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${base} ` +
    `C ${x + w * 0.75} ${base + waveH * 1.8} ${x + w * 0.25} ${base - waveH * 0.8} ${x} ${base} Z`
  return `<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Stacked document / process: offset copies behind the front shape. */
function renderStacked(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  isDocument: boolean,
): string {
  const offset = 5
  const frontW = w - offset * 2
  const frontH = h - offset * 2
  const parts: string[] = []

  // Two offset copies behind, back to front.
  for (let i = 2; i >= 1; i--) {
    parts.push(
      `<rect x="${x + offset * i}" y="${y + offset * (2 - i)}" width="${frontW}" height="${frontH}" ` +
        `${shapeAttrs(fill, stroke, sw)} />`,
    )
  }

  parts.push(
    isDocument
      ? renderDocument(x, y + offset * 2, frontW, frontH, fill, stroke, sw)
      : `<rect x="${x}" y="${y + offset * 2}" width="${frontW}" height="${frontH}" ${shapeAttrs(fill, stroke, sw)} />`,
  )

  return parts.join('\n')
}

/** Card / notched rectangle: top-left corner clipped. */
function renderCard(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const notch = Math.min(14, w * 0.12, h * 0.3)
  const points = [
    `${x + notch},${y}`,
    `${x + w},${y}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
    `${x},${y + notch}`,
  ].join(' ')
  return `<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Lined process: rectangle with a vertical rule inset from the left edge. */
function renderLinedProcess(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const inset = Math.min(12, w * 0.12)
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    `<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Divided process: rectangle split by a horizontal rule near the top. */
function renderDividedProcess(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const split = y + Math.min(16, h * 0.3)
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    `<line x1="${x}" y1="${split}" x2="${x + w}" y2="${split}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Window pane / internal storage: rectangle quartered by a cross. */
function renderWindowPane(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const vx = x + Math.min(16, w * 0.16)
  const hy = y + Math.min(14, h * 0.28)
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    `<line x1="${vx}" y1="${y}" x2="${vx}" y2="${y + h}" stroke="${stroke}" stroke-width="${sw}" />\n` +
    `<line x1="${x}" y1="${hy}" x2="${x + w}" y2="${hy}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Triangle, apex up (extract) or apex down (manual file). */
function renderTriangle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
  flipped: boolean,
): string {
  const points = flipped
    ? [`${x},${y}`, `${x + w},${y}`, `${x + w / 2},${y + h}`]
    : [`${x + w / 2},${y}`, `${x + w},${y + h}`, `${x},${y + h}`]
  return `<polygon points="${points.join(' ')}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Filled circle (junction): a solid dot, so it takes the stroke color as fill. */
function renderFilledCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
): string {
  const r = Math.min(w, h) / 2 - 2
  return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${r}" fill="${stroke}" stroke="${stroke}" />`
}

/** Crossed circle (summary): circle with an X through it. */
function renderCrossedCircle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2 - 2
  // Cross arms meet the circumference at 45°, so offset by r/√2.
  const d = r / Math.SQRT2
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" ${shapeAttrs(fill, stroke, sw)} />\n` +
    `<line x1="${cx - d}" y1="${cy - d}" x2="${cx + d}" y2="${cy + d}" stroke="${stroke}" stroke-width="${sw}" />\n` +
    `<line x1="${cx + d}" y1="${cy - d}" x2="${cx - d}" y2="${cy + d}" stroke="${stroke}" stroke-width="${sw}" />`
  )
}

/** Fork/join: a solid bar, drawn in the stroke color. */
function renderForkJoin(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
): string {
  const barH = Math.min(8, h)
  return `<rect x="${x}" y="${y + (h - barH) / 2}" width="${w}" height="${barH}" fill="${stroke}" stroke="${stroke}" />`
}

/** Notched pentagon (loop limit): both top corners clipped. */
function renderNotchedPentagon(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const notch = Math.min(14, w * 0.12, h * 0.3)
  const points = [
    `${x + notch},${y}`,
    `${x + w - notch},${y}`,
    `${x + w},${y + notch}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
    `${x},${y + notch}`,
  ].join(' ')
  return `<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Sloped rectangle (manual input): top edge slopes up to the right. */
function renderSlopedRectangle(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const slope = Math.min(12, h * 0.3)
  const points = [
    `${x},${y + slope}`,
    `${x + w},${y}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
  ].join(' ')
  return `<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Flag / paper tape: wavy top and bottom edges. */
function renderFlag(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const waveH = Math.min(8, h * 0.14)
  const d =
    `M ${x} ${y + waveH} ` +
    `C ${x + w * 0.25} ${y - waveH} ${x + w * 0.75} ${y + waveH * 2} ${x + w} ${y + waveH} ` +
    `L ${x + w} ${y + h - waveH} ` +
    `C ${x + w * 0.75} ${y + h + waveH} ${x + w * 0.25} ${y + h - waveH * 2} ${x} ${y + h - waveH} Z`
  return `<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Bow-tie rectangle (stored data): left and right edges curve inward. */
function renderBowTie(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const bow = Math.min(14, w * 0.12)
  const d =
    `M ${x + bow} ${y} L ${x + w} ${y} ` +
    `Q ${x + w - bow * 1.4} ${y + h / 2} ${x + w} ${y + h} ` +
    `L ${x + bow} ${y + h} ` +
    `Q ${x + bow * 1.4} ${y + h / 2} ${x + bow} ${y} Z`
  return `<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/** Delay / half-rounded rectangle: the right end is a semicircle. */
function renderHalfRounded(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const r = h / 2
  const straight = Math.max(0, w - r)
  const d =
    `M ${x} ${y} L ${x + straight} ${y} ` +
    `A ${r} ${r} 0 0 1 ${x + straight} ${y + h} ` +
    `L ${x} ${y + h} Z`
  return `<path d="${d}" ${shapeAttrs(fill, stroke, sw)} />`
}

/**
 * Brace shapes: a rectangle body flanked by curly braces.
 *
 * Mermaid's `brace`/`comment` is a left brace, `brace-r` a right brace, and
 * `braces` both. The body itself is unfilled so the braces read as annotation
 * marks rather than as a container.
 */
function renderBraces(
  x: number,
  y: number,
  w: number,
  h: number,
  _fill: string,
  stroke: string,
  sw: string,
  side: 'left' | 'right' | 'both',
): string {
  const armW = Math.min(10, w * 0.12)
  // Unfilled: a filled body reads as a container, which is the opposite of
  // what a brace annotation means. The rect stays only to reserve the
  // label area; `_fill` is deliberately unused.
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="none" />`,
  ]

  const leftBrace =
    `M ${x + armW} ${y} Q ${x} ${y} ${x} ${y + h * 0.25} ` +
    `Q ${x} ${y + h / 2} ${x - armW * 0.4} ${y + h / 2} ` +
    `Q ${x} ${y + h / 2} ${x} ${y + h * 0.75} ` +
    `Q ${x} ${y + h} ${x + armW} ${y + h}`
  const rightBrace =
    `M ${x + w - armW} ${y} Q ${x + w} ${y} ${x + w} ${y + h * 0.25} ` +
    `Q ${x + w} ${y + h / 2} ${x + w + armW * 0.4} ${y + h / 2} ` +
    `Q ${x + w} ${y + h / 2} ${x + w} ${y + h * 0.75} ` +
    `Q ${x + w} ${y + h} ${x + w - armW} ${y + h}`

  if (side === 'left' || side === 'both') {
    parts.push(
      `<path d="${leftBrace}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`,
    )
  }
  if (side === 'right' || side === 'both') {
    parts.push(
      `<path d="${rightBrace}" fill="none" stroke="${stroke}" stroke-width="${sw}" />`,
    )
  }

  return parts.join('\n')
}

/** Lightning bolt (communication link). */
function renderBolt(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  sw: string,
): string {
  const points = [
    `${x + w * 0.42},${y}`,
    `${x + w},${y}`,
    `${x + w * 0.62},${y + h * 0.42}`,
    `${x + w},${y + h * 0.42}`,
    `${x + w * 0.3},${y + h}`,
    `${x + w * 0.5},${y + h * 0.55}`,
    `${x},${y + h * 0.55}`,
  ].join(' ')
  return `<polygon points="${points}" ${shapeAttrs(fill, stroke, sw)} />`
}

// --- Batch 3: State diagram pseudostates ---

/** State start: small filled circle using primary text color */
function renderStateStart(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const r = Math.min(w, h) / 2 - 2
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--_text)" stroke="none" />`
}

/** State end: bullseye — outer ring + inner filled circle using primary text color */
function renderStateEnd(x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2
  const cy = y + h / 2
  const outerR = Math.min(w, h) / 2 - 2
  const innerR = outerR - 4
  return (
    `<circle cx="${cx}" cy="${cy}" r="${outerR}" ` +
    `fill="none" stroke="var(--_text)" stroke-width="${STROKE_WIDTHS.innerBox * 2}" />` +
    `\n<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="var(--_text)" stroke="none" />`
  )
}

// ============================================================================
// Node label rendering
// ============================================================================

// `_font` isn't read here but is kept to match the `(entity, font)` signature
// threaded through the rest of the render* functions in this file.
function renderNodeLabel(
  node: PositionedNode,
  _font: string,
  fontSizes: FontSizes,
): string {
  // State pseudostates have no label
  if (node.shape === 'state-start' || node.shape === 'state-end') {
    if (!node.label) return ''
  }

  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2

  // Resolve text color — inline styles can override the CSS variable default.
  // When there's no explicit `color` but there IS a concrete, resolvable
  // `fill` (e.g. from classDef/style), compute a readable black/white text
  // color from the fill's luminance instead of defaulting to the ambient
  // theme foreground, which can be unreadable against a custom fill (e.g.
  // white theme text on a light pastel fill in dark mode). See issue #55.
  const textColor = escapeAttr(
    node.inlineStyle?.color ??
      getReadableTextColor(node.inlineStyle?.fill, 'var(--_text)'),
  )

  let attrs = `text-anchor="middle" font-size="${fontSizes.nodeLabel}" font-weight="${FONT_WEIGHTS.nodeLabel}" fill="${textColor}"`

  // Per-node font-family override (from `style A font-family:...` or
  // classDef/class). Emitted as an inline `style` attribute rather than a
  // `font-family` presentation attribute: the global font is applied via a
  // `text { font-family: ... }` rule in the embedded <style> block (see
  // theme.ts buildStyleBlock), and a presentation attribute always loses to
  // any stylesheet rule regardless of selector specificity. An inline `style`
  // attribute has the highest priority in the cascade, so it reliably
  // overrides the global rule for just this node while every other node
  // keeps falling back to the global font stack. See issue #57.
  const fontFamily = node.inlineStyle?.['font-family']
  if (fontFamily) {
    attrs += ` style="font-family: ${escapeAttr(fontFamily)};"`
  }

  return renderMultilineText(node.label, cx, cy, fontSizes.nodeLabel, attrs)
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Escape a string for embedding as a *multiline-safe* XML attribute value —
 * `escapeAttr()` plus tab/LF/CR as numeric character references.
 *
 * A strict XML parser applies attribute-value normalization on the way in:
 * any literal tab, LF, or CR in the value is collapsed to a single space.
 * (This is why a standalone .svg file opened directly, or any output run
 * through `DOMParser` with an XML/`image/svg+xml` mimetype, would silently
 * flatten a multiline `data-src` back to one line.) Character references
 * are exempt from that normalization — `&#10;` round-trips as an actual
 * newline — so diagram source, which is virtually always multiline, needs
 * this rather than `escapeAttr()` alone to survive the trip intact.
 */
function escapeMultilineAttr(value: string): string {
  return escapeAttr(value)
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;')
    .replace(/\t/g, '&#9;')
}

/**
 * Splice a `data-src` attribute (the original diagram source, escaped) onto
 * an already-built root `<svg ...>` opening tag, e.g. from
 * `embedSource: true`. Applied to the string `svgOpenTag()` returns rather
 * than the diagram source's own markup, so it always lands on the root
 * element regardless of diagram type. No-op when `source` is undefined.
 */
export function withDataSrc(
  svgTag: string,
  source: string | undefined,
): string {
  if (source === undefined) return svgTag
  return svgTag.replace(
    '<svg ',
    `<svg data-src="${escapeMultilineAttr(source)}" `,
  )
}

/**
 * Validate a user-authored class name (from `:::className` or
 * `class A className`) before it's emitted into the SVG `class` attribute.
 *
 * The parser already constrains class names to word characters and hyphens
 * (see CLASS_SHORTHAND_REGEX / the `class` statement regex in parser.ts), so
 * this is a defense-in-depth allowlist rather than an escaping step — a
 * class name can't be made "safe" by escaping since any character other than
 * a valid CSS identifier character would break the class token itself, not
 * just the surrounding attribute quotes. Anything that doesn't match a valid
 * CSS identifier (letters, digits, underscore, hyphen; not starting with a
 * digit or a hyphen+digit) is dropped rather than emitted.
 */
function sanitizeClassName(className: string | undefined): string | undefined {
  if (!className) return undefined
  return /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/.test(className) ? className : undefined
}
