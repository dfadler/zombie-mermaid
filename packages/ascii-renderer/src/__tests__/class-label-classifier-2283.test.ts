/** #2283 in ASCII: the `class Id["Label"]` label is the box title and the classifier is not printed. */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const src = (dir: string) => `classDiagram
  direction ${dir}
  class Pretty["Pretty Label"]
  Pretty : +x int
  class A {
    +size()* int
    +make()$ A
  }
  Pretty --> A`

describe.each([false, true])(
  'ASCII class label and classifier (useAscii=%s)',
  (useAscii) => {
    it.each(['TB', 'LR'])('direction %s', (dir) => {
      const out = renderMermaidASCII(src(dir), { colorMode: 'none', useAscii })
      expect(out).toContain('Pretty Label')
      expect(out).not.toMatch(/Pretty(?! Label)/)
      expect(out).toContain('+ size(): int')
      expect(out).toContain('+ make(): A')
      expect(out).not.toMatch(/[*$]/)
    })
  },
)
