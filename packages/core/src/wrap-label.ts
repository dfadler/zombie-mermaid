/**
 * mermaid@12.3.0 wraps a flowchart node label at `flowchart.wrappingWidth`
 * (120px) at word boundaries (#2932). A word wider than that stays whole.
 */
import { measureTextWidth } from './text-metrics.ts'

export const FLOWCHART_WRAP_WIDTH = 120

const TAGS = /<\/?(?:b|strong|i|em|u|s|del)\s*>/gi

/**
 * Greedy word wrap of `label` at 120px. Returns the label with `\n` at each
 * line break, and whether any paragraph (a `\n`-separated line) had to wrap.
 */
export function wrapFlowchartLabel(
  label: string,
  fontSize: number,
  fontWeight: number,
): { text: string; wrapped: boolean } {
  const width = (s: string): number =>
    measureTextWidth(s.replace(TAGS, ''), fontSize, fontWeight)
  let wrapped = false
  const out: string[] = []
  for (const para of label.split('\n')) {
    const lines: string[] = []
    let cur = ''
    for (const word of para.split(' ').filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && width(next) > FLOWCHART_WRAP_WIDTH) {
        lines.push(cur)
        cur = word
        wrapped = true
      } else cur = next
    }
    lines.push(cur)
    out.push(...keepFormatting(lines))
  }
  return { text: out.join('\n'), wrapped }
}

/**
 * The renderers parse inline formatting one line at a time, so a tag that
 * stays open across a wrap break is closed at the end of its line and opened
 * again at the start of the next.
 */
function keepFormatting(lines: string[]): string[] {
  if (lines.length < 2) return lines
  const open: string[] = []
  return lines.map((line) => {
    const prefix = open.map((t) => `<${t}>`).join('')
    for (const m of line.matchAll(TAGS)) {
      const tag = /<\/?(\w+)/.exec(m[0])![1]!.toLowerCase()
      if (m[0][1] === '/') {
        const at = open.lastIndexOf(tag)
        if (at >= 0) open.splice(at, 1)
      } else open.push(tag)
    }
    const suffix = [...open]
      .reverse()
      .map((t) => `</${t}>`)
      .join('')
    return prefix + line + suffix
  })
}
