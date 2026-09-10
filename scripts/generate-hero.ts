/**
 * Regenerates hero.svg (the README's hero image): the site's brand lockup
 * (icon + "ZombieMermaid" wordmark — see docs/brand.md and nav.tsx's
 * NavBrand, which this reproduces at 1:1 scale) atop a before/after
 * "transform" composite — the Hero sample's raw Mermaid source (top)
 * rendered into the Hero sample's actual SVG output (bottom) — matching the
 * demo site's own hero section (see index.ts's hero-transform markup), but
 * stacked instead of side-by-side so it stays legible once GitHub scales it
 * down to a phone-width viewport.
 *
 * The "after" half is rendered through the library's own SVG renderer — the
 * same render path the live demo uses client-side — and nested into the
 * composite as-is, so what ships is exactly what a visitor sees, not a
 * hand-crafted stand-in. The "before" code panel shows the Hero sample's
 * real source verbatim (hand-drawn SVG text, not a screenshot) — including
 * the `@`-edge-id/`animate` syntax the animation actually needs, so what's
 * shown is something a reader could paste in and get this exact result,
 * not a simplified stand-in that would render as a static diagram.
 *
 * hero.svg replaced hero.png (a manually-captured screenshot) once the Hero
 * sample gained a `zm-edge-dash` marching-ants animation: GitHub renders an
 * embedded SVG's CSS `@keyframes` natively, so the README's hero can animate
 * — a static PNG never could.
 *
 * Usage: tsx scripts/generate-hero.ts
 */

import { writeFile } from 'node:fs/promises'
import { samples } from '../samples-data.ts'
import { renderMermaidSVG } from '../src/index.ts'

const WIDTH = 640

// -- Brand lockup (icon + "ZombieMermaid" wordmark) --
// Same geometry/colors/type as the site's own lockup (nav.tsx's NavBrand +
// icons.tsx's LogoMark) — see docs/brand.md's "logo lockup" rule. Rendered
// at 1:1 with the nav's own sizing (30px icon, 12px gap, 20px bold
// wordmark) rather than scaled up for the hero, so this is literally the
// same lockup, not a bigger variant of it.
const LOCKUP_LOGO_SIZE = 30
const LOCKUP_GAP = 12
const LOCKUP_FONT_SIZE = 20
// Measured via getBBox() in a browser against the actual loaded Space
// Grotesk 700 (no DOM/canvas available in this Node script to measure it
// directly) — used only to center the lockup as a whole below, so a small
// drift here (a font substitution, say) just nudges the centering slightly
// rather than breaking anything.
const LOCKUP_WORDMARK_W = 152
const LOCKUP_H = 60
const LOCKUP_BOTTOM_GAP = 18
// The nav bar's own wordmark is near-white (`--text`, #eef1fb) because it
// always sits on the site's dark bar — but a GitHub README renders on
// whatever background the viewer's OS/GitHub theme picks, light included,
// where that near-white text would be unreadable. A backing plate in the
// site's own `--bg` (#0a0d16) keeps the lockup on the same dark ground it
// has on the site, in both README themes, rather than recoloring the text
// away from what docs/brand.md and NavBrand actually use.
const LOCKUP_PLATE_PAD_X = 20
const LOCKUP_PLATE_PAD_Y = 12

// -- "Before" code panel --
const CODE_PANEL_Y = LOCKUP_H + LOCKUP_BOTTOM_GAP
const CODE_PANEL_H = 320
const CODE_TITLEBAR_H = 34

// -- Arrow --
const ARROW_Y = CODE_PANEL_H + 20
const ARROW_H = 34

// -- "After" diagram --
const DIAGRAM_Y = ARROW_Y + ARROW_H + 14
const DIAGRAM_W = 460

// -- Tag row --
const TAG_GAP = 20
const TAG_H = 26
const TAGS = [
  { label: 'SVG', w: 42, brand: false },
  { label: 'ASCII', w: 55, brand: false },
  { label: '16 Themes', w: 83, brand: true },
  { label: 'Animated Edges', w: 118, brand: false },
]

/** Overrides a rendered SVG's root width/height and adds x/y, so it can be nested as a positioned child of an outer composite <svg>. */
function positionNestedSvg(
  svgMarkup: string,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  return svgMarkup
    .replace('<svg ', `<svg x="${x}" y="${y}" `)
    .replace(
      / width="[\d.]+" height="[\d.]+"/,
      ` width="${width}" height="${height}"`,
    )
}

