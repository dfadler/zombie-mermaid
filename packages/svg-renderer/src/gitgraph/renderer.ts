// ============================================================================
// GitGraph SVG renderer
//
// Draws a PositionedGitGraph (see ./layout.ts) in Mermaid's structure: a group
// of branch lines and label boxes, `commit-arrows`, `commit-bullets` and
// `commit-labels` (labels, then tags), with Mermaid's class names
// (`branch0`, `arrow1`, `commit-highlight-outer`, `tag-label-bkg`, ...). Styling
// follows Mermaid's default theme, mapped onto this library's CSS custom
// properties so every theme (and live theme switching through
// `--bg`/`--fg`/`--accent`) applies:
//
//   Mermaid                         here
//   git0..7 branch colours          --git-color-0..7: the theme accent, then
//                                   getSeriesColor() shades of it (as pie does)
//   primaryColor (merge, reverse,   var(--_node-fill)
//     highlight inner)
//   text, tag hole, title           var(--_text) / var(--fg)
//
// Mermaid also leaves two empty groups ahead of the branches (its first pass
// over the commits creates them); they are not drawn. There is no hover or
// interactivity: Mermaid has none for this type.
// ============================================================================

import type {
  PositionedGitGraph,
  PositionedGitShape,
} from '@zombie-mermaid/mermaid-parser'
import type { DiagramColors, SvgEmitOptions } from '@zombie-mermaid/core'
import {
  svgOpenTag,
  paletteClass,
  withRootClass,
  buildStyleBlock,
  styleOpenTag,
  escapeXml,
} from '@zombie-mermaid/core'
import { withDataSrc } from '../renderer.ts'
import { pieColorValue } from '../pie/renderer.ts'

function r(n: number): string {
  return String(Math.round(n * 1e4) / 1e4)
}

const COLORS = 8

function gitStyles(
  colors: DiagramColors,
  nonce?: string,
): { css: string; cls: string } {
  const vars = Array.from(
    { length: COLORS },
    (_, i) => `    --git-color-${i}: ${pieColorValue(i, colors.accent, colors.bg)};`,
  )
  const per = Array.from(
    { length: COLORS },
    (_, i) =>
      `  .branch-label${i} { fill: var(--bg); }\n` +
      `  .commit${i} { stroke: var(--git-color-${i}); fill: var(--git-color-${i}); }\n` +
      `  .commit-highlight${i} { stroke: var(--fg); fill: var(--fg); }\n` +
      `  .label${i} { fill: var(--git-color-${i}); }\n` +
      `  .arrow${i} { stroke: var(--git-color-${i}); }`,
  )
  const cls = paletteClass(vars)
  const css = `${styleOpenTag(nonce)}
  .branch-label { fill: var(--bg); font-size: 16px; }
${per.join('\n')}
  .branch { stroke-width: 1; stroke: var(--_line); stroke-dasharray: 2; }
  .commit-label { font-size: 10px; fill: var(--_text); }
  .commit-label-bkg { fill: var(--_node-fill); opacity: 0.5; }
  .tag-label { font-size: 10px; fill: var(--_text); }
  .tag-label-bkg { fill: var(--_node-fill); stroke: var(--_node-stroke); }
  .tag-hole { fill: var(--fg); }
  .commit-cherry-pick { stroke: var(--_text); fill: var(--_text); }
  circle.commit-cherry-pick[fill] { fill: var(--bg); }
  line.commit-cherry-pick { stroke: var(--bg); }
  .commit-merge { stroke: var(--_node-fill); fill: var(--_node-fill); }
  .commit-reverse { stroke: var(--_node-fill); fill: var(--_node-fill); stroke-width: 3; }
  .commit-highlight-inner { stroke: var(--_node-fill); fill: var(--_node-fill); }
  .arrow { stroke-width: 8; stroke-linecap: round; fill: none; }
  .gitTitleText { text-anchor: middle; font-size: 18px; fill: var(--_text); }
  .branchLabel text, .commit-label, .tag-label { font-family: inherit; }
  .${cls} {
${vars.join('\n')}
  }
</style>`
  return { css, cls }
}

function shapeSvg(s: PositionedGitShape): string {
  const cls = escapeXml(s.cls)
  switch (s.kind) {
    case 'circle':
      return `<circle cx="${r(s.cx)}" cy="${r(s.cy)}" r="${s.r}"${s.fill ? ` fill="${s.fill}"` : ''} class="${cls}"/>`
    case 'rect':
      return `<rect x="${r(s.x)}" y="${r(s.y)}" width="${s.w}" height="${s.h}" class="${cls}"/>`
    case 'path':
      return `<path d="${s.d}" class="${cls}"/>`
    case 'line':
      return `<line x1="${r(s.x1)}" y1="${r(s.y1)}" x2="${r(s.x2)}" y2="${r(s.y2)}"${s.stroke ? ` stroke="${s.stroke}"` : ''} class="${cls}"/>`
  }
}

