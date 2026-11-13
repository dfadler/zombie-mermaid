// `maxWidth` (#2057): hard limit; compact retry; unset = unchanged output.
import { describe, expect, it } from 'vitest'
import { AsciiWidthError, renderMermaidASCII } from '../index.ts'
import { maxLineWidth } from '../max-width.ts'

const CHAIN = 'graph LR\n  A --> B --> C --> D --> E'
const LONG =
  'graph LR\n  ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').join(' --> ')
const w = (s: string) => maxLineWidth(s)

function thrown(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}

describe('renderMermaidASCII maxWidth', () => {
  const natural = renderMermaidASCII(CHAIN, { colorMode: 'none' })
  const compact = renderMermaidASCII(CHAIN, {
    colorMode: 'none',
    paddingX: 1,
    paddingY: 1,
    boxBorderPadding: 0,
  })

  it('leaves output untouched when it already fits', () => {
    expect(
      renderMermaidASCII(CHAIN, { colorMode: 'none', maxWidth: w(natural) }),
    ).toBe(natural)
  })

  it('retries with compact spacing when only the natural layout overflows', () => {
    expect(w(compact)).toBeLessThan(w(natural))
    expect(
      renderMermaidASCII(CHAIN, { colorMode: 'none', maxWidth: w(compact) }),
    ).toBe(compact)
  })

  it('throws AsciiWidthError when compact spacing is not enough', () => {
    const err = thrown(() =>
      renderMermaidASCII(CHAIN, { colorMode: 'none', maxWidth: 10 }),
    )
    expect(err).toBeInstanceOf(AsciiWidthError)
    expect(err).toMatchObject({
      name: 'AsciiWidthError',
      code: 'WIDTH_EXCEEDED',
      actualWidth: w(compact),
      maxWidth: 10,
      compactApplied: true,
    })
  })

  it('reports compactApplied: false when explicit spacing is already compact', () => {
    const err = thrown(() =>
      renderMermaidASCII(CHAIN, {
        colorMode: 'none',
        maxWidth: 10,
        paddingX: 1,
        paddingY: 1,
        boxBorderPadding: 0,
      }),
    )
    expect(err).toMatchObject({ compactApplied: false })
  })

  it('does not count ANSI colors or html tags', () => {
    const colored = renderMermaidASCII(CHAIN, { colorMode: 'ansi16' })
    expect(w(colored)).toBe(w(natural))
    expect(
      renderMermaidASCII(CHAIN, { colorMode: 'ansi16', maxWidth: w(natural) }),
    ).toBe(colored)
    expect(
      thrown(() =>
        renderMermaidASCII(CHAIN, { colorMode: 'html', maxWidth: 10 }),
      ),
    ).toBeInstanceOf(AsciiWidthError)
  })

  it('has no default: profile markdown does not imply a limit', () => {
    const md = renderMermaidASCII(LONG, { profile: 'markdown' })
    expect(w(md)).toBeGreaterThan(80)
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects maxWidth %s', (maxWidth) => {
    expect(
      thrown(() => renderMermaidASCII(CHAIN, { maxWidth })),
    ).toBeInstanceOf(RangeError)
  })
})