function codeLine(y: number, indent: boolean, tspans: string): string {
  const x = indent ? 40 : 24
  return `  <text x="${x}" y="${y}" font-size="13" style="font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace">${tspans}</text>`
}

function tspan(fill: string, text: string): string {
  return `<tspan style="fill:${fill}">${text}</tspan>`
}

const KEYWORD = '#4493f8'
const FG = '#e6edf3'
const MUTED = '#6e7681'
const VALUE = '#ffa657'

/** Colors one line of the Hero sample's real Mermaid source for the "before" panel. */
function highlightLine(trimmed: string): string {
  if (trimmed === 'stateDiagram-v2') return tspan(KEYWORD, trimmed)

  const direction = /^direction (.+)$/.exec(trimmed)
  if (direction) {
    return tspan(KEYWORD, 'direction') + ' ' + tspan(FG, direction[1] ?? '')
  }

  // e.g. `Layout e4@--> SVG: Vector` — an edge with its animate-target id.
  const edge = /^(\S+) (\S+)@--> (\S+)(?:: (.+))?$/.exec(trimmed)
  if (edge) {
    const [, from, edgeId, to, label] = edge
    const parts = [
      tspan(FG, from ?? ''),
      ' ',
      tspan(MUTED, `${edgeId}@--&gt;`),
      ' ',
      tspan(FG, to ?? ''),
    ]
    if (label) parts.push(tspan(MUTED, ':'), ' ', tspan(VALUE, label))
    return parts.join('')
  }

  // e.g. `e4@{ animate: true }` — the config line an edge id above needs.
  const config = /^(\S+)@\{ (\S+): (.+) \}$/.exec(trimmed)
  if (config) {
    const [, edgeId, key, value] = config
    return [
      tspan(MUTED, `${edgeId}@{`),
      ' ',
      tspan(FG, key ?? ''),
      tspan(MUTED, ':'),
      ' ',
      tspan(VALUE, value ?? ''),
      ' ',
      tspan(MUTED, '}'),
    ].join('')
  }

  return tspan(FG, trimmed)
}

