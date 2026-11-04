// Member text and arrowhead glyph choice for the Mermaid 12.3.0 class box.
import { describe, it, expect } from 'vitest'
import type { ClassNode } from '@zombie-mermaid/mermaid-parser'
import { buildClassSections } from '../class-sections.ts'
import { markerArrowChar } from '../draw-arrows.ts'
import { Down, Left, Right, Up, Middle } from '../types.ts'

const cls = (over: Partial<ClassNode>): ClassNode => ({
  id: 'A',
  label: 'A',
  attributes: [],
  methods: [],
  ...over,
})

describe('buildClassSections member text', () => {
  it('prints Mermaid member forms and keeps empty compartments', () => {
    const [header, attrs, methods] = buildClassSections(
      cls({
        annotation: 'interface',
        attributes: [
          { visibility: '-', name: 'a', type: 'int' },
          { visibility: '+', name: 'b', visibilitySpace: true },
          { visibility: '', name: 'c' },
        ],
        methods: [
          { visibility: '+', name: 'f', isMethod: true, type: 'void' },
          { visibility: '#', name: 'g', isMethod: true, params: 'x, y' },
        ],
      }),
      false,
    )
    expect(header).toEqual(['«interface»', 'A'])
    expect(attrs).toEqual(['-a: int', '+ b', 'c'])
    expect(methods).toEqual(['+f() : void', '#g(x, y)'])
    expect(buildClassSections(cls({}), true)).toEqual([['A'], [], []])
  })

  it('uses <<x>> under useAscii and one header-only box for a note', () => {
    expect(buildClassSections(cls({ annotation: 'x' }), true, true)).toEqual([
      ['<<x>>', 'A'],
    ])
  })
})

describe('markerArrowChar class heads', () => {
  it('draws open V heads in both charsets and hollow triangles only in unicode', () => {
    expect(markerArrowChar(false, 'class-arrow', Up)).toBe('^')
    expect(markerArrowChar(false, 'class-arrow', Down)).toBe('v')
    expect(markerArrowChar(false, 'class-arrow', Left)).toBe('<')
    expect(markerArrowChar(false, 'class-arrow', Right)).toBe('>')
    expect(markerArrowChar(false, 'class-arrow')).toBe('>')
    expect(markerArrowChar(false, 'class-arrow', Middle)).toBe('>')
    expect(markerArrowChar(false, 'class-triangle', Up)).toBe('△')
    expect(markerArrowChar(true, 'class-triangle', Up)).toBe('^')
  })
})
