/**
 * Detects a Mermaid source's wide (LR/RL) vs. narrow (TD-equivalent)
 * orientation, and rewrites it between the two.
 *
 * Pure string functions with no DOM or build-time dependency, so both
 * demo/client.ts (the interactive gallery, which renders a narrow-viewport
 * alternate live in the browser) and pages.ts (the per-diagram-type SEO
 * pages, which pre-render both variants at build time) import from here
 * instead of duplicating this logic.
 */

/**
 * The line (0-indexed into `source.split('\n')`) whose declared direction
 * controls a wide (`LR`/`RL`) flowchart's or state diagram's overall
 * orientation, or `null` if this source isn't one of those two diagram
 * types, or is but isn't wide.
 *
 * Only flowcharts and state diagrams qualify — those are the two diagram
 * types with a `TD`/`LR`-style orientation to swap; a `TD`/`TB`/`BT`
 * flowchart is already tall-and-narrow, and non-flowchart, non-state
 * diagram types (sequence, ER, class, xychart) don't have an equivalent
 * notion of "orientation" to offer an alternate for.
 *
 * For a flowchart the direction lives in the header line itself (`graph
 * LR`). For a state diagram it's a `direction LR` statement anywhere in
 * the body — mirroring src/parser.ts's parseStateDiagram, only the
 * *top-level* one counts (one inside `state X { … }` overrides that
 * composite state alone), so this tracks composite-state brace depth with
 * the same open/close patterns the real parser uses to find it.
 */
export function wideDiagramDirectionLine(source: string): number | null {
  const lines = source.split('\n')
  const header = (lines[0] ?? '').trim()

  const flowchartMatch = header.match(
    /^(?:graph|flowchart)\s+(TD|TB|LR|BT|RL)\s*$/i,
  )
  if (flowchartMatch) {
    const direction = flowchartMatch[1]!.toUpperCase()
    return direction === 'LR' || direction === 'RL' ? 0 : null
  }

  if (!/^stateDiagram(-v2)?\s*$/i.test(header)) return null

  let compositeDepth = 0
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (compositeDepth === 0) {
      const dirMatch = line.match(/^direction\s+(TD|TB|LR|BT|RL)\s*$/i)
      if (dirMatch) {
        const direction = dirMatch[1]!.toUpperCase()
        return direction === 'LR' || direction === 'RL' ? i : null
      }
    }
    if (/^state\s+(?:"[^"]+"\s+as\s+)?[\w\p{L}]+\s*\{$/u.test(line)) {
      compositeDepth++
    } else if (line === '}') {
      compositeDepth = Math.max(0, compositeDepth - 1)
    }
  }
  return null
}

/**
 * Rewrite the direction word on `lineIndex` (as found by
 * `wideDiagramDirectionLine`) to `TD`, leaving the rest of the source
 * untouched. `TD` is always the target rather than the literal opposite of
 * whatever's declared (`BT` staying `BT`, say) because the goal is
 * specifically "narrow enough for a small screen," not "rotate 180°."
 */
export function withNarrowDirection(source: string, lineIndex: number): string {
  const lines = source.split('\n')
  const target = lines[lineIndex]
  if (target === undefined) return source
  lines[lineIndex] = target.replace(/(TD|TB|LR|BT|RL)(\s*)$/i, 'TD$2')
  return lines.join('\n')
}

/**
 * Give every real `id="…"` in a rendered SVG string a unique prefix, and
 * rewrite the `url(#…)` references (e.g. `marker-end`) that point at them
 * to match. Both an orientation pair's SVGs define the same fixed marker
 * ids (e.g. `arrowhead`, see src/renderer.ts), and IDs must be unique per
 * document; an unprefixed pair would be invalid markup and, per SVG's
 * `url(#id)` resolution rules, fragile if the two definitions ever diverge
 * (a *different* diagram's same-named marker elsewhere on the page is a
 * separate, pre-existing instance of this same pattern — out of scope
 * here, since this only needs the two variants of one diagram to not
 * collide with *each other*).
 *
 * `(?<!data-)\bid=` deliberately excludes `data-id="…"` (used for nodes/
 * edges, e.g. click-interactivity targets) — those aren't `url(#…)`
 * reference targets and don't need rewriting.
 */
export function withUniqueSvgIds(svg: string, prefix: string): string {
  const ids = new Set<string>()
  for (const m of svg.matchAll(/(?<!data-)\bid="([^"]+)"/g)) ids.add(m[1]!)
  let result = svg
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result
      .replace(
        new RegExp(`(?<!data-)\\bid="${escaped}"`, 'g'),
        `id="${prefix}${id}"`,
      )
      .replace(new RegExp(`url\\(#${escaped}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`href="#${escaped}"`, 'g'), `href="#${prefix}${id}"`)
  }
  return result
}