/**
 * Render a positioned gitGraph as an SVG string.
 *
 * The accessible name is `title` (from `options.title`, or the diagram's own
 * `accTitle` via the front door), as for every type but C4: the visible
 * `title` is not used. It is dropped when `decorative` is set — see svgOpenTag() in
 * packages/core/src/theme.ts.
 */
export function renderGitGraphSvg(
  gg: PositionedGitGraph,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  embedSource?: string,
  title?: string,
  decorative?: boolean,
  emit: SvgEmitOptions = {},
): string {
  const { viewBox: vb } = gg
  const { css, cls } = gitStyles(colors, emit.nonce)
  const parts: string[] = []
  parts.push(
    withDataSrc(
      withRootClass(
        svgOpenTag(
          Number(r(vb.width)),
          Number(r(vb.height)),
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
  )
  parts.push(buildStyleBlock(font, false, emit.nonce, emit.bodyFont))
  parts.push(css)
  parts.push(`<g transform="translate(${r(-vb.x)}, ${r(-vb.y)})">`)

  if (gg.showBranches) {
    parts.push('<g>')
    for (const b of gg.branches) {
      const { line: l, bkg: k } = b
      parts.push(
        `<line x1="${r(l.x1)}" y1="${r(l.y1)}" x2="${r(l.x2)}" y2="${r(l.y2)}" class="branch branch${b.colorIndex}"/>`,
        `<rect class="branchLabelBkg label${b.colorIndex}" rx="4" ry="4" x="${r(k.x)}" y="${r(k.y)}" width="${r(k.w)}" height="${r(k.h)}"${k.tx === undefined ? '' : ` transform="translate(${r(k.tx)}, ${r(k.ty ?? 0)})"`}/>`,
        `<g class="branchLabel"><g class="label branch-label${b.colorIndex}" transform="translate(${r(b.label.x)}, ${r(b.label.y)})"><text>${b.name
          .split(/\\n|\n|<br\s*\/?>/gi)
          .map(
            (row) =>
              `<tspan xml:space="preserve" dy="1em" x="0" class="row">${escapeXml(row.trim())}</tspan>`,
          )
          .join('')}</text></g></g>`,
      )
    }
    parts.push('</g>')
  }

  parts.push('<g class="commit-arrows">')
  for (const a of gg.arrows)
    parts.push(`<path d="${a.d}" class="arrow arrow${a.colorIndex}"/>`)
  parts.push('</g>')

  parts.push('<g class="commit-bullets">')
  for (const c of gg.commits) for (const s of c.shapes) parts.push(shapeSvg(s))
  parts.push('</g>')

  parts.push('<g class="commit-labels">')
  for (const c of gg.commits) {
    const lb = c.label
    if (lb) {
      const tf = lb.rotate ? ` transform="${lb.rotate}"` : ''
      const inner =
        `<rect class="commit-label-bkg" x="${r(lb.rect.x)}" y="${r(lb.rect.y)}" width="${r(lb.rect.w)}" height="${r(lb.rect.h)}"${tf}/>` +
        `<text x="${r(lb.textPos.x)}" y="${r(lb.textPos.y)}" class="commit-label"${tf}>${escapeXml(lb.text)}</text>`
      parts.push(
        lb.groupTransform
          ? `<g transform="${lb.groupTransform}">${inner}</g>`
          : `<g>${inner}</g>`,
      )
    }
    for (const t of c.tags) {
      parts.push(
        `<polygon class="tag-label-bkg" points="${t.points}"${t.polygonTransform ? ` transform="${t.polygonTransform}"` : ''}/>`,
        `<circle cx="${r(t.hole.cx)}" cy="${r(t.hole.cy)}" r="1.5" class="tag-hole"${t.holeTransform ? ` transform="${t.holeTransform}"` : ''}/>`,
        `<text x="${r(t.textPos.x)}" y="${r(t.textPos.y)}" class="tag-label"${t.textTransform ? ` transform="${t.textTransform}"` : ''}>${escapeXml(t.text)}</text>`,
      )
    }
  }
  parts.push('</g>')

  if (gg.title)
    parts.push(
      `<text x="${r(gg.title.x)}" y="${r(gg.title.y)}" class="gitTitleText">${escapeXml(gg.title.text)}</text>`,
    )
  parts.push('</g>', '</svg>')
  return parts.join('\n')
}
