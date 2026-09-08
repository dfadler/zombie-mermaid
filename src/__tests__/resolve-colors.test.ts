import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidSVGAsync } from '../index.ts'
import { THEMES, MIX, DEFAULTS, mixHexColors } from '@zombie-mermaid/core'
import { evaluateCssColorValue, resolveCssColors } from '../resolve-colors.ts'
import { diagramColorsToAsciiTheme } from '../ascii/ansi.ts'

/**
 * Escape regex metacharacters so a value can be interpolated into a
 * `RegExp` literally. The one call site below always passes a hardcoded
 * `--_*` CSS custom-property name, never untrusted input. Semgrep's
 * detect-non-literal-regexp rule flags any `new RegExp()` built from a
 * template literal regardless of escaping (it's a syntactic check, not a
 * taint one that would credit the escaping), so that call site still needs
 * a scoped `nosemgrep` — this helper is what makes that suppression
 * actually sound rather than just quiet.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// Fixtures — one diagram per supported type, each exercising the
// theme-derived variables (subgraph header, edge label, notes, ER key
// badge, xychart series colors) so every `--_*` declaration is referenced.
// ============================================================================

const DIAGRAMS: Record<string, string> = {
  flowchart: `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]
  subgraph Group
    C --> D
  end
  style A fill:#f9f`,
  sequence: `sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!
  Note over Alice: a note
  alt yes
    Alice->>Bob: ok
  end`,
  state: `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing: start
  Processing --> [*]`,
  class: `classDiagram
  Animal <|-- Duck
  Animal: +int age
  Duck: +swim()`,
  er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string name PK
    int id
  }`,
  xychart: `xychart-beta
  title "Sales"
  x-axis [jan, feb]
  y-axis "Rev" 0 --> 120
  bar [50, 60]
  line [30, 70]`,
}

/** Any `var(` or `color-mix(` call left in the output. */
const CSS_FUNCTION_RE = /\b(?:var|color-mix)\(/

// ============================================================================
// Expression evaluator — one case per form the renderer actually emits
// (enumerated by grepping src/ for `var(` and `color-mix(`).
// ============================================================================

describe('evaluateCssColorValue', () => {
  const base = { '--bg': '#ffffff', '--fg': '#000000' }

  it('resolves a plain var() reference', () => {
    expect(evaluateCssColorValue('var(--fg)', base)).toBe('#000000')
  })

  it('resolves a chain of var() declarations (--_text: var(--fg))', () => {
    expect(
      evaluateCssColorValue('var(--_text)', {
        ...base,
        '--_text': 'var(--fg)',
      }),
    ).toBe('#000000')
  })

  it('evaluates color-mix(in srgb, A p%, B) with one percentage', () => {
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, var(--fg) 25%, var(--bg))',
        base,
      ),
    ).toBe('#bfbfbf')
  })

  it('evaluates color-mix(in srgb, A p%, B q%) with both percentages (xychart bar fill)', () => {
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, var(--bg) 75%, var(--xychart-color-0) 25%)',
        { ...base, '--xychart-color-0': 'var(--accent, #3b82f6)' },
      ),
    ).toBe('#cee0fd')
  })

  it('evaluates color-mix toward transparent as an rgba() with reduced alpha (xychart tooltip shadow)', () => {
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, var(--fg) 20%, transparent)',
        base,
      ),
    ).toBe('rgba(0, 0, 0, 0.2)')
  })

  it('uses the enrichment override when declared, else the color-mix fallback (--_line pattern)', () => {
    const expr = `var(--line, color-mix(in srgb, var(--fg) ${MIX.line}%, var(--bg)))`
    expect(evaluateCssColorValue(expr, base)).toBe('#808080')
    expect(evaluateCssColorValue(expr, { ...base, '--line': '#123456' })).toBe(
      '#123456',
    )
  })

  it('uses a literal var() fallback when the variable is undeclared', () => {
    expect(evaluateCssColorValue('var(--accent, #3b82f6)', base)).toBe(
      '#3b82f6',
    )
  })

  it('resolves inside a larger value (drop-shadow(...))', () => {
    expect(
      evaluateCssColorValue(
        'drop-shadow(0 1px 3px color-mix(in srgb, var(--fg) 20%, transparent))',
        base,
      ),
    ).toBe('drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2))')
  })

  it('leaves an undeclared var() with no fallback untouched (host-page font variable)', () => {
    expect(
      evaluateCssColorValue('var(--font-family-body), system-ui', base),
    ).toBe('var(--font-family-body), system-ui')
  })

  it('leaves a color-mix() in an unsupported color space untouched', () => {
    expect(
      evaluateCssColorValue(
        'color-mix(in oklch, var(--fg) 50%, var(--bg))',
        base,
      ),
    ).toBe('color-mix(in oklch, #000000 50%, #ffffff)')
  })

  it('leaves a color-mix() whose operand is not a concrete color untouched', () => {
    expect(
      evaluateCssColorValue('color-mix(in srgb, red 50%, var(--bg))', base),
    ).toBe('color-mix(in srgb, red 50%, #ffffff)')
  })

  it('terminates on a cyclic declaration instead of recursing forever', () => {
    expect(
      evaluateCssColorValue('var(--a)', {
        '--a': 'var(--b)',
        '--b': 'var(--a)',
      }),
    ).toBe('var(--a)')
  })

  it('does not match identifiers that merely end in var( or color-mix(', () => {
    expect(evaluateCssColorValue('url(#myvar(--fg))', base)).toBe(
      'url(#myvar(--fg))',
    )
  })

  it('evaluates a color-mix() nested inside another color-mix() operand', () => {
    // Inner: mix(black, white, 50%) = #808080. Outer: mix(#808080, white, 50%)
    // = (128+255)/2 = 191.5 → rounds to 192 = #c0c0c0.
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, color-mix(in srgb, var(--fg) 50%, var(--bg)) 50%, var(--bg))',
        base,
      ),
    ).toBe('#c0c0c0')
  })

  it('leaves a color-mix() with the wrong number of operands untouched', () => {
    // Only one color operand — not the two `color-mix()` requires. The
    // inner var() is still evaluated (the fallback keeps as much resolved
    // as possible), but the malformed color-mix() itself is left in place
    // rather than guessed at.
    expect(
      evaluateCssColorValue('color-mix(in srgb, var(--fg) 50%)', base),
    ).toBe('color-mix(in srgb, #000000 50%)')
  })

  it('leaves an unclosed var()/color-mix() call untouched instead of throwing', () => {
    // No matching `)` — matchingParen runs off the end of the string and
    // reports "unbalanced" (-1). That aborts the whole scan (there's no
    // point looking for further calls once one can't be closed), so the
    // text — including any nested var() it contains — is left verbatim
    // rather than guessed at.
    expect(evaluateCssColorValue('var(--fg', base)).toBe('var(--fg')
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, var(--fg) 50%, var(--bg)',
        base,
      ),
    ).toBe('color-mix(in srgb, var(--fg) 50%, var(--bg)')
  })

  it('leaves a color-mix() operand carrying two percentages untouched', () => {
    // "10% 20%" isn't a valid `<color> [<percentage>]` operand — two
    // percentage tokens for one color is malformed, so the whole
    // expression is left as-is.
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, #ff0000 10% 20%, var(--bg))',
        base,
      ),
    ).toBe('color-mix(in srgb, #ff0000 10% 20%, #ffffff)')
  })

  it('leaves a color-mix() operand carrying two colors untouched', () => {
    // "#ff0000 #00ff00" isn't a valid operand either — one color per
    // operand, at most one percentage.
    expect(
      evaluateCssColorValue(
        'color-mix(in srgb, #ff0000 #00ff00, var(--bg))',
        base,
      ),
    ).toBe('color-mix(in srgb, #ff0000 #00ff00, #ffffff)')
  })

  it('leaves a color-mix() operand carrying only a percentage (no color) untouched', () => {
    expect(
      evaluateCssColorValue('color-mix(in srgb, 50%, var(--bg))', base),
    ).toBe('color-mix(in srgb, 50%, #ffffff)')
  })

  it('leaves a color-mix() whose percentages both mix to zero untouched (invalid per spec)', () => {
    // mixSrgb() returns null when both percentages are zero; evaluateColorMix
    // must not substitute anything for it in that case.
    expect(
      evaluateCssColorValue('color-mix(in srgb, #ff0000 0%, #0000ff 0%)', base),
    ).toBe('color-mix(in srgb, #ff0000 0%, #0000ff 0%)')
  })
})

