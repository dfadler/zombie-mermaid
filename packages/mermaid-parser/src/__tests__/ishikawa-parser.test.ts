import { describe, expect, it } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseIshikawa } from '../index.ts'
import type { IshikawaNode } from '../index.ts'

/** The tree as nested `[text, children]` pairs, easy to compare. */
const shape = (n?: IshikawaNode): unknown =>
  n && [n.text, n.children.map((c) => shape(c))]

describe('parseIshikawa', () => {
  it('reads the effect, its categories and their causes by indentation', () => {
    const { root } = parseIshikawa(
      'ishikawa\n  Effect\n    A\n      a1\n      a2\n    B',
    )
    expect(shape(root)).toEqual([
      'Effect',
      [
        [
          'A',
          [
            ['a1', []],
            ['a2', []],
          ],
        ],
        ['B', []],
      ],
    ])
  })

  it('accepts ishikawa-beta and any letter case, and a first node on the header line', () => {
    expect(parseIshikawa('ISHIKAWA-Beta\n  E').root?.text).toBe('E')
    expect(parseIshikawa('ishikawa Effect\n  A').root?.children[0]?.text).toBe(
      'A',
    )
    expect(parseIshikawa('ishikawa Effect').root?.text).toBe('Effect')
  })

  it('takes the first line under the effect as depth 1, whatever its indent', () => {
    const { root } = parseIshikawa('ishikawa\n    E\n  A\n    B\n  C')
    expect(shape(root)).toEqual([
      'E',
      [
        ['A', [['B', []]]],
        ['C', []],
      ],
    ])
  })

  it('clamps a line shallower than the first category to depth 1 and attaches skipped levels to the nearest parent', () => {
    const { root } = parseIshikawa(
      'ishikawa\n  E\n      A\n  B\n          b1\n    b2',
    )
    expect(shape(root)).toEqual([
      'E',
      [
        ['A', []],
        ['B', [['b1', []]]],
        ['b2', []],
      ],
    ])
  })

  it('counts a tab as one indent character', () => {
    expect(shape(parseIshikawa('ishikawa\n\tE\n\t\tA\n\t\t\tb').root)).toEqual([
      'E',
      [['A', [['b', []]]]],
    ])
  })

  it('skips blank lines and `%%` comment lines but keeps `%%` inside a label', () => {
    const src = 'ishikawa\n%% c\n  E\n\n    A\n    %% x\n   \n    B %% y\r\n'
    expect(shape(parseIshikawa(src).root)).toEqual([
      'E',
      [
        ['A', []],
        ['B %% y', []],
      ],
    ])
    expect(parseIshikawa('%%{init: {}}%%\n\nishikawa\n  E').root?.text).toBe(
      'E',
    )
  })

  it('has no root when nothing follows the header', () => {
    expect(parseIshikawa('ishikawa\n').root).toBeUndefined()
    expect(parseIshikawa('ishikawa %% c\n').root).toBeUndefined()
  })

  it('sanitizes labels the way Mermaid does', () => {
    const { root } = parseIshikawa('ishikawa\n  A & B\n    <x> & y\n    1 < 2')
    expect(root?.text).toBe('A & B')
    expect(root?.children.map((c) => c.text)).toEqual([' &amp; y', '1 &lt; 2'])
  })

  it('keeps `;` in a label', () => {
    expect(parseIshikawa('ishikawa\n  a; b').root?.text).toBe('a; b')
  })

  it('rejects a source without the header, naming the line', () => {
    expect(() => parseIshikawa('\n\nflowchart TD')).toThrow(
      /Invalid ishikawa header/,
    )
    expect(() => parseIshikawa('')).toThrow(/Invalid ishikawa header/)
    try {
      parseIshikawa('\nfoo')
    } catch (e) {
      expect((e as { line?: number }).line).toBe(2)
    }
  })

  // Measured on mermaid 12.3.0 (scripts/lib/real-mermaid.ts).
  it.each([
    'ishikawa   \n  Effect',
    'ishikawa\t\n  Effect',
    'ishikawa-beta',
    'ishikawa',
    'ishikawa\n\n  Effect',
    'ishikawa\n  \n  Effect',
    'ishikawa\n%% c\n\n  Effect',
    'ishikawa\n\n%% c\n\n  Effect',
  ])('rejects %j as mermaid does', (src) => {
    expect(() => parseIshikawa(src)).toThrow(MermaidParseError)
  })

  it.each([
    'ishikawa\n',
    'ishikawa\n\n',
    'ishikawa Effect',
    'ishikawa  Effect',
    'ishikawa %% c\n  Effect',
    'ishikawa\n\n%% c\n  Effect',
    'ishikawa\n%% c\n  Effect',
    'ishikawa\n  \n%% c\n  Effect',
    'ishikawa\n%% c\n\n%% d\n  Effect',
    'ishikawa\r\n  Effect',
    'ishikawa\n  Effect\n\n\n  ',
  ])('accepts %j as mermaid does', (src) => {
    expect(() => parseIshikawa(src)).not.toThrow()
  })

  it('reads ishikawa.diagramPadding from an init directive', () => {
    const init = (v: string) =>
      parseIshikawa(
        `%%{init: {"ishikawa": {"diagramPadding": ${v}}}}%%\nishikawa\n  E`,
      ).diagramPadding
    expect(init('50')).toBe(50)
    expect(init('"30"')).toBe(30)
    expect(init('-10')).toBe(-10)
    expect(init('"x"')).toBeUndefined()
    expect(parseIshikawa('ishikawa\n  E').diagramPadding).toBeUndefined()
  })
})
