/**
 * An LR decision (diamond) split two ways sends both branches out of its right
 * face and into the left face of each child, as mermaid's ports do on
 * 12.1.0 and 12.2.0 (#2351), instead of out of its top and bottom faces.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (src: string, useAscii = false): string =>
  renderMermaidASCII(src, { colorMode: 'none', useAscii })
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')

const LR = `graph LR
  A --> B{Ok?}
  B -->|yes| C
  B -->|no| D`

describe('LR decision node branches leave the right face (#2351)', () => {
  it('draws yes/no from the right face (unicode)', () => {
    expect(render(LR)).toBe(
      [
        '                       ┌───┐',
        '                       │   │',
        '                    ┌─►│ C │',
        '                    │  │   │',
        '                    │  └───┘',
        '                    │',
        '                   yes',
        '                    │',
        '                    │',
        '┌───┐        ╱╲     │',
        '│   │       ╱  ╲    │',
        '│ A ├────►< Ok?  >──┤',
        '│   │       ╲  ╱    │',
        '└───┘        ╲╱     │',
        '                    │',
        '                   no',
        '                    │',
        '                    │',
        '                    │  ┌───┐',
        '                    │  │   │',
        '                    └─►│ D │',
        '                       │   │',
        '                       └───┘',
      ].join('\n'),
    )
  })

  it('draws yes/no from the right face (ASCII)', () => {
    expect(render(LR, true)).toBe(
      [
        '                       +---+',
        '                       |   |',
        '                    +->| C |',
        '                    |  |   |',
        '                    |  +---+',
        '                    |',
        '                   yes',
        '                    |',
        '                    |',
        '+---+        /\\     |',
        '|   |       /  \\    |',
        '| A +---->< Ok?  >--+',
        '|   |       \\  /    |',
        '+---+        \\/     |',
        '                    |',
        '                   no',
        '                    |',
        '                    |',
        '                    |  +---+',
        '                    |  |   |',
        '                    +->| D |',
        '                       |   |',
        '                       +---+',
      ].join('\n'),
    )
  })

  it('mirrors in RL', () => {
    expect(render(LR.replace('graph LR', 'graph RL'))).toBe(
      [
        '┌───┐',
        '│   │',
        '│ C │◄─┐',
        '│   │  │',
        '└───┘  │',
        '       │',
        '      yes',
        '       │',
        '       │',
        '       │     ╱╲        ┌───┐',
        '       │    ╱  ╲       │   │',
        '       ├──< Ok?  >◄────┤ A │',
        '       │    ╲  ╱       │   │',
        '       │     ╲╱        └───┘',
        '       │',
        '       no',
        '       │',
        '       │',
        '┌───┐  │',
        '│   │  │',
        '│ D │◄─┘',
        '│   │',
        '└───┘',
      ].join('\n'),
    )
  })

  it('leaves the faces of an unlabelled two-way decision on the right too', () => {
    expect(render('graph LR\n  A --> B{Ok?}\n  B --> C\n  B --> D')).toBe(
      [
        '                       ┌───┐',
        '                       │   │',
        '                    ┌─►│ C │',
        '                    │  │   │',
        '┌───┐        ╱╲     │  └───┘',
        '│   │       ╱  ╲    │',
        '│ A ├────►< Ok?  >──┤',
        '│   │       ╲  ╱    │',
        '└───┘        ╲╱     │  ┌───┐',
        '                    │  │   │',
        '                    └─►│ D │',
        '                       │   │',
        '                       └───┘',
      ].join('\n'),
    )
  })

  it('keeps a plain box fanning out through its top and bottom faces', () => {
    expect(render('graph LR\n  A --> B\n  A --> C')).toBe(
      [
        '          ┌───┐',
        '          │   │',
        '  ┌──────►│ B │',
        '  │       │   │',
        '┌─┴─┐     └───┘',
        '│   │',
        '│ A │',
        '│   │',
        '└─┬─┘     ┌───┐',
        '  │       │   │',
        '  └──────►│ C │',
        '          │   │',
        '          └───┘',
      ].join('\n'),
    )
  })

  it('keeps a three-way decision on its top and bottom faces', () => {
    const out = render(
      'graph LR\n  A --> B{Ok?}\n  B --> C\n  B --> D\n  B --> E',
    )
    const rows = out.split('\n')
    // The outer branches still leave the diamond's top and bottom tips.
    expect(rows[8]![14]).toBe('│')
    expect(rows[14]![14]).toBe('│')
  })
})
