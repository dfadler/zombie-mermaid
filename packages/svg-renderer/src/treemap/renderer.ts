// ============================================================================
// Treemap SVG renderer
//
// Draws a PositionedTreemap (see ./layout.ts) in Mermaid's structure and paint
// order: the title, then every section (header rect, body rect, label, total),
// then every leaf cell (rect, label, value). Styling follows Mermaid's default
// theme, mapped onto this library's CSS custom properties so every theme applies:
//
//   Mermaid                           here
//   cScale1..cScale12 section fill    --tm-fill-N: Mermaid's default-theme scale
//                                     (0.6 opacity); on a dark background the
//                                     theme accent, then getSeriesColor() shades
//   cScalePeer1..12 section stroke    --tm-stroke-N (0.4 opacity, 2px)
//   leaf fill / stroke                its section's colour (0.3 opacity, 3px)
//   labels, values, title             var(--_text)
//
// `classDef` styles `fill`, `stroke` and `stroke-width` (and `color` for the
// text) are applied when their values are safe; other properties are ignored.
// There is no hover or interactivity: Mermaid has none for this type.
// ============================================================================

import type {
  PositionedTreemap,
  PositionedTreemapLabel,
  TreemapStyle,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
  escapeAttr,
  isValidCssColor,
} from '@zombie-mermaid/core'
import { isValidHex, isDarkBackground } from '@zombie-mermaid/mermaid-parser'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

/** Mermaid 12.3.0's default-theme `cScale1..12` / `cScalePeer1..12` hues. */
const HUES = [240, 60, 80, 270, 300, 330, 0, 30, 90, 150, 180, 210] as const
const FILL = (h: number, slot: number): string =>
  `hsl(${h}, 100%, ${slot === 2 ? '73.5294117647' : '76.2745098039'}%)`
const STROKE = (h: number, slot: number): string =>
  `hsl(${h}, 100%, ${slot === 2 ? '48.5294117647' : slot === 3 ? '56.2745098039' : '61.2745098039'}%)`

