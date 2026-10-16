/**
 * `honorThemeVariables` (#2108): an opt-in mapping of a small subset of
 * Mermaid's `%%{init: {"themeVariables": ...}}%%` onto our colour tokens.
 *
 * Mermaid behaviour relied on (measured, mermaid 12.1.0 and 12.2.0, headless
 * Chromium, computed paint): `primaryColor`/`primaryBorderColor`/
 * `primaryTextColor` apply under `theme: base` only; `lineColor` and
 * `pie1`..`pie12` apply under every theme; `pieN` maps to the Nth slice in
 * source order and wraps after 12; an invalid pie colour paints #333.
 *
 * Every case has an SVG and an ASCII file snapshot in
 * `__theme-variables-snapshots__/` (update with `vitest -u`, review the diff).
 */
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyThemeVariables,
  describeIgnored,
  extractInitConfig,
  parseInitDirective,
} from '@zombie-mermaid/core'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const DIR = join(import.meta.dirname, '__theme-variables-snapshots__')
const init = (tv: Record<string, string>, theme?: string) =>
  `%%{init: ${JSON.stringify({ ...(theme ? { theme } : {}), themeVariables: tv })}}%%`
const flow = (tv: Record<string, string>, theme?: string) =>
  `${init(tv, theme)}\nflowchart LR\n  A[Alpha] --> B[Beta]`
const pie = (tv: Record<string, string>, theme?: string) =>
  `${init(tv, theme)}\npie title Pets\n  "Dogs" : 40\n  "Cats" : 35\n  "Rats" : 25`

const BASE_ALL = {
  primaryColor: '#ff0000',
  primaryBorderColor: '#00aa00',
  primaryTextColor: '#aa00aa',
  lineColor: '#0000ff',
}
const ON = { honorThemeVariables: true } as const

/** [name, source, options]; each gets an SVG and an ASCII file snapshot. */
const cases: Array<
  [string, string, Record<string, unknown>, Record<string, unknown>?]
> = [
  ['flowchart-base-all', flow(BASE_ALL, 'base'), ON],
  ['flowchart-default-theme-line-only', flow(BASE_ALL), ON],
  [
    'flowchart-invalid-ignored',
    flow({ primaryColor: '#12345', lineColor: 'x' }, 'base'),
    ON,
  ],
  [
    'flowchart-unsafe-ignored',
    flow({ primaryColor: 'url(#x)', lineColor: 'red;}' }, 'base'),
    ON,
  ],
  ['flowchart-named-colour', flow({ primaryColor: 'red' }, 'base'), ON],
  [
    'flowchart-caller-wins',
    flow(BASE_ALL, 'base'),
    {
      ...ON,
      surface: '#eeeeee',
      line: '#111111',
      border: '#222222',
      fg: '#333333',
    },
    { ...ON, theme: { line: '#111111', border: '#222222', fg: '#333333' } },
  ],
  [
    'state-base-all',
    `${init(BASE_ALL, 'base')}\nstateDiagram-v2\n  [*] --> A\n  A --> B`,
    ON,
  ],
  [
    'state-default-theme-ignored',
    `${init(BASE_ALL)}\nstateDiagram-v2\n  [*] --> A\n  A --> B`,
    ON,
  ],
  ['flowchart-off', flow(BASE_ALL, 'base'), {}],
  [
    'pie-pie1-3',
    pie({ pie1: '#ff0000', pie2: '#00aa00', pie3: '#0000ff' }),
    ON,
  ],
  [
    'pie-wraps-and-skips-invalid',
    `${init({ pie1: '#ff0000', pie2: 'notacolor', pie12: '#00aa00' })}\npie\n` +
      Array.from({ length: 13 }, (_, i) => `  "S${i + 1}" : ${i + 1}`).join(
        '\n',
      ),
    ON,
  ],
  ['pie-off', pie({ pie1: '#ff0000', pie2: '#00aa00' }), {}],
]

