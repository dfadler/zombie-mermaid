import { describe, expect, it } from 'vitest'
import { rehypeMermaid, remarkMermaid } from '../src/remark.ts'

const SRC = 'graph TD\n  A --> B'

describe('remarkMermaid (#1875)', () => {
  it('replaces mermaid code nodes (nested too) with an svg html node', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'code', lang: 'ts', value: 'x' },
        {
          type: 'blockquote',
          children: [{ type: 'code', lang: 'mermaid', value: SRC }],
        },
      ],
    }
    remarkMermaid()(tree)
    expect(tree.children[0]).toEqual({ type: 'code', lang: 'ts', value: 'x' })
    const html = (
      tree.children[1] as { children: { type: string; value: string }[] }
    ).children[0]!
    expect(html.type).toBe('html')
    expect(html.value).toMatch(/^<svg[\s>]/)
  })

  it('forwards render options', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'code', lang: 'mermaid', value: SRC }],
    }
    remarkMermaid({ render: { bg: '#123456' } })(tree)
    expect((tree.children[0] as { value: string }).value).toContain('#123456')
  })
})

describe('rehypeMermaid (#1875)', () => {
  const pre = (cls: string[], text: string) => ({
    type: 'element',
    tagName: 'pre',
    children: [
      { type: 'text', value: '\n' },
      {
        type: 'element',
        tagName: 'code',
        properties: { className: cls },
        children: [{ type: 'text', value: text }],
      },
    ],
  })

  it('replaces pre>code.language-mermaid with a raw svg node, leaves others', () => {
    const tree = {
      type: 'root',
      children: [pre(['language-mermaid'], SRC), pre(['language-ts'], 'x')],
    }
    rehypeMermaid()(tree)
    expect(tree.children[0]!.type).toBe('raw')
    expect((tree.children[0] as unknown as { value: string }).value).toMatch(
      /^<svg[\s>]/,
    )
    expect(tree.children[1]!.type).toBe('element')
  })
})
