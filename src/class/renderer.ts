import type {
  PositionedClassDiagram,
  PositionedClassNode,
  PositionedClassNote,
  PositionedClassRelationship,
  ClassMember,
  RelationshipType,
} from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock, getReadableTextColor } from '../theme.ts'
import { sanitizeClassName } from '../style-directives.ts'
import { withDataSrc } from '../renderer.ts'
import type { FontSizes } from '../styles.ts'
import {
  FONT_SIZES,
  FONT_WEIGHTS,
  STROKE_WIDTHS,
  TEXT_BASELINE_SHIFT,
} from '../styles.ts'
import { CLS } from './layout.ts'
import {
  renderMultilineText,
  escapeXml as escapeXmlUtil,
  escapeAttr,
} from '../multiline-utils.ts'
import { safeHref } from '../click-directive.ts'

// ============================================================================
// Class diagram SVG renderer
//
// Renders positioned class diagrams to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order:
//   1. Relationship lines and note links (behind boxes)
//   2. Class boxes (header + attributes + methods compartments)
//   3. Notes (dog-eared boxes)
//   4. Relationship labels and cardinality
// ============================================================================

/** Font sizes specific to class diagrams */
const CLS_FONT = {
  memberSize: 11,
  memberWeight: 400,
  annotationSize: 10,
  annotationWeight: 500,
} as const

/**
 * Render a positioned class diagram as an SVG string.
 *
 * @param colors - DiagramColors with bg/fg and optional enrichment variables.
 * @param transparent - If true, renders with transparent background.
 * @param embedSource - Original diagram source to stamp onto the root `<svg>`
 *                       as `data-src` (from `options.embedSource`). Omitted
 *                       when the option is off.
 * @param title - Accessible name (from `options.title`). See svgOpenTag() in
 *                src/theme.ts.
 * @param decorative - Marks the SVG decorative (from `options.decorative`).
 * @param linksEnabled - Whether `click`-based `<a href>` links and `<title>`
 *                       tooltips render (from `options.interactivity !==
 *                       'none'`, see `resolveLinksEnabled` in src/index.ts).
 *                       Default true — matches the flowchart/state renderer.
 */
