import { createHash } from 'node:crypto'
import { renderMermaidSVG } from '../../src/index.ts'

export const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
// What our SVG renderer prints as text, to diff against mermaid's labels.
export const ourLabels = (source: string, options: unknown) => {
  try {
    const svg = renderMermaidSVG(source, options as never)
    return [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
      m[1]
        .split(/<[^>]*>/)
        .join('')
        .trim(),
    )
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export const facts = (svg: string) => ({
  nodes: (svg.match(/class="[^"]*\bnode\b/g) ?? []).length,
  // Edge paths carry `edge-thickness-*` (graph-like diagrams) or `messageLine*` (sequence)
  edgePaths: (svg.match(/class="[^"]*\b(?:edge-thickness-|messageLine)/g) ?? [])
    .length,
  markers: [...svg.matchAll(/<marker[^>]*id="([^"]+)"/g)].map((m) => m[1]),
  markerRefs: [
    ...new Set(
      [...svg.matchAll(/marker-(?:start|end)="url\(#([^)]+)\)"/g)].map(
        (m) => m[1],
      ),
    ),
  ],
  text: [...svg.matchAll(/<(?:text|span|p)[^>]*>([^<]+)</g)]
    .map((m) => m[1].trim())
    .filter(Boolean),
})
// Full SVG, so marker/CSS-only changes count; Iconify ids are per-page random noise.
export const norm = (svg: string) =>
  svg.replace(/IconifyId[0-9a-f]+/g, 'IconifyId')
export const hash = (s: string) =>
  createHash('sha1').update(s).digest('hex').slice(0, 10)
