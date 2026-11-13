/**
 * mermaid@12.3.0 wraps a flowchart node label at `flowchart.wrappingWidth`
 * (120px) at word boundaries (#2932). A word wider than that stays whole.
 */
import { measureTextWidth } from '@zombie-mermaid/core'

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
    let cur = ''
    for (const word of para.split(' ').filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && width(next) > FLOWCHART_WRAP_WIDTH) {
        out.push(cur)
        cur = word
        wrapped = true
      } else cur = next
    }
    out.push(cur)
  }
  return { text: out.join('\n'), wrapped }
}