describe('honorThemeVariables: snapshots', () => {
  it.each(cases)('%s', async (name, source, options, asciiOptions) => {
    await expect(renderMermaidSVG(source, options)).toMatchFileSnapshot(
      join(DIR, 'svg', `${name}.svg`),
    )
    await expect(
      renderMermaidASCII(source, {
        ...(asciiOptions ?? options),
        colorMode: 'html',
      }) + '\n',
    ).toMatchFileSnapshot(join(DIR, 'ascii', `${name}.txt`))
  })
})

describe('honorThemeVariables: behaviour', () => {
  it('off by default: output equals the same diagram without variables', () => {
    const plain = 'flowchart LR\n  A[Alpha] --> B[Beta]'
    expect(renderMermaidSVG(flow(BASE_ALL, 'base'))).toBe(
      renderMermaidSVG(plain),
    )
    const p = 'pie title Pets\n  "Dogs" : 40\n  "Cats" : 35\n  "Rats" : 25'
    expect(renderMermaidSVG(pie({ pie1: '#ff0000' }))).toBe(renderMermaidSVG(p))
    for (const [src, base] of [
      [flow(BASE_ALL, 'base'), plain],
      [pie({ pie1: '#ff0000' }), p],
    ] as const) {
      expect(renderMermaidASCII(src, { colorMode: 'html' })).toBe(
        renderMermaidASCII(base, { colorMode: 'html' }),
      )
    }
  })

  it('maps primaryColor/primaryBorderColor/primaryTextColor/lineColor under base', () => {
    const svg = renderMermaidSVG(flow(BASE_ALL, 'base'), ON)
    expect(svg).toMatch(
      /--fg:#aa00aa;--line:#0000ff;--surface:#ff0000;--border:#00aa00/,
    )
  })

  it('reads primary* only under theme base, lineColor under any theme', () => {
    const svg = renderMermaidSVG(flow(BASE_ALL), ON)
    expect(svg).toContain('--line:#0000ff')
    expect(svg).not.toContain('#ff0000')
    expect(svg).not.toContain('--surface:')
    const dark = renderMermaidSVG(flow(BASE_ALL, 'dark'), ON)
    expect(dark).toContain('--line:#0000ff')
    expect(dark).not.toContain('--surface:')
  })

  it('state diagrams read lineColor under theme base only', () => {
    const state = (theme?: string) =>
      `${init({ lineColor: '#0000ff', primaryColor: '#ff0000' }, theme)}\nstateDiagram-v2\n  [*] --> A\n  A --> B`
    expect(renderMermaidSVG(state('base'), ON)).toContain('--line:#0000ff')
    expect(renderMermaidSVG(state('base'), ON)).toContain('--surface:#ff0000')
    expect(renderMermaidSVG(state(), ON)).not.toContain('--line:')
  })

  it('the caller never loses to the diagram', () => {
    const svg = renderMermaidSVG(flow(BASE_ALL, 'base'), {
      ...ON,
      surface: '#eeeeee',
      line: '#111111',
      border: '#222222',
      fg: '#333333',
    })
    expect(svg).toContain(
      '--fg:#333333;--line:#111111;--surface:#eeeeee;--border:#222222',
    )
    expect(svg).not.toMatch(/#ff0000|#00aa00|#aa00aa|#0000ff/)
    const ascii = renderMermaidASCII(flow(BASE_ALL, 'base'), {
      ...ON,
      colorMode: 'html',
      theme: { line: '#111111', border: '#222222', fg: '#333333' },
    })
    expect(ascii).not.toMatch(/#00aa00|#aa00aa|#0000ff/i)
  })

  it('invalid and unsafe values are ignored, never thrown', () => {
    for (const bad of [
      '#12345',
      'notacolor',
      'url(#x)',
      'var(--x)',
      'red;}',
      '"><script>',
      '',
    ]) {
      const svg = renderMermaidSVG(
        flow({ primaryColor: bad, lineColor: bad }, 'base'),
        ON,
      )
      expect(svg).toBe(renderMermaidSVG('flowchart LR\n  A[Alpha] --> B[Beta]'))
    }
  })

  it('pie: pieN follows source order and wraps after 12; others keep the palette', () => {
    const svg = renderMermaidSVG(
      `${init({ pie1: '#ff0000', pie12: '#00aa00' })}\npie\n` +
        Array.from({ length: 13 }, (_, i) => `  "S${i + 1}" : ${i + 1}`).join(
          '\n',
        ),
      ON,
    )
    expect(svg).toContain('--pie-color-0: #ff0000;')
    expect(svg).toContain('--pie-color-11: #00aa00;')
    expect(svg).toContain('class="pie-slice pie-color-0"')
    expect(svg).toMatch(/--pie-color-1: #[0-9a-f]{6};/)
  })

  it('ASCII keeps only hex colours', () => {
    const ascii = renderMermaidASCII(pie({ pie1: 'red', pie2: '#00aa00' }), {
      ...ON,
      colorMode: 'truecolor',
    })
    expect(ascii).toContain('38;2;0;170;0')
    expect(ascii).not.toContain('38;2;255;0;0')
  })

  it('resolveColors sees the directive colours too', () => {
    const svg = renderMermaidSVG(flow(BASE_ALL, 'base'), {
      ...ON,
      resolveColors: true,
    })
    expect(svg).not.toContain('var(--')
    expect(svg).toContain('#ff0000')
  })
})

describe('init-directive: themeVariables parsing', () => {
  it('parses the honoured subset and reports every other key', () => {
    const config = extractInitConfig([
      '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#f00", "secondaryColor": "#0f0", "fontFamily": "x", "pie3": "#00f"}}}%%',
    ])
    expect(config.themeVariables).toEqual({
      primaryColor: '#f00',
      pieColors: { 2: '#00f' },
    })
    expect(config.ignored).toEqual(
      expect.arrayContaining([
        'themeVariables.secondaryColor',
        'themeVariables.fontFamily',
      ]),
    )
    const notes = describeIgnored(config).join('\n')
    expect(notes).toContain('themeVariables.secondaryColor: only primaryColor')
  })

  it('drops primary* when a later directive changes the theme away from base', () => {
    const config = extractInitConfig([
      '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#f00", "lineColor": "#00f"}}}%%',
      '%%{init: {"theme": "dark"}}%%',
    ])
    expect(config.themeVariables).toEqual({ lineColor: '#00f' })
  })

  it('later directives win per variable; pie1..pie12 only', () => {
    const config = extractInitConfig([
      '%%{init: {"themeVariables": {"pie1": "#111", "pie2": "#222"}}}%%',
      '%%{init: {"themeVariables": {"pie1": "#999", "pie13": "#333", "pie0": "#444"}}}%%',
    ])
    expect(config.themeVariables?.pieColors).toEqual({ 0: '#999', 1: '#222' })
    expect(config.ignored).toEqual(
      expect.arrayContaining(['themeVariables.pie13', 'themeVariables.pie0']),
    )
  })

  it('a non-object themeVariables is reported, not applied', () => {
    const config = parseInitDirective('%%{init: {"themeVariables": "x"}}%%')
    expect(config?.themeVariables).toBeUndefined()
    expect(config?.ignored).toEqual(['themeVariables'])
  })

  it('applyThemeVariables fills only unset colours', () => {
    const config = extractInitConfig([flow(BASE_ALL, 'base').split('\n')[0]!])
    expect(applyThemeVariables({ line: '#123456' }, config)).toEqual({
      line: '#123456',
      surface: '#ff0000',
      border: '#00aa00',
      fg: '#aa00aa',
    })
    expect(applyThemeVariables({ bg: '#000' }, undefined)).toEqual({
      bg: '#000',
    })
  })
})