export function renderClassSvg(
  diagram: PositionedClassDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  fontSizes: FontSizes = FONT_SIZES,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  linksEnabled: boolean = true,
): string {
  const parts: string[] = []

  // See #239 / src/renderer.ts's renderSvg: a click-based link renders as a
  // focusable <a href> inside the SVG, which role="img"/aria-hidden would
  // hide from assistive tech while leaving it Tab-reachable — svgOpenTag
  // forces no root role in that case. Gated by linksEnabled too, since
  // `interactivity: 'none'` strips the <a> below.
  const hasInteractiveLinks =
    linksEnabled &&
    diagram.classes.some((c) => Boolean(safeHref(c.interaction?.href)))

  // SVG root with CSS variables + style block (with mono font) + defs
  parts.push(
    withDataSrc(
      svgOpenTag(
        diagram.width,
        diagram.height,
        colors,
        transparent,
        title,
        decorative,
        hasInteractiveLinks,
      ),
      embedSource,
    ),
  )
  parts.push(buildStyleBlock(font, true))
  parts.push('<defs>')
  parts.push(relationshipMarkerDefs())
  parts.push('</defs>')

  // 1. Relationship lines and note links (rendered behind boxes)
  for (const rel of diagram.relationships) {
    parts.push(renderRelationship(rel))
  }
  for (const note of diagram.notes) {
    parts.push(renderNoteLink(note))
  }

  // 2. Class boxes
  for (const cls of diagram.classes) {
    parts.push(renderClassBox(cls, fontSizes, linksEnabled))
  }

  // 3. Notes
  for (const note of diagram.notes) {
    parts.push(renderNote(note, fontSizes))
  }

  // 4. Relationship labels and cardinality
  for (const rel of diagram.relationships) {
    parts.push(renderRelationshipLabels(rel, fontSizes))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ============================================================================
// Marker definitions
// ============================================================================

/**
 * Marker definitions for class relationship endpoints.
 * Each relationship type has a distinct marker:
 *   - inheritance: hollow triangle
 *   - composition: filled diamond
 *   - aggregation: hollow diamond
 *   - association: open arrow (simple >)
 *   - dependency: open arrow (simple >)
 *   - realization: hollow triangle (same as inheritance)
 *
 * Uses var(--_arrow) for fill/stroke and var(--bg) for hollow marker fills.
 */
function relationshipMarkerDefs(): string {
  return (
    // Hollow triangle (inheritance, realization) — points at target
    `  <marker id="cls-inherit" markerWidth="12" markerHeight="10" refX="12" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="0 0, 12 5, 0 10" fill="var(--bg)" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Filled diamond (composition) — points at source
    `\n  <marker id="cls-composition" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="1" />` +
    `\n  </marker>` +
    // Hollow diamond (aggregation) — points at source
    `\n  <marker id="cls-aggregation" markerWidth="12" markerHeight="10" refX="0" refY="5" orient="auto-start-reverse">` +
    `\n    <polygon points="6 0, 12 5, 6 10, 0 5" fill="var(--bg)" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>` +
    // Open arrow (association, dependency)
    `\n  <marker id="cls-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto-start-reverse">` +
    `\n    <polyline points="0 0, 8 3, 0 6" fill="none" stroke="var(--_arrow)" stroke-width="1.5" />` +
    `\n  </marker>`
  )
}

// ============================================================================
// Class box rendering
// ============================================================================

/**
 * Render a class box with 3 compartments: header, attributes, methods.
 * Wrapped in <g class="class-node"> with semantic data attributes.
 *
 * @param linksEnabled - Whether a `click`-based `<a href>` link and `<title>`
 *                       tooltip render (from `options.interactivity !==
 *                       'none'`). Default true. Mirrors renderNode() in
 *                       src/renderer.ts — see that function's docstring and
 *                       docs/decisions/no-script-interactivity.md for why a
 *                       `call`/callback binding is recorded as a data
 *                       attribute rather than ever invoked.
 */
function renderClassBox(
  cls: PositionedClassNode,
  fontSizes: FontSizes,
  linksEnabled: boolean = true,
): string {
  const { x, y, width, height, headerHeight, attrHeight, inlineStyle } = cls
  const parts: string[] = []

  const interaction = cls.interaction

  // Resolve box colors — inline styles (from `classDef`/`cssClass`/`style`)
  // override the CSS-variable defaults the same way renderNodeShape() in
  // src/renderer.ts does for flowchart nodes. With no inline style the
  // variables keep deriving from the theme via color-mix(), so dark mode is
  // untouched; a concrete `fill` is used verbatim, exactly as Mermaid does.
  const fill = escapeAttr(inlineStyle?.fill ?? 'var(--_node-fill)')
  const stroke = escapeAttr(inlineStyle?.stroke ?? 'var(--_node-stroke)')
  const strokeWidth = escapeAttr(
    inlineStyle?.['stroke-width'] ?? String(STROKE_WIDTHS.outerBox),
  )
  // Mermaid paints the whole class box one color, so a custom fill replaces
  // the header band too rather than leaving the theme's band on top of it.
  const headerFill = inlineStyle?.fill ? fill : 'var(--_group-hdr)'
  // An explicit `color:` wins; otherwise a concrete custom fill gets a
  // black/white text color chosen for contrast (see getReadableTextColor,
  // issue #55). Left undefined when neither applies so the syntax-colored
  // member tspans keep their theme defaults.
  const textColor = inlineStyle?.color
    ? escapeAttr(inlineStyle.color)
    : inlineStyle?.fill
      ? escapeAttr(getReadableTextColor(inlineStyle.fill, 'var(--_text)'))
      : undefined

  // Semantic wrapper with class metadata
  // data-id: class identifier
  // data-label: class name
  // data-annotation: stereotype (interface, abstract, etc.)
  const annotationAttr = cls.annotation
    ? ` data-annotation="${escapeAttr(cls.annotation)}"`
    : ''
  // A style class from `cssClass`/`class A name`/`:::name` is emitted onto
  // the group so external CSS can target it, after the same allowlist the
  // flowchart renderer applies.
  const safeClassName = sanitizeClassName(cls.className)
  const groupAttrs = [
    `class="${safeClassName ? `class-node ${safeClassName}` : 'class-node'}"`,
    `data-id="${escapeAttr(cls.id)}"`,
    `data-label="${escapeAttr(cls.label)}"`,
  ]
  if (interaction?.callback) {
    // `click ClassName call fn()` is recorded, never invoked — see
    // renderNode() in src/renderer.ts for the identical rationale.
    groupAttrs.push(`data-click-callback="${escapeAttr(interaction.callback)}"`)
  }
  parts.push(`<g ${groupAttrs.join(' ')}${annotationAttr}>`)

  // An href becomes a real SVG link, which needs no script to work.
  // `interactivity: 'none'` strips it — a link is meaningless in
  // print/rasterized output, the target that level is meant for.
  const href = linksEnabled ? safeHref(interaction?.href) : undefined
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
    parts.push(`  <title>${escapeXml(interaction.tooltip)}</title>`)
  }

  // Outer rectangle (full box)
  parts.push(
    `  <rect x="${x}" y="${y}" width="${width}" height="${height}" ` +
      `rx="0" ry="0" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
  )

  // Header background
  parts.push(
    `  <rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" ` +
      `rx="0" ry="0" fill="${headerFill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
  )

  // Annotation (<<interface>>, <<abstract>>, etc.)
  let nameY = y + headerHeight / 2
  if (cls.annotation) {
    const annotY = y + 12
    parts.push(
      `  <text x="${x + width / 2}" y="${annotY}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" ` +
        `font-size="${CLS_FONT.annotationSize}" font-weight="${CLS_FONT.annotationWeight}" ` +
        `font-style="italic" fill="${textColor ?? 'var(--_text-muted)'}">&lt;&lt;${escapeXml(cls.annotation)}&gt;&gt;</text>`,
    )
    nameY = y + headerHeight / 2 + 6
  }

  // Class name (supports multi-line via <br> tags)
  parts.push(
    '  ' +
      renderMultilineText(
        cls.label,
        x + width / 2,
        nameY,
        fontSizes.nodeLabel,
        `text-anchor="middle" font-size="${fontSizes.nodeLabel}" font-weight="700" fill="${textColor ?? 'var(--_text)'}"`,
      ),
  )

  // Divider line between header and attributes
  const attrTop = y + headerHeight
  parts.push(
    `  <line x1="${x}" y1="${attrTop}" x2="${x + width}" y2="${attrTop}" ` +
      `stroke="${stroke}" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  )

  // Attributes
  const memberRowH = 20
  for (let i = 0; i < cls.attributes.length; i++) {
    const member = cls.attributes[i]!
    const memberY = attrTop + 4 + i * memberRowH + memberRowH / 2
    parts.push('  ' + renderMember(member, x + CLS.boxPadX, memberY, textColor))
  }

  // Divider line between attributes and methods
  const methodTop = attrTop + attrHeight
  parts.push(
    `  <line x1="${x}" y1="${methodTop}" x2="${x + width}" y2="${methodTop}" ` +
      `stroke="${stroke}" stroke-width="${STROKE_WIDTHS.innerBox}" />`,
  )

  // Methods
  for (let i = 0; i < cls.methods.length; i++) {
    const member = cls.methods[i]!
    const memberY = methodTop + 4 + i * memberRowH + memberRowH / 2
    parts.push('  ' + renderMember(member, x + CLS.boxPadX, memberY, textColor))
  }

  if (href) parts.push('  </a>')
  parts.push('</g>')

  return parts.join('\n')
}

/**
 * Render a single class member with syntax highlighting.
 * Uses <tspan> elements to color each part of the member differently:
 *   - visibility symbol (+/-/#/~) → textFaint
 *   - member name (incl. parens for methods) → textSecondary
 *   - colon separator → textFaint
 *   - type annotation → textMuted
 *
 * @param textColor - A resolved custom text color (from `style ... color:` or
 *                    derived from a custom `fill`). When given, every tspan
 *                    uses it: the per-part theme tints are tuned against the
 *                    theme's own node fill and can't be assumed readable on
 *                    an arbitrary user-chosen background.
 */
function renderMember(
  member: ClassMember,
  x: number,
  y: number,
  textColor?: string,
): string {
  const fontStyle = member.isAbstract ? ' font-style="italic"' : ''
  const decoration = member.isStatic ? ' text-decoration="underline"' : ''

  const faint = textColor ?? 'var(--_text-faint)'
  const secondary = textColor ?? 'var(--_text-sec)'
  const muted = textColor ?? 'var(--_text-muted)'

  // Build tspan parts for syntax-highlighted member text
  const spans: string[] = []

  if (member.visibility) {
    spans.push(
      `<tspan fill="${faint}">${escapeXml(member.visibility)} </tspan>`,
    )
  }

  // Add parentheses for methods to distinguish from attributes, including parameters if present
  const displayName = member.isMethod
    ? `${member.name}(${member.params || ''})`
    : member.name
  // False positive: displayName is passed through escapeXml() (see src/multiline-utils.ts),
  // which escapes &, <, >, ", ' before interpolation, so this is not raw/unescaped HTML.
  spans.push(`<tspan fill="${secondary}">${escapeXml(displayName)}</tspan>`) // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format

  if (member.type) {
    spans.push(`<tspan fill="${faint}">: </tspan>`)
    spans.push(`<tspan fill="${muted}">${escapeXml(member.type)}</tspan>`)
  }

  return (
    `<text x="${x}" y="${y}" class="mono" dy="${TEXT_BASELINE_SHIFT}" ` +
    `font-size="${CLS_FONT.memberSize}" font-weight="${CLS_FONT.memberWeight}"${fontStyle}${decoration}>` +
    `${spans.join('')}</text>`
  )
}

// ============================================================================
// Note rendering
// ============================================================================

/** Size of the folded corner on a note box, in px */
const NOTE_FOLD = 6

/**
 * Render a note as a dog-eared box: a polygon with its top-right corner
 * clipped plus a small fold triangle — the same shape the sequence renderer
 * draws for its notes (src/sequence/renderer.ts renderNote), so notes look
 * alike across diagram types. Wrapped in <g class="class-note"> with
 * `data-for` naming the class it's attached to, if any.
 */
function renderNote(note: PositionedClassNote, fontSizes: FontSizes): string {
  const { x, y, width: w, height: h } = note
  const forAttr =
    note.forClass !== undefined
      ? ` data-for="${escapeAttr(note.forClass)}"`
      : ''

  // Note body: (x,y) → (x+w-fold,y) → (x+w,y+fold) → (x+w,y+h) → (x,y+h)
  const bodyPoints = [
    `${x},${y}`,
    `${x + w - NOTE_FOLD},${y}`,
    `${x + w},${y + NOTE_FOLD}`,
    `${x + w},${y + h}`,
    `${x},${y + h}`,
  ].join(' ')
  const foldPoints =
    `${x + w - NOTE_FOLD},${y} ${x + w},${y + NOTE_FOLD} ` +
    `${x + w - NOTE_FOLD},${y + NOTE_FOLD}`

  return (
    `<g class="class-note"${forAttr}>` +
    `\n  <polygon points="${bodyPoints}" ` +
    `fill="var(--bg)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    `\n  <polygon points="${foldPoints}" ` +
    `fill="var(--_inner-stroke)" stroke="var(--_node-stroke)" stroke-width="${STROKE_WIDTHS.innerBox}" />` +
    `\n  ${renderMultilineText(
      note.text,
      x + w / 2,
      y + h / 2,
      fontSizes.edgeLabel,
      `font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
    )}` +
    `\n</g>`
  )
}

/**
 * Render the dotted, arrowless link from a `note for X` note to its class
 * (Mermaid's `pattern: 'dotted'` note edge). Empty for a free note.
 */
function renderNoteLink(note: PositionedClassNote): string {
  if (!note.linkPoints || note.linkPoints.length < 2) return ''
  const pathData = note.linkPoints.map((p) => `${p.x},${p.y}`).join(' ')
  const forAttr =
    note.forClass !== undefined
      ? ` data-for="${escapeAttr(note.forClass)}"`
      : ''
  return (
    `<polyline class="class-note-link"${forAttr} points="${pathData}" ` +
    `fill="none" stroke="var(--_line)" stroke-width="${STROKE_WIDTHS.connector}" stroke-dasharray="2 3" />`
  )
}

// ============================================================================
// Relationship rendering
// ============================================================================

/**
 * Render a relationship line with appropriate markers and semantic attributes.
 * Includes data-* attributes for programmatic inspection.
 */
function renderRelationship(rel: PositionedClassRelationship): string {
  if (rel.points.length < 2) return ''

  const pathData = rel.points.map((p) => `${p.x},${p.y}`).join(' ')
  const isDashed = rel.type === 'dependency' || rel.type === 'realization'
  const dashArray = isDashed ? ' stroke-dasharray="6 4"' : ''

  // Determine markers based on relationship type and which end has the marker
  const markers = getRelationshipMarkers(rel.type, rel.markerAt)

  // Build semantic data attributes for relationship inspection:
  // - class="class-relationship": CSS targeting
  // - data-from/data-to: source and target class IDs
  // - data-type: relationship type (inheritance, composition, etc.)
  // - data-marker-at: which end has the marker (from/to)
  // - data-from-cardinality/data-to-cardinality: multiplicity if present
  // - data-label: relationship label if present
  const dataAttrs = [
    'class="class-relationship"',
    `data-from="${escapeAttr(rel.from)}"`,
    `data-to="${escapeAttr(rel.to)}"`,
    `data-type="${rel.type}"`,
    `data-marker-at="${rel.markerAt}"`,
  ]
  if (rel.label) {
    dataAttrs.push(`data-label="${escapeAttr(rel.label)}"`)
  }
  if (rel.fromCardinality) {
    dataAttrs.push(`data-from-cardinality="${escapeAttr(rel.fromCardinality)}"`)
  }
  if (rel.toCardinality) {
    dataAttrs.push(`data-to-cardinality="${escapeAttr(rel.toCardinality)}"`)
  }

  return (
    `<polyline ${dataAttrs.join(' ')} points="${pathData}" fill="none" stroke="var(--_line)" ` +
    `stroke-width="${STROKE_WIDTHS.connector}"${dashArray}${markers} />`
  )
}

/**
 * Get marker-start/marker-end attributes for a relationship type.
 * Uses `markerAt` from the parser to place the marker on the correct end:
 *   - 'from' → marker-start (prefix arrows like `<|--`, `*--`, `o--`)
 *   - 'to'   → marker-end   (suffix arrows like `..|>`, `-->`, `--*`)
 */
function getRelationshipMarkers(
  type: RelationshipType,
  markerAt: 'from' | 'to',
): string {
  const markerId = getMarkerDefId(type)
  if (!markerId) return ''

  if (markerAt === 'from') {
    return ` marker-start="url(#${markerId})"`
  } else {
    return ` marker-end="url(#${markerId})"`
  }
}

/** Map relationship type to its SVG marker definition ID */
function getMarkerDefId(type: RelationshipType): string | null {
  switch (type) {
    case 'inheritance':
    case 'realization':
      return 'cls-inherit'
    case 'composition':
      return 'cls-composition'
    case 'aggregation':
      return 'cls-aggregation'
    case 'association':
    case 'dependency':
      return 'cls-arrow'
    default:
      return null
  }
}

/** Render relationship labels and cardinality text (supports multi-line) */
function renderRelationshipLabels(
  rel: PositionedClassRelationship,
  fontSizes: FontSizes,
): string {
  if (!rel.label && !rel.fromCardinality && !rel.toCardinality) return ''
  if (rel.points.length < 2) return ''

  const parts: string[] = []

  // Label — prefer layout-computed position (collision-aware), fall back to midpoint
  if (rel.label) {
    const pos = rel.labelPosition ?? midpoint(rel.points)
    parts.push(
      renderMultilineText(
        rel.label,
        pos.x,
        pos.y - 8,
        fontSizes.edgeLabel,
        `font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    )
  }

  // From cardinality (near start)
  if (rel.fromCardinality && rel.points.length >= 2) {
    const p = rel.points[0]!
    const next = rel.points[1]!
    const offset = cardinalityOffset(p, next)
    parts.push(
      renderMultilineText(
        rel.fromCardinality,
        p.x + offset.x,
        p.y + offset.y,
        fontSizes.edgeLabel,
        `font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    )
  }

  // To cardinality (near end)
  if (rel.toCardinality && rel.points.length >= 2) {
    const p = rel.points[rel.points.length - 1]!
    const prev = rel.points[rel.points.length - 2]!
    const offset = cardinalityOffset(p, prev)
    parts.push(
      renderMultilineText(
        rel.toCardinality,
        p.x + offset.x,
        p.y + offset.y,
        fontSizes.edgeLabel,
        `font-size="${fontSizes.edgeLabel}" text-anchor="middle" font-weight="${FONT_WEIGHTS.edgeLabel}" fill="var(--_text-muted)"`,
      ),
    )
  }

  return parts.join('\n')
}

/** Get the midpoint of a point array */
function midpoint(points: Array<{ x: number; y: number }>): {
  x: number
  y: number
} {
  if (points.length === 0) return { x: 0, y: 0 }
  const mid = Math.floor(points.length / 2)
  return points[mid]!
}

/** Calculate offset for cardinality label perpendicular to edge direction */
function cardinalityOffset(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  // Place label perpendicular to the edge, 14px away
  if (Math.abs(dx) > Math.abs(dy)) {
    // Mostly horizontal — offset vertically
    return { x: dx > 0 ? 14 : -14, y: -10 }
  }
  // Mostly vertical — offset horizontally
  return { x: -14, y: dy > 0 ? 14 : -14 }
}

// ============================================================================
// Utilities
// ============================================================================

// Use shared escapeXml from multiline-utils
const escapeXml = escapeXmlUtil