// ============================================================================
// Whole-document pass
// ============================================================================

describe('resolveCssColors', () => {
  it('rewrites attribute values and <style> blocks but not text content', () => {
    const svg =
      '<svg style="--bg:#fff;--fg:#000;background:var(--bg)">' +
      '<style>svg { --_line: color-mix(in srgb, var(--fg) 50%, var(--bg)); } .e { stroke: var(--_line); }</style>' +
      '<path stroke="var(--_line)"/>' +
      '<text fill="var(--fg)">see var(--fg) in prose</text>' +
      '</svg>'
    const out = resolveCssColors(svg, { bg: '#fff', fg: '#000' })
    expect(out).toContain('background:#fff')
    expect(out).toContain('--_line: #808080;')
    expect(out).toContain('.e { stroke: #808080; }')
    expect(out).toContain('<path stroke="#808080"/>')
    expect(out).toContain('<text fill="#000">see var(--fg) in prose</text>')
  })

  it('never touches the data-src source stamp', () => {
    const svg =
      '<svg data-src="style A fill:var(--fg)" style="--bg:#fff;--fg:#000"><g fill="var(--fg)"/></svg>'
    const out = resolveCssColors(svg, { bg: '#fff', fg: '#000' })
    expect(out).toContain('data-src="style A fill:var(--fg)"')
    expect(out).toContain('<g fill="#000"/>')
  })

  it('reads declarations that appear later in the document', () => {
    const svg =
      '<svg><rect fill="var(--late)"/><style>svg { --late: #abcdef; }</style></svg>'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toContain(
      '<rect fill="#abcdef"/>',
    )
  })

  it('returns an empty string unchanged for empty input', () => {
    expect(resolveCssColors('', { bg: '#fff', fg: '#000' })).toBe('')
  })

  it('leaves an SVG with zero var()/color-mix() occurrences byte-identical', () => {
    const svg =
      '<svg><rect fill="#ff0000" stroke="rgb(1, 2, 3)"/><text>plain text</text></svg>'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toBe(svg)
  })

  it('seeds --surface and --border custom properties when the caller supplies them', () => {
    const svg =
      '<svg><rect fill="var(--surface)" stroke="var(--border)"/></svg>'
    const out = resolveCssColors(svg, {
      bg: '#fff',
      fg: '#000',
      surface: '#eeeeee',
      border: '#cccccc',
    })
    expect(out).toContain('<rect fill="#eeeeee" stroke="#cccccc"/>')
  })

  it('preserves trailing text after the last tag instead of dropping it', () => {
    const svg = '<svg><rect fill="var(--fg)"/></svg>\ntrailing'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toBe(
      '<svg><rect fill="#000"/></svg>\ntrailing',
    )
  })

  it('stops rewriting at an unterminated <style> block instead of throwing', () => {
    const svg = '<svg><style>svg { --x: var(--fg); }'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toBe(svg)
  })

  it('stops rewriting at an unterminated <style> start tag instead of throwing', () => {
    const svg = '<svg><style'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toBe(svg)
  })

  it('stops rewriting at an unterminated element start tag instead of throwing', () => {
    const svg = '<svg><rect fill="var(--fg)"'
    expect(resolveCssColors(svg, { bg: '#fff', fg: '#000' })).toBe(svg)
  })
})

