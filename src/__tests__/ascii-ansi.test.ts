/**
 * Tests for the ANSI/HTML color utilities in src/ascii/ansi.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  DEFAULT_ASCII_THEME,
  diagramColorsToAsciiTheme,
  detectColorMode,
  getAnsiColor,
  getAnsiReset,
  colorizeChar,
  colorizeLine,
  colorizeText,
} from '../ascii/ansi.ts'
import type { CharRole, AsciiTheme } from '../ascii/types.ts'
import type { DiagramColors } from '../theme.ts'

const RESET = '\x1b[0m'

const theme: AsciiTheme = {
  fg: '#27272a',
  border: '#a1a1aa',
  line: '#71717a',
  arrow: '#52525b',
}

describe('diagramColorsToAsciiTheme', () => {
  it('derives line/border/arrow via color-mix when no enrichment colors are set', () => {
    const colors: DiagramColors = { bg: '#ffffff', fg: '#000000' }
    const result = diagramColorsToAsciiTheme(colors)
    expect(result).toEqual({
      fg: '#000000',
      // mixColors(fg=#000000, bg=#ffffff, 50%) -> 0*.5 + 255*.5 = 128 = 0x80
      border: '#cccccc',
      line: '#808080',
      // mixColors(fg=#000000, bg=#ffffff, 85%) -> 0*.85 + 255*.15 = 38.25 -> 38 = 0x26
      arrow: '#262626',
      accent: undefined,
      bg: '#ffffff',
      corner: '#808080',
      junction: '#cccccc',
    })
  })

  it('uses explicit enrichment colors (line/border/accent) directly, bypassing color-mix', () => {
    const colors: DiagramColors = {
      bg: '#ffffff',
      fg: '#000000',
      line: '#111111',
      border: '#222222',
      accent: '#333333',
    }
    const result = diagramColorsToAsciiTheme(colors)
    expect(result).toEqual({
      fg: '#000000',
      border: '#222222',
      line: '#111111',
      arrow: '#333333',
      accent: '#333333',
      bg: '#ffffff',
      corner: '#111111',
      junction: '#222222',
    })
  })
})

describe('DEFAULT_ASCII_THEME', () => {
  it('matches the documented zinc palette', () => {
    expect(DEFAULT_ASCII_THEME).toEqual({
      fg: '#27272a',
      border: '#a1a1aa',
      line: '#71717a',
      arrow: '#52525b',
      corner: '#71717a',
      junction: '#a1a1aa',
    })
  })
})

describe('detectColorMode', () => {
  const originalIsTTY = process.stdout.isTTY

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    })
    vi.unstubAllEnvs()
  })

  function setTTY(value: boolean | undefined) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value,
      configurable: true,
    })
  }

  it('returns none when stdout is not a TTY (piped/redirected)', () => {
    setTTY(false)
    expect(detectColorMode()).toBe('none')
  })

  it('returns truecolor when COLORTERM=truecolor', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', 'truecolor')
    vi.stubEnv('TERM', 'xterm')
    expect(detectColorMode()).toBe('truecolor')
  })

  it('returns truecolor for COLORTERM=24bit, case-insensitively', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '24BIT')
    vi.stubEnv('TERM', 'xterm')
    expect(detectColorMode()).toBe('truecolor')
  })

  it('returns ansi256 when TERM contains "256color"', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '')
    vi.stubEnv('TERM', 'xterm-256color')
    expect(detectColorMode()).toBe('ansi256')
  })

  it('returns ansi256 when TERM contains "256" without a "color" suffix', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '')
    vi.stubEnv('TERM', 'screen-256')
    expect(detectColorMode()).toBe('ansi256')
  })

  it('returns ansi16 for a basic, non-dumb TERM', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '')
    vi.stubEnv('TERM', 'xterm')
    expect(detectColorMode()).toBe('ansi16')
  })

  it('returns none when TERM=dumb', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '')
    vi.stubEnv('TERM', 'dumb')
    expect(detectColorMode()).toBe('none')
  })

  it('returns none when TERM is unset', () => {
    setTTY(true)
    vi.stubEnv('COLORTERM', '')
    vi.stubEnv('TERM', '')
    expect(detectColorMode()).toBe('none')
  })

  it('returns none when COLORTERM and TERM are entirely absent from env (not just empty)', () => {
    setTTY(true)
    const hadColorTerm = 'COLORTERM' in process.env
    const hadTerm = 'TERM' in process.env
    const prevColorTerm = process.env.COLORTERM
    const prevTerm = process.env.TERM
    delete process.env.COLORTERM
    delete process.env.TERM
    try {
      expect(detectColorMode()).toBe('none')
    } finally {
      if (hadColorTerm) process.env.COLORTERM = prevColorTerm
      if (hadTerm) process.env.TERM = prevTerm
    }
  })

  it('returns html when no process object exists but document is defined', () => {
    // Vitest's own RPC layer relies on the real `process` object (via
    // process.nextTick) outside this synchronous callback, so it must be
    // restored before this test body returns rather than in afterEach.
    const realProcess = globalThis.process
    // @ts-expect-error - simulating a non-Node (browser) environment
    globalThis.process = undefined
    // @ts-expect-error - `document` is not declared in this Node test env
    globalThis.document = {}
    try {
      expect(detectColorMode()).toBe('html')
    } finally {
      globalThis.process = realProcess
      // @ts-expect-error - clean up the simulated global
      delete globalThis.document
    }
  })

  it('returns none when neither process nor document exist', () => {
    const realProcess = globalThis.process
    // @ts-expect-error - simulating an environment with neither process nor document
    globalThis.process = undefined
    try {
      expect(detectColorMode()).toBe('none')
    } finally {
      globalThis.process = realProcess
    }
  })
})

describe('getAnsiColor', () => {
  it('returns an empty string for mode "none"', () => {
    expect(getAnsiColor('text', theme, 'none')).toBe('')
  })

  it('generates a 24-bit truecolor escape sequence', () => {
    expect(getAnsiColor('text', theme, 'truecolor')).toBe('\x1b[38;2;39;39;42m')
  })

  it('resolves the "arrow" role to theme.arrow', () => {
    expect(getAnsiColor('arrow', theme, 'truecolor')).toBe(
      getAnsiColor('text', { ...theme, fg: theme.arrow }, 'truecolor'),
    )
  })

  it('supports 3-digit shorthand hex colors', () => {
    expect(getAnsiColor('text', { ...theme, fg: '#fff' }, 'truecolor')).toBe(
      '\x1b[38;2;255;255;255m',
    )
  })

  it('generates a 256-color escape sequence using the 6x6x6 color cube', () => {
    // #ff0000 is far from grayscale, so it uses the cube: 16 + 36*5 + 6*0 + 0 = 196
    expect(getAnsiColor('text', { ...theme, fg: '#ff0000' }, 'ansi256')).toBe(
      '\x1b[38;5;196m',
    )
  })

  it('generates a 256-color escape sequence for a channel in the mid cube range [48,115)', () => {
    // #500000: r=80 falls in the [48,115) bucket -> index 1; g=b=0 -> index 0
    // index = 16 + 36*1 + 6*0 + 0 = 52
    expect(getAnsiColor('text', { ...theme, fg: '#500000' }, 'ansi256')).toBe(
      '\x1b[38;5;52m',
    )
  })

  it('generates a 256-color grayscale escape sequence when r/g/b are close', () => {
    // #808080 is grayscale: round((128/255)*23) = 12 -> 232 + 12 = 244
    expect(getAnsiColor('text', { ...theme, fg: '#808080' }, 'ansi256')).toBe(
      '\x1b[38;5;244m',
    )
  })

  it('clamps the 256-color grayscale ramp at white and black', () => {
    expect(getAnsiColor('text', { ...theme, fg: '#ffffff' }, 'ansi256')).toBe(
      '\x1b[38;5;255m',
    )
    expect(getAnsiColor('text', { ...theme, fg: '#000000' }, 'ansi256')).toBe(
      '\x1b[38;5;232m',
    )
  })

  it('maps saturated colors to the matching 16-color ANSI code', () => {
    expect(getAnsiColor('text', { ...theme, fg: '#ff0000' }, 'ansi16')).toBe(
      '\x1b[91m', // red, bright (luma < 100)
    )
    expect(getAnsiColor('text', { ...theme, fg: '#00ff00' }, 'ansi16')).toBe(
      '\x1b[32m', // green, not bright (luma > 100)
    )
    expect(getAnsiColor('text', { ...theme, fg: '#ffff00' }, 'ansi16')).toBe(
      '\x1b[33m', // yellow
    )
    expect(getAnsiColor('text', { ...theme, fg: '#0000ff' }, 'ansi16')).toBe(
      '\x1b[94m', // blue, bright
    )
    expect(getAnsiColor('text', { ...theme, fg: '#ff00ff' }, 'ansi16')).toBe(
      '\x1b[35m', // magenta
    )
    expect(getAnsiColor('text', { ...theme, fg: '#00ffff' }, 'ansi16')).toBe(
      '\x1b[36m', // cyan
    )
  })

  it('maps white to bright white and black to bright black in 16-color mode', () => {
    expect(getAnsiColor('text', { ...theme, fg: '#ffffff' }, 'ansi16')).toBe(
      '\x1b[37m',
    )
    expect(getAnsiColor('text', { ...theme, fg: '#000000' }, 'ansi16')).toBe(
      '\x1b[90m',
    )
  })

  it('defaults an ambiguous gray to white in 16-color mode', () => {
    expect(getAnsiColor('text', { ...theme, fg: '#808080' }, 'ansi16')).toBe(
      '\x1b[37m',
    )
  })

  it('returns an empty string for an unhandled mode (html)', () => {
    expect(getAnsiColor('text', theme, 'html')).toBe('')
  })

  it('falls back to line/border for corner/junction roles when unset', () => {
    const noCornerJunction: AsciiTheme = {
      fg: '#27272a',
      border: '#a1a1aa',
      line: '#71717a',
      arrow: '#52525b',
    }
    expect(getAnsiColor('corner', noCornerJunction, 'truecolor')).toBe(
      getAnsiColor('line', noCornerJunction, 'truecolor'),
    )
    expect(getAnsiColor('junction', noCornerJunction, 'truecolor')).toBe(
      getAnsiColor('border', noCornerJunction, 'truecolor'),
    )
  })

  it('uses explicit corner/junction colors when set', () => {
    const withCornerJunction: AsciiTheme = {
      ...theme,
      corner: '#111111',
      junction: '#222222',
    }
    expect(getAnsiColor('corner', withCornerJunction, 'truecolor')).toBe(
      '\x1b[38;2;17;17;17m',
    )
    expect(getAnsiColor('junction', withCornerJunction, 'truecolor')).toBe(
      '\x1b[38;2;34;34;34m',
    )
  })

  it('falls back to fg for an unrecognized role', () => {
    expect(getAnsiColor('bogus' as CharRole, theme, 'truecolor')).toBe(
      getAnsiColor('text', theme, 'truecolor'),
    )
  })
})

describe('getAnsiReset', () => {
  it('returns an empty string for mode "none"', () => {
    expect(getAnsiReset('none')).toBe('')
  })

  it('returns the ANSI reset sequence for color modes', () => {
    expect(getAnsiReset('truecolor')).toBe(RESET)
    expect(getAnsiReset('ansi16')).toBe(RESET)
  })
})

describe('colorizeChar', () => {
  it('returns the character unchanged for mode "none"', () => {
    expect(colorizeChar('A', 'text', theme, 'none')).toBe('A')
  })

  it('returns the character unchanged when role is null', () => {
    expect(colorizeChar('A', null, theme, 'truecolor')).toBe('A')
  })

  it('returns whitespace unchanged even with a valid role and mode', () => {
    expect(colorizeChar(' ', 'text', theme, 'truecolor')).toBe(' ')
  })

  it('wraps a character with its role color and a reset', () => {
    expect(colorizeChar('A', 'text', theme, 'truecolor')).toBe(
      `\x1b[38;2;39;39;42mA${RESET}`,
    )
  })
})

describe('colorizeLine', () => {
  it('joins characters unchanged for mode "none"', () => {
    expect(
      colorizeLine(['A', 'B', 'C'], ['text', 'text', 'border'], theme, 'none'),
    ).toBe('ABC')
  })

  it('returns an empty string for an empty line', () => {
    expect(colorizeLine([], [], theme, 'truecolor')).toBe('')
  })

  it('groups consecutive same-role characters into a single escape sequence', () => {
    const result = colorizeLine(
      ['A', 'B', ' ', 'C'],
      ['text', 'text', null, 'border'],
      theme,
      'truecolor',
    )
    expect(result).toBe(
      `\x1b[38;2;39;39;42mAB${RESET} \x1b[38;2;161;161;170mC${RESET}`,
    )
  })

  it('starts a new group when the role changes without whitespace between', () => {
    const result = colorizeLine(
      ['A', 'B'],
      ['text', 'border'],
      theme,
      'truecolor',
    )
    expect(result).toBe(
      `\x1b[38;2;39;39;42mA${RESET}\x1b[38;2;161;161;170mB${RESET}`,
    )
  })

  it('emits an unroled (null) run as raw text, mid-line', () => {
    const result = colorizeLine(['X', 'Y'], [null, 'text'], theme, 'truecolor')
    expect(result).toBe(`X\x1b[38;2;39;39;42mY${RESET}`)
  })

  it('emits a trailing unroled (null) run as raw text', () => {
    const result = colorizeLine(['A', 'B'], ['text', null], theme, 'truecolor')
    expect(result).toBe(`\x1b[38;2;39;39;42mA${RESET}B`)
  })

  it('emits an unroled (null) run as raw text when flushed by whitespace', () => {
    const result = colorizeLine(
      ['X', ' ', 'Y'],
      [null, null, 'text'],
      theme,
      'truecolor',
    )
    expect(result).toBe(`X \x1b[38;2;39;39;42mY${RESET}`)
  })

  it('handles leading/consecutive whitespace with nothing buffered yet', () => {
    const result = colorizeLine(
      [' ', ' ', 'A'],
      [null, null, 'text'],
      theme,
      'truecolor',
    )
    expect(result).toBe(`  \x1b[38;2;39;39;42mA${RESET}`)
  })

  it('delegates to HTML rendering for mode "html"', () => {
    const result = colorizeLine(['<', '>'], [null, null], theme, 'html')
    expect(result).toBe('&lt;&gt;')
  })
})

describe('colorizeLine — HTML mode', () => {
  it('wraps a colored run in a <span> with an inline color style', () => {
    const result = colorizeLine(['A'], ['border'], theme, 'html')
    expect(result).toBe(`<span style="color:${theme.border}">A</span>`)
  })

  it('escapes HTML-significant characters in both colored and uncolored runs', () => {
    const colored = colorizeLine(['&'], ['text'], theme, 'html')
    expect(colored).toBe(`<span style="color:${theme.fg}">&amp;</span>`)

    const uncolored = colorizeLine(
      ['<', '&', '>'],
      [null, null, null],
      theme,
      'html',
    )
    expect(uncolored).toBe('&lt;&amp;&gt;')
  })

  it('emits whitespace bare, breaking runs without wrapping the space itself', () => {
    const result = colorizeLine(
      ['a', ' ', 'b'],
      ['text', 'text', 'text'],
      theme,
      'html',
    )
    expect(result).toBe(
      `<span style="color:${theme.fg}">a</span> <span style="color:${theme.fg}">b</span>`,
    )
  })
})

describe('colorizeText', () => {
  it('returns text unchanged for mode "none"', () => {
    expect(colorizeText('hello', '#ff0000', 'none')).toBe('hello')
  })

  it('returns an empty string unchanged regardless of mode', () => {
    expect(colorizeText('', '#ff0000', 'truecolor')).toBe('')
  })

  it('wraps text in an HTML span for mode "html"', () => {
    expect(colorizeText('hi', '#ff0000', 'html')).toBe(
      '<span style="color:#ff0000">hi</span>',
    )
  })

  it('wraps text with a truecolor escape sequence and reset', () => {
    expect(colorizeText('hi', '#27272a', 'truecolor')).toBe(
      `\x1b[38;2;39;39;42mhi${RESET}`,
    )
  })

  it('wraps text with a 256-color escape sequence and reset', () => {
    expect(colorizeText('hi', '#ff0000', 'ansi256')).toBe(
      `\x1b[38;5;196mhi${RESET}`,
    )
  })

  it('wraps text with a 16-color escape sequence and reset', () => {
    expect(colorizeText('hi', '#ff0000', 'ansi16')).toBe(`\x1b[91mhi${RESET}`)
  })

  it('returns text unchanged for an unhandled mode', () => {
    expect(colorizeText('hi', '#ff0000', 'bogus' as never)).toBe('hi')
  })
})
