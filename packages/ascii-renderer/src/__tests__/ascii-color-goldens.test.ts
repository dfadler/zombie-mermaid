/**
 * Colour golden files for the ASCII/Unicode renderer.
 *
 * ascii.test.ts's goldens (testdata/ascii, testdata/unicode) are plain text,
 * rendered with no colour. These are the coloured counterpart:
 * testdata/color/<colorMode>/*.txt, one directory per colour mode
 * (ansi16, ansi256, truecolor, html), each file holding the raw output,
 * escape sequences and `<span>` tags included.
 *
 * File format (as in ascii.test.ts, plus two optional header lines):
 *   [theme=<JSON Partial<AsciiTheme>>]   (optional)
 *   [useAscii=true]                      (optional)
 *   <mermaid code>
 *   ---
 *   <expected output>
 *
 * Lines are compared with trailing whitespace trimmed (the repo's
 * .editorconfig strips it from every file); nothing else is normalized.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import type { AsciiTheme, ColorMode } from '@zombie-mermaid/ascii-renderer'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

interface ColorCase {
  mermaid: string
  expected: string
  theme?: Partial<AsciiTheme>
  useAscii: boolean
}

function parseColorCase(content: string): ColorCase {
  const lines = content.split('\n')
  const separator = lines.indexOf('---')
  if (separator < 0) throw new Error('golden file has no --- separator')
  const head = lines.slice(0, separator)
  let theme: Partial<AsciiTheme> | undefined
  let useAscii = false
  while (head.length > 0) {
    const first = head[0]!
    if (first.startsWith('theme=')) {
      theme = JSON.parse(first.slice('theme='.length)) as Partial<AsciiTheme>
    } else if (first === 'useAscii=true') {
      useAscii = true
    } else {
      break
    }
    head.shift()
  }
  const expected = lines.slice(separator + 1).join('\n')
  return {
    mermaid: head.join('\n') + '\n',
    expected: expected.endsWith('\n') ? expected.slice(0, -1) : expected,
    theme,
    useAscii,
  }
}

const trimLines = (s: string): string =>
  s
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')

/** Make escape sequences visible in a failure diff. */
const visible = (s: string): string => s.replaceAll('\x1b', '␛')

const colorDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'testdata',
  'color',
)

const MODES: ColorMode[] = ['ansi16', 'ansi256', 'truecolor', 'html']

for (const mode of MODES) {
  describe(`colour goldens (${mode})`, () => {
    const dir = join(colorDir, mode)
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .sort()

    it('has golden files', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    for (const file of files) {
      it(file.replace('.txt', ''), () => {
        const tc = parseColorCase(readFileSync(join(dir, file), 'utf-8'))
        const actual = renderMermaidASCII(tc.mermaid, {
          colorMode: mode,
          theme: tc.theme,
          useAscii: tc.useAscii,
        })
        expect(visible(trimLines(actual))).toBe(visible(tc.expected))
      })
    }
  })
}