async function main(): Promise<void> {
  const hero = samples.find((s) => s.category === 'Hero')
  if (!hero) {
    throw new Error('No sample with category "Hero" found in samples-data.ts')
  }

  const rendered = renderMermaidSVG(hero.source, hero.options)
  const [, srcW, srcH] =
    /width="([\d.]+)" height="([\d.]+)"/.exec(rendered) ?? []
  if (!srcW || !srcH) {
    throw new Error('Could not read width/height from rendered hero SVG')
  }
  const diagramH = DIAGRAM_W * (Number(srcH) / Number(srcW))
  const diagramX = (WIDTH - DIAGRAM_W) / 2
  const nestedDiagram = positionNestedSvg(
    rendered,
    diagramX,
    DIAGRAM_Y,
    DIAGRAM_W,
    diagramH,
  )

  const tagsY = DIAGRAM_Y + diagramH + TAG_GAP
  const tagsTotalW =
    TAGS.reduce((sum, t) => sum + t.w, 0) + (TAG_GAP / 2) * (TAGS.length - 1)
  let tagX = (WIDTH - tagsTotalW) / 2
  const tagsMarkup = TAGS.map((t) => {
    const rect = `<rect x="${tagX}" y="${tagsY}" width="${t.w}" height="${TAG_H}" rx="${TAG_H / 2}" fill="${t.brand ? 'rgba(149,112,190,0.14)' : 'rgba(59,130,246,0.1)'}"/>`
    const text = `<text x="${tagX + t.w / 2}" y="${tagsY + TAG_H / 2 + 4}" text-anchor="middle" font-size="12" font-weight="600" style="font-family:'Geist',system-ui,sans-serif" fill="${t.brand ? '#9570BE' : '#2563eb'}">${t.label}</text>`
    tagX += t.w + TAG_GAP / 2
    return `  ${rect}\n  ${text}`
  }).join('\n')

  const totalHeight = Math.round(tagsY + TAG_H + 14)
  const codeLines = hero.source.trim().split('\n')

  const lockupContentW = LOCKUP_LOGO_SIZE + LOCKUP_GAP + LOCKUP_WORDMARK_W
  const lockupX = (WIDTH - lockupContentW) / 2
  const lockupIconY = (LOCKUP_H - LOCKUP_LOGO_SIZE) / 2
  const plateW = lockupContentW + LOCKUP_PLATE_PAD_X * 2
  const plateH = LOCKUP_LOGO_SIZE + LOCKUP_PLATE_PAD_Y * 2
  const plateX = lockupX - LOCKUP_PLATE_PAD_X
  const plateY = lockupIconY - LOCKUP_PLATE_PAD_Y
  const lockupMarkup = `<rect x="${plateX}" y="${plateY}" width="${plateW}" height="${plateH}" rx="${plateH / 2}" fill="#0a0d16"/>
<g transform="translate(${lockupX}, 0)">
  <svg x="0" y="${lockupIconY}" width="${LOCKUP_LOGO_SIZE}" height="${LOCKUP_LOGO_SIZE}" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="2" width="9" height="9" rx="3" stroke="#38e0d0" stroke-width="1.6"/>
    <rect x="13" y="2" width="9" height="9" rx="3" stroke="#a374e8" stroke-width="1.6"/>
    <path d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5" stroke="#ff5fa8" stroke-width="1.6" fill="none"/>
  </svg>
  <text x="${LOCKUP_LOGO_SIZE + LOCKUP_GAP}" y="${lockupIconY + LOCKUP_LOGO_SIZE / 2 + 7}" font-size="${LOCKUP_FONT_SIZE}" font-weight="700" style="font-family:'Space Grotesk','Plus Jakarta Sans',sans-serif; letter-spacing:-0.01em" fill="#eef1fb">ZombieMermaid</text>
</g>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${totalHeight}" width="${WIDTH}" height="${totalHeight}" role="img" aria-label="ZombieMermaid: raw Mermaid source rendering into a themed, animated diagram">
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&amp;family=Space+Grotesk:wght@700&amp;family=Plus+Jakarta+Sans:wght@700&amp;display=swap');
  @keyframes hero-readme-arrow-dash { to { stroke-dashoffset: -16; } }
  .hero-readme-arrow-dash { stroke-dasharray: 4 4; animation: hero-readme-arrow-dash 0.9s linear infinite; }
  @media (prefers-reduced-motion: reduce) {
    .hero-readme-arrow-dash { animation: none; }
  }
</style>

<!-- Brand lockup: same icon + "ZombieMermaid" wordmark as the site's nav
     (nav.tsx's NavBrand, icons.tsx's LogoMark); see docs/brand.md. -->
${lockupMarkup}

<!-- "Before": raw Mermaid source, terminal-styled -->
<rect x="0" y="${CODE_PANEL_Y}" width="${WIDTH}" height="${CODE_PANEL_H}" rx="12" fill="#0d1117"/>
<rect x="0" y="${CODE_PANEL_Y}" width="${WIDTH}" height="${CODE_TITLEBAR_H}" rx="12" fill="#161b22"/>
<rect x="0" y="${CODE_PANEL_Y + 12}" width="${WIDTH}" height="${CODE_TITLEBAR_H - 12}" fill="#161b22"/>
<circle cx="16" cy="17" r="5" fill="#ff5f56"/>
<circle cx="32" cy="17" r="5" fill="#ffbd2e"/>
<circle cx="48" cy="17" r="5" fill="#27c93f"/>
<text x="64" y="21" font-size="11" style="font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace" fill="#7d8590">pipeline.mmd</text>
${codeLines
  .map((line, i) => {
    const indent = /^\s/.test(line)
    const y = CODE_TITLEBAR_H + 18 + i * 24 + 10
    return codeLine(y, indent, highlightLine(line.trim()))
  })
  .join('\n')}

<!-- "Renders as" arrow -->
<defs>
  <linearGradient id="hero-readme-arrow-grad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9570BE"/>
    <stop offset="1" stop-color="#3b82f6"/>
  </linearGradient>
</defs>
<g transform="translate(${WIDTH / 2}, ${ARROW_Y})">
  <line x1="0" y1="0" x2="0" y2="20" stroke="url(#hero-readme-arrow-grad)" stroke-width="2.5" stroke-linecap="round" class="hero-readme-arrow-dash"/>
  <path d="M-10 14 L0 28 L10 14" stroke="url(#hero-readme-arrow-grad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</g>

<!-- "After": the actual rendered, animated diagram -->
${nestedDiagram}

<!-- Feature tags -->
${tagsMarkup}
</svg>
`

  const outPath = new URL('../hero.svg', import.meta.url)
  await writeFile(outPath, svg, 'utf8')
  console.log(
    `Wrote hero.svg (${svg.length} bytes) from sample "${hero.title}"`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
