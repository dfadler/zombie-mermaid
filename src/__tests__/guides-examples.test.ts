/**
 * Executable check that the code examples in docs/guides/ actually work.
 *
 * Documentation examples rot silently — nothing fails when a rename makes a
 * snippet wrong, and a reader who copies it just gets a confusing error. These
 * run the guides' examples against the real API, so a rename breaks the build
 * instead of the reader.
 */
import { describe, it, expect } from 'vitest'
import {
  renderMermaidSVG,
  renderMermaidASCII,
  THEMES,
  fromShikiTheme,
} from '../index.ts'

const SAMPLE = `flowchart TD
  A[Start] --> B{Ready?}
  B -->|Yes| C[Ship]
  B -->|No| D[Fix]
  D --> B`

describe('docs/guides/samples.md examples', () => {
  it('renders the walkthrough diagram to both formats', () => {
    expect(renderMermaidSVG(SAMPLE)).toContain('<svg')
    expect(renderMermaidASCII(SAMPLE)).toContain('Start')
  })

  /**
   * Pins the direction-vs-shape table in samples.md.
   *
   * The guide originally said "prefer LR, terminals are wider than they are
   * tall". That is true for a chain and backwards for a fan-out — this test
   * is what caught it. It now asserts the corrected, shape-dependent advice,
   * so the table cannot drift back to being wrong unnoticed.
   */
  const dimensions = (source: string) => {
    const lines = renderMermaidASCII(source, { colorMode: 'none' }).split('\n')
    return {
      width: Math.max(...lines.map((l) => l.length)),
      height: lines.length,
    }
  }

  it('prefers LR for a chain, as the guide says', () => {
    const chain = (dir: string) =>
      dimensions(`flowchart ${dir}\n  A --> B --> C --> D --> E`)

    // A chain running top-down is tall and thin; left-to-right it is short
    // and wide, which is the shape a terminal has room for.
    expect(chain('LR').height).toBeLessThan(chain('TD').height)
    expect(chain('LR').width).toBeGreaterThan(chain('TD').width)
  })

  it('prefers TD for a fan-out, as the guide says', () => {
    const fan = (dir: string) =>
      dimensions(`flowchart ${dir}\n  A --> B\n  A --> C\n  A --> D\n  A --> E`)

    // The opposite: a fan-out is wide and short top-down, tall left-to-right.
    expect(fan('TD').height).toBeLessThan(fan('LR').height)
  })
})

describe('docs/guides/theming.md examples', () => {
  it('applies a built-in theme by name', () => {
    expect(THEMES['tokyo-night']).toBeDefined()
    expect(renderMermaidSVG(SAMPLE, THEMES['tokyo-night'])).toContain('<svg')
  })

  it('lists exactly the themes the guide names', () => {
    // The guide enumerates all 15 by name; if one is added or renamed the
    // guide is wrong and this fails.
    expect(Object.keys(THEMES).sort()).toEqual(
      [
        'catppuccin-latte',
        'catppuccin-mocha',
        'dracula',
        'github-dark',
        'github-light',
        'nord',
        'nord-light',
        'one-dark',
        'solarized-dark',
        'solarized-light',
        'tokyo-night',
        'tokyo-night-light',
        'tokyo-night-storm',
        'zinc-dark',
        'zinc-light',
      ].sort(),
    )
  })

  it('splits light and dark exactly as the guide claims', () => {
    const luminance = (hex: string): number => {
      const h = hex.replace('#', '')
      return (
        parseInt(h.slice(0, 2), 16) * 0.299 +
        parseInt(h.slice(2, 4), 16) * 0.587 +
        parseInt(h.slice(4, 6), 16) * 0.114
      )
    }
    const light = Object.entries(THEMES).filter(
      ([, c]) => luminance(c.bg) >= 128,
    )
    expect(light).toHaveLength(6)
    expect(Object.keys(THEMES)).toHaveLength(15)
  })

  it('renders mono mode from two colors', () => {
    expect(
      renderMermaidSVG(SAMPLE, { bg: '#1a1b26', fg: '#a9b1d6' }),
    ).toContain('<svg')
  })

  it('accepts partial enrichment without requiring the rest', () => {
    // The guide promises you can override one color and let the others
    // derive; this asserts the omitted ones are not required.
    expect(
      renderMermaidSVG(SAMPLE, {
        bg: '#1a1b26',
        fg: '#a9b1d6',
        accent: '#7aa2f7',
        line: '#3d59a1',
      }),
    ).toContain('<svg')
  })

  it('emits CSS variables through for live theme switching', () => {
    const svg = renderMermaidSVG(SAMPLE, {
      bg: 'var(--background)',
      fg: 'var(--foreground)',
      transparent: true,
    })
    // The whole claim is that colors are not baked in, so the variables must
    // survive into the output.
    expect(svg).toContain('var(--background)')
    expect(svg).toContain('var(--foreground)')
  })

  it('derives a theme from a Shiki theme object', () => {
    const derived = fromShikiTheme({
      type: 'dark',
      colors: {
        'editor.background': '#101010',
        'editor.foreground': '#e0e0e0',
      },
    })
    expect(derived.bg).toBe('#101010')
    expect(derived.fg).toBe('#e0e0e0')
    expect(renderMermaidSVG(SAMPLE, derived)).toContain('<svg')
  })

  it.each(['none', 'ansi16', 'ansi256', 'truecolor', 'html'] as const)(
    'accepts the ASCII colorMode %s that the guide documents',
    (colorMode) => {
      expect(renderMermaidASCII(SAMPLE, { colorMode })).toContain('Start')
    },
  )

  it('emits no escape codes under colorMode none, as the guide advises', () => {
    /*
     * The guide tells readers to use `none` for anything committed to a repo,
     * because escape codes in a README help nobody.
     *
     * ESC is spelled '\u001b' rather than written as a literal control
     * character: a literal ESC in the source is invisible to a reader and got
     * normalized away by the formatter, which silently reduced this assertion
     * to a check for a bare '[' — something the output never contains, so it
     * passed while testing nothing.
     */
    const ESC = '\u001b'
    expect(renderMermaidASCII(SAMPLE, { colorMode: 'none' })).not.toContain(ESC)

    // Sanity check that the assertion is capable of failing: a color mode
    // does emit escape codes.
    expect(renderMermaidASCII(SAMPLE, { colorMode: 'truecolor' })).toContain(
      ESC,
    )
  })
})