function r(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function slotColors(
  slot: number,
  colors: DiagramColors,
): { fill: string; stroke: string } {
  if (isValidHex(colors.bg) && isDarkBackground(colors.bg)) {
    const c = pieColorValue(slot - 1, colors.accent, colors.bg)
    return { fill: c, stroke: c }
  }
  const h = HUES[slot - 1]!
  return { fill: FILL(h, slot), stroke: STROKE(h, slot) }
}

/** A colour that is valid and cannot fetch anything: no `url()` paint, no markup. */
const safeColor = (v: string): boolean =>
  isValidCssColor(v) && !/url\(|[;"'<>\\]/i.test(v)

/** The `classDef` items that are safe to inline: colours, a stroke width, a text colour. */
function inlineStyle(styles: TreemapStyle[]): { box: string; text: string } {
  const box: string[] = []
  const text: string[] = []
  for (const { key, value } of styles) {
    if (key === 'fill' || key === 'stroke') {
      if (safeColor(value)) box.push(`${key}:${value}`)
    } else if (key === 'stroke-width' && /^\d+(?:\.\d+)?(?:px)?$/.test(value)) {
      box.push(`${key}:${value}`)
    } else if (key === 'color' && safeColor(value)) {
      text.push(`fill:${value}`)
    }
  }
  return { box: box.join(';'), text: text.join(';') }
}

const styleAttr = (s: string): string => (s ? ` style="${escapeAttr(s)}"` : '')

/**
 * Render a positioned treemap as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door); the visible `title` statement is drawn
 * separately. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderTreemapSvg(
  tm: PositionedTreemap,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const used = [
    ...new Set([
      ...tm.sections.filter((s) => s.depth > 0).map((s) => s.color),
      ...tm.leaves.map((l) => l.color),
    ]),
  ]
    .filter((c) => c > 0)
    .sort((a, b) => a - b)
  const vars = used.flatMap((c) => {
    const { fill, stroke } = slotColors(c, colors)
    return [`    --tm-fill-${c}: ${fill};`, `    --tm-stroke-${c}: ${stroke};`]
  })
  const cls = paletteClass(vars)
  const rules = used.map(
    (c) =>
      `  .tm-c${c} { fill: var(--tm-fill-${c}); stroke: var(--tm-stroke-${c}); }`,
  )

  const parts: string[] = [
    withDataSrc(
      withRootClass(
        svgOpenTag(
          tm.width,
          tm.height,
          colors,
          transparent,
          title,
          decorative,
          undefined,
          emit.styleAttribute,
          emit.description,
        ),
        cls,
      ),
      embedSource,
    ),
    buildStyleBlock(font, false, emit.nonce, emit.bodyFont),
    `${styleOpenTag(emit.nonce)}
  .treemapTitle { fill: var(--_text); font-size: 14px; }
  .treemapSectionHeader { fill: none; fill-opacity: 0.6; stroke-width: 0.6; }
  .treemapSection { fill-opacity: 0.6; stroke-width: 2; stroke-opacity: 0.4; }
  .treemapLeaf { fill-opacity: 0.3; stroke-width: 3; }
  .treemapSectionLabel { fill: var(--_text); font-size: 12px; font-weight: bold; dominant-baseline: middle; }
  .treemapSectionValue { fill: var(--_text); font-size: 10px; font-style: italic; text-anchor: end; dominant-baseline: middle; }
  .treemapLabel { fill: var(--_text); text-anchor: middle; dominant-baseline: middle; }
  .treemapValue { fill: var(--_text); text-anchor: middle; dominant-baseline: hanging; }${
    vars.length > 0 ? `\n  .${cls} {\n${vars.join('\n')}\n  }` : ''
  }
${rules.join('\n')}
</style>`,
  ]

  const text = (
    cls: string,
    l: PositionedTreemapLabel,
    extra = '',
    style = '',
  ): string =>
    `<text class="${cls}" x="${r(l.x)}" y="${r(l.y)}"${extra} font-size="${l.fontSize}"${styleAttr(style)}>${escapeXml(l.text)}</text>`

  parts.push(`<g transform="translate(${r(tm.offsetX)},${r(tm.offsetY)})">`)
  if (tm.title) {
    parts.push(
      `<text class="treemapTitle" x="${r(tm.title.x)}" y="${r(tm.title.y)}" text-anchor="middle" dominant-baseline="middle">${escapeXml(tm.title.text)}</text>`,
    )
  }
  parts.push(
    `<g class="treemapContainer" transform="translate(0,${tm.treeOffsetY})">`,
  )
  for (const s of tm.sections) {
    if (s.depth === 0) continue
    const { box, text: textStyle } = inlineStyle(s.styles)
    parts.push(
      `<g class="treemapSection" transform="translate(${r(s.x)},${r(s.y)})">` +
        `<rect class="treemapSectionHeader" width="${r(s.width)}" height="25"/>` +
        `<rect class="treemapSection${s.color ? ` tm-c${s.color}` : ''}" width="${r(s.width)}" height="${r(s.height)}"${s.color ? '' : ' fill="transparent" stroke="transparent"'}${styleAttr(box)}/>` +
        (s.label.text
          ? text('treemapSectionLabel', s.label, '', textStyle)
          : '') +
        (s.valueLabel
          ? text('treemapSectionValue', s.valueLabel, '', textStyle)
          : '') +
        '</g>',
    )
  }
  for (const l of tm.leaves) {
    const { box, text: textStyle } = inlineStyle(l.styles)
    parts.push(
      `<g class="treemapNode treemapLeafGroup" transform="translate(${r(l.x)},${r(l.y)})">` +
        `<rect class="treemapLeaf${l.color ? ` tm-c${l.color}` : ''}" width="${r(l.width)}" height="${r(l.height)}"${l.color ? '' : ' fill="transparent" stroke="transparent"'}${styleAttr(box)}/>` +
        (l.label ? text('treemapLabel', l.label, '', textStyle) : '') +
        (l.valueLabel
          ? text('treemapValue', l.valueLabel, '', textStyle)
          : '') +
        '</g>',
    )
  }
  parts.push('</g>', '</g>', '</svg>')
  return parts.join('\n')
}
