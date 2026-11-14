// Mermaid's `accTitle` / `accDescr` statements, read once before any parser
// sees the text. Mermaid documents them for every diagram type
// (https://mermaid.js.org/config/accessibility.html): `accTitle: text` and
// `accDescr: text` on one line, or `accDescr { … }` over several. Pie parses
// its own copy (its grammar is token-based), so it is passed through as-is.
import { detectDiagramType, type DiagramType } from './diagram-type.ts'
import {
  readFrontMatterTitle,
  readFrontMatterValue,
  stripFrontMatter,
} from './front-matter.ts'

const ACC = /^[ \t]*acc(Title|Descr)[ \t]*(?::([^\n]*)|\{([^}]*)\})/gm

export interface AccessibleText {
  /** The source with the statements blanked out (line numbers preserved). */
  text: string
  accTitle?: string
  accDescr?: string
  /**
   * A front matter `title:` for flowchart, state, class and ER, which have no
   * title statement; the renderer draws it. Other types get it injected as a
   * `title` statement (see below), so it is unset for them.
   */
  frontMatterTitle?: string
}

// Types with their own `title` statement, and how to spot one in the body.
const OWN_TITLE: Partial<Record<DiagramType, RegExp>> = {
  pie: /^[ \t]*pie\b[^\n"]*\btitle\b|^[ \t]*title\b/m,
  xychart: /^[ \t]*title\b/m,
  quadrant: /^[ \t]*title\b/m,
  gantt: /^[ \t]*title\b/m,
  timeline: /^[ \t]*title\b/m,
  gitgraph: /^[ \t]*title\b/m,
  packet: /^[ \t]*title\b/m,
  radar: /^[ \t]*title\b/m,
  wardley: /^[ \t]*title\b/m,
  // Mermaid's journey keywords are case-insensitive (`TITLE T` is a title).
  journey: /^[ \t]*title\b/im,
  sequence: /^[ \t]*title\b/m,
}
const DRAWN_TITLE: DiagramType[] = ['flowchart', 'class', 'er', 'requirement']

/**
 * Strip `accTitle` / `accDescr` statements from `text` and return their
 * values (the last of each wins, as in Mermaid). Each removed statement is
 * replaced by the same number of newlines so parser error line numbers stay
 * right. Returns `text` untouched for pie and when there is nothing to strip.
 */
export function extractAccessibility(source: string): AccessibleText {
  let text = stripFrontMatter(source)
  const title = readFrontMatterTitle(source)
  const kind = detectDiagramType(text)
  if (title) {
    const own = OWN_TITLE[kind]
    // Mermaid draws the diagram's own title over the front matter one.
    if (own) {
      if (!own.test(text))
        text += `\ntitle ${kind === 'xychart' ? `"${title.replace(/"/g, "'")}"` : title}`
    }
  }
  // Gantt's documented `displayMode: compact` front matter key: hand it to the
  // parser as the init directive it is equivalent to.
  if (
    kind === 'gantt' &&
    readFrontMatterValue(source, 'displayMode') === 'compact'
  ) {
    text += '\n%%{init: {"gantt": {"displayMode": "compact"}}}%%'
  }
  const out: AccessibleText = { text }
  if (title && DRAWN_TITLE.includes(kind)) out.frontMatterTitle = title
  if (
    !/^[ \t]*acc(?:Title|Descr)/m.test(text) ||
    detectDiagramType(text) === 'pie'
  )
    return out
  out.text = text.replace(
    ACC,
    (m, kind: string, one?: string, many?: string) => {
      const value = (
        one !== undefined
          ? one.replace(/%%.*/, '').trim()
          : many!
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .join('\n')
      ).replace(/[\t ]{2,}/g, ' ')
      if (value) out[kind === 'Title' ? 'accTitle' : 'accDescr'] = value
      return '\n'.repeat(m.split('\n').length - 1)
    },
  )
  return out
}