// ============================================================================
// RenderOptions.resolveColors — end to end
// ============================================================================

describe('renderMermaidSVG({ resolveColors: true })', () => {
  const themeEntries = [['default', {}], ...Object.entries(THEMES)] as const

  for (const [name, source] of Object.entries(DIAGRAMS)) {
    for (const [themeName, colors] of themeEntries) {
      it(`leaves no var()/color-mix() in a ${name} diagram with the ${themeName} theme`, () => {
        const svg = renderMermaidSVG(source, { ...colors, resolveColors: true })
        expect(svg).not.toMatch(CSS_FUNCTION_RE)
        expect(svg).toContain('<svg')
      })
    }
  }

  it('leaves no var()/color-mix() under interactivity: full and transparent', () => {
    for (const source of Object.values(DIAGRAMS)) {
      expect(
        renderMermaidSVG(source, {
          resolveColors: true,
          interactivity: 'full',
        }),
      ).not.toMatch(CSS_FUNCTION_RE)
      expect(
        renderMermaidSVG(source, { resolveColors: true, transparent: true }),
      ).not.toMatch(CSS_FUNCTION_RE)
    }
  })

  it('is off by default — the live-themeable output still uses var()/color-mix()', () => {
    const svg = renderMermaidSVG(DIAGRAMS.flowchart ?? '')
    expect(svg).toMatch(CSS_FUNCTION_RE)
    expect(
      renderMermaidSVG(DIAGRAMS.flowchart ?? '', { resolveColors: false }),
    ).toMatch(CSS_FUNCTION_RE)
  })

  it('derives --_line etc. from the same MIX table the <style> block declares (no copied numbers)', () => {
    const colors = { bg: DEFAULTS.bg, fg: DEFAULTS.fg }
    const svg = renderMermaidSVG(DIAGRAMS.flowchart ?? '', {
      ...colors,
      resolveColors: true,
    })
    const declared = (name: string): string | undefined => {
      const pattern = `${escapeRegExp(name)}:\\s*(#[0-9a-f]{6})`
      return new RegExp(pattern, 'i').exec(svg)?.[1] // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    }

    expect(declared('--_line')).toBe(
      mixHexColors(colors.fg, colors.bg, MIX.line),
    )
    expect(declared('--_arrow')).toBe(
      mixHexColors(colors.fg, colors.bg, MIX.arrow),
    )
    expect(declared('--_node-stroke')).toBe(
      mixHexColors(colors.fg, colors.bg, MIX.nodeStroke),
    )
    expect(declared('--_text-muted')).toBe(
      mixHexColors(colors.fg, colors.bg, MIX.textMuted),
    )
    // And the ASCII bridge — the other consumer of MIX — agrees exactly.
    const ascii = diagramColorsToAsciiTheme(colors)
    expect(declared('--_line')).toBe(ascii.line)
    expect(declared('--_arrow')).toBe(ascii.arrow)
    expect(declared('--_node-stroke')).toBe(ascii.border)
  })

  it('honors enrichment colors over the color-mix fallback', () => {
    const tokyo = THEMES['tokyo-night']
    if (tokyo === undefined) throw new Error('tokyo-night theme missing')
    const svg = renderMermaidSVG(DIAGRAMS.flowchart ?? '', {
      ...tokyo,
      resolveColors: true,
    })
    expect(svg).toContain(`--_line:          ${tokyo.line}`)
    expect(svg).toContain(`--_arrow:         ${tokyo.accent}`)
    expect(svg).toContain(`--_text-muted:    ${tokyo.muted}`)
  })

  it('keeps the embedSource stamp verbatim even when the source mentions var()', () => {
    const source = `graph TD\n  A[uses var(--fg)] --> B`
    const svg = renderMermaidSVG(source, {
      resolveColors: true,
      embedSource: true,
    })
    expect(svg).toContain(
      'data-src="graph TD&#10;  A[uses var(--fg)] --&gt; B"',
    )
    expect(svg).toContain('uses var(--fg)')
    // Only the label text and the stamp keep it — every CSS use is resolved.
    expect(
      svg.replace(/data-src="[^"]*"/, '').replace(/>[^<]*</g, '><'),
    ).not.toMatch(CSS_FUNCTION_RE)
  })

  it('leaves a caller-supplied var() color it cannot know the value of', () => {
    const svg = renderMermaidSVG(DIAGRAMS.flowchart ?? '', {
      bg: 'var(--background)',
      fg: '#000',
      resolveColors: true,
    })
    expect(svg).toContain('--bg:var(--background)')
    // Mixes against it can't be evaluated, so their fallbacks stay put too.
    expect(svg).toMatch(CSS_FUNCTION_RE)
  })

  it('resolves colors through renderMermaidSVGAsync too, not just the sync entry point', async () => {
    const svg = await renderMermaidSVGAsync(DIAGRAMS.flowchart ?? '', {
      resolveColors: true,
    })
    expect(svg).not.toMatch(CSS_FUNCTION_RE)
    expect(svg).toContain('<svg')
  })
})
