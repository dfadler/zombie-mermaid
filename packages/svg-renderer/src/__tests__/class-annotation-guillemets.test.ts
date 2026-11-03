/**
 * Class SVG annotations are drawn as «name», as mermaid.js 12.2.0 does for
 * `<<interface>>`, not as the source's `<<name>>`.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

describe('class annotation text', () => {
  it.each(['interface', 'abstract', 'enumeration'])(
    '<<%s>> is drawn as «%s»',
    (name) => {
      const svg = renderMermaidSVG(
        `classDiagram\n  class A {\n    <<${name}>>\n    +run()\n  }`,
      )
      expect(svg).toContain(`>«${name}»</text>`)
      expect(svg).not.toContain('&lt;&lt;')
    },
  )
})
