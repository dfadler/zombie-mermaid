/**
 * Journey ASCII/Unicode rendering. Whole-output goldens live in
 * testdata/*\/journey_*.txt.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (text: string, useAscii = false) =>
  renderMermaidASCII(text, { colorMode: 'none', useAscii })

describe('journey ASCII', () => {
  it('lists actors, sections and tasks with faces by score', () => {
    expect(render('journey\nsection S\nA: 5: Me\nB: 3: Me, Cat\nC: 1')).toBe(
      [
        '  Actors: Cat, Me',
        '',
        '  [S]',
        '    :)  5  A  Me',
        '    :|  3  B  Me, Cat',
        '    :(  1  C',
      ].join('\n'),
    )
  })

  it('puts the face boundaries between 2/3 and 3/4', () => {
    expect(render('journey\nA: 4')).toContain(':)  4')
    expect(render('journey\nA: 2')).toContain(':(  2')
    expect(render('journey\nA: 3')).toContain(':|  3')
  })

  it('centres the title and skips the bar for tasks before a section', () => {
    const out = render('journey\ntitle T\nA: 3: X').split('\n')
    expect(out[0]!.trim()).toBe('T')
    expect(out[1]).toBe('')
    expect(out.join('\n')).not.toContain('[')
  })

  it('is identical in ASCII mode (the faces are plain already)', () => {
    expect(render('journey\nA: 4: X', true)).toBe(render('journey\nA: 4: X'))
  })

  it('shows ? for a non-numeric score and a space for <br>', () => {
    const out = render('journey\nA<br>b: x: X')
    expect(out).toContain(':|  ?  A b')
  })

  it('renders a bare journey as nothing but its title', () => {
    expect(render('journey\ntitle Only')).toBe('Only')
  })

  it('drops control characters from source text, keeping its own colour codes', () => {
    const out = render(
      'journey\ntitle T\u001b[2Jx\nsection S\u001b[2J\nA\u001b[2J: 3: Me\u001b[2J',
    )
    expect(out).not.toContain('\u001b')
    expect(out).toContain('T[2Jx')
  })

  it('names empty actors in task rows as in the legend, and aligns wide scores', () => {
    const out = render('journey\nA: 3: Me, \nB: 100: Me')
    expect(out).toContain('Actors: (unnamed), Me')
    expect(out).toContain(':|   3  A  Me, (unnamed)')
    expect(out).toContain(':) 100  B  Me')
  })

  it('lets an upper-case TITLE beat the front-matter title', () => {
    const out = render(
      '---\ntitle: Fallback\n---\njourney\nTITLE Actual\nA: 3: Me',
    )
    expect(out).toContain('Actual')
    expect(out).not.toContain('Fallback')
  })

  it('paints faces in colour modes', () => {
    expect(
      renderMermaidASCII('journey\nA: 4: X', { colorMode: 'truecolor' }),
    ).toContain('\u001b[')
  })
})
