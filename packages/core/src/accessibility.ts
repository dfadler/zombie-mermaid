// Mermaid's `accTitle` / `accDescr` statements, read once before any parser
// sees the text. Mermaid documents them for every diagram type
// (https://mermaid.js.org/config/accessibility.html): `accTitle: text` and
// `accDescr: text` on one line, or `accDescr { … }` over several. Pie parses
// its own copy (its grammar is token-based), so it is passed through as-is.
import { detectDiagramType } from './diagram-type.ts'

const ACC = /^[ \t]*acc(Title|Descr)[ \t]*(?::([^\n]*)|\{([^}]*)\})/gm

export interface AccessibleText {
  /** The source with the statements blanked out (line numbers preserved). */
  text: string
  accTitle?: string
  accDescr?: string
}

/**
 * Strip `accTitle` / `accDescr` statements from `text` and return their
 * values (the last of each wins, as in Mermaid). Each removed statement is
 * replaced by the same number of newlines so parser error line numbers stay
 * right. Returns `text` untouched for pie and when there is nothing to strip.
 */
export function extractAccessibility(text: string): AccessibleText {
  const out: AccessibleText = { text }
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
