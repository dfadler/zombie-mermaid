import type { MindmapTextRun } from './types.ts'

// ============================================================================
// Mindmap label text
//
// Mermaid renders every mindmap label as Markdown (`labelType: 'markdown'`):
// `**bold**`, `*italic*`, a newline or `<br>` for a line break, and the few
// HTML tags its sanitiser keeps (`<b>`, `<strong>`, `<i>`, `<em>`). Any other
// tag is dropped and its text kept. Unpaired `*` stay literal.
// ============================================================================

const BOLD_ON = ''
const BOLD_OFF = ''
const ITALIC_ON = ''
const ITALIC_OFF = ''
const BREAK = ''

/** Drop every tag but the ones handled below; repeated, so `<<b>x>` cannot leave one behind. */
function stripTags(text: string): string {
  let out = text
  for (let prev = ''; prev !== out;) {
    prev = out
    out = out.replace(/<\/?(?!(?:b|strong|i|em|br)\b)[a-z][^>]*>/gi, '')
  }
  return out
}

/** The label split into lines of styled runs (empty text gives one empty line). */
export function mindmapLabelLines(text: string): MindmapTextRun[][] {
  const marked = stripTags(text)
    .replace(/<br\s*\/?>|\n/gi, BREAK)
    .replace(/<(?:b|strong)>/gi, BOLD_ON)
    .replace(/<\/(?:b|strong)>/gi, BOLD_OFF)
    .replace(/<(?:i|em)>/gi, ITALIC_ON)
    .replace(/<\/(?:i|em)>/gi, ITALIC_OFF)
    .replace(/\*\*(?=\S)(.+?)\*\*/g, `${BOLD_ON}$1${BOLD_OFF}`)
    .replace(/\*(?=\S)(.+?)\*/g, `${ITALIC_ON}$1${ITALIC_OFF}`)

  const lines: MindmapTextRun[][] = [[]]
  let bold = false
  let italic = false
  let buffer = ''
  const flush = () => {
    if (buffer !== '')
      lines[lines.length - 1]!.push({ text: buffer, bold, italic })
    buffer = ''
  }
  for (const ch of marked) {
    if (
      ch === BOLD_ON ||
      ch === BOLD_OFF ||
      ch === ITALIC_ON ||
      ch === ITALIC_OFF
    ) {
      flush()
      if (ch === BOLD_ON) bold = true
      else if (ch === BOLD_OFF) bold = false
      else italic = ch === ITALIC_ON
    } else if (ch === BREAK) {
      flush()
      lines.push([])
    } else {
      buffer += ch
    }
  }
  flush()
  return lines
}

/** The label as plain text lines (no emphasis), for the ASCII renderer. */
export function mindmapPlainLines(text: string): string[] {
  return mindmapLabelLines(text).map((runs) =>
    runs
      .map((run) => run.text)
      .join('')
      .trim(),
  )
}
