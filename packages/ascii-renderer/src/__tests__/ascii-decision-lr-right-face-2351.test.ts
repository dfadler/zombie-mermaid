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

const THREE = 'graph LR\n  A --> B{Ok?}\n  B --> C\n  B --> D\n  B --> E'

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

  it('sends a three-way decision out of the right face too (unicode, #2366)', () => {
    expect(render(THREE)).toBe(
      [
        '                       ┌───┐',
        '                       │   │',
        '                    ┌─►│ C │',
        '                    │  │   │',
        '                    │  └───┘',
        '                    │',
        '                    │',
        '                    │',
        '                    │',
        '┌───┐        ╱╲     │  ┌───┐',
        '│   │       ╱  ╲    │  │   │',
        '│ A ├────►< Ok?  >──┼─►│ D │',
        '│   │       ╲  ╱    │  │   │',
        '└───┘        ╲╱     │  └───┘',
        '                    │',
        '                    │',
        '                    │',
        '                    │',
        '                    │  ┌───┐',
        '                    │  │   │',
        '                    └─►│ E │',
        '                       │   │',
        '                       └───┘',
      ].join('\n'),
    )
  })

  it('sends a three-way decision out of the right face too (ASCII, #2366)', () => {
    expect(render(THREE, true)).toBe(
      [
        '                       +---+',
        '                       |   |',
        '                    +->| C |',
        '                    |  |   |',
        '                    |  +---+',
        '                    |',
        '                    |',
        '                    |',
        '                    |',
        '+---+        /\\     |  +---+',
        '|   |       /  \\    |  |   |',
        '| A +---->< Ok?  >--+->| D |',
        '|   |       \\  /    |  |   |',
        '+---+        \\/     |  +---+',
        '                    |',
        '                    |',
        '                    |',
        '                    |',
        '                    |  +---+',
        '                    |  |   |',
        '                    +->| E |',
        '                       |   |',
        '                       +---+',
      ].join('\n'),
    )
  })

  it('mirrors a three-way decision in RL (#2366)', () => {
    expect(render(THREE.replace('graph LR', 'graph RL'))).toBe(
      [
        '┌───┐',
        '│   │',
        '│ C │◄─┐',
        '│   │  │',
        '└───┘  │',
        '       │',
        '       │',
        '       │',
        '       │',
        '┌───┐  │     ╱╲        ┌───┐',
        '│   │  │    ╱  ╲       │   │',
        '│ D │◄─┼──< Ok?  >◄────┤ A │',
        '│   │  │    ╲  ╱       │   │',
        '└───┘  │     ╲╱        └───┘',
        '       │',
        '       │',
        '       │',
        '       │',
        '┌───┐  │',
        '│   │  │',
        '│ E │◄─┘',
        '│   │',
        '└───┘',
      ].join('\n'),
    )
  })

  it('keeps the middle label of a three-way decision off the trunk and arrowhead (#2366)', () => {
    expect(
      render(
        'graph LR\n  A --> B{Ok?}\n  B -->|x| C\n  B -->|y| D\n  B -->|z| E',
      ),
    ).toBe(
      [
        '                         ┌───┐',
        '                         │   │',
        '                     ┌──►│ C │',
        '                     │   │   │',
        '                     │   └───┘',
        '                     │',
        '                     x',
        '                     │',
        '                     │',
        '┌───┐        ╱╲      │   ┌───┐',
        '│   │       ╱  ╲     │   │   │',
        '│ A ├────►< Ok?  >───┼─y►│ D │',
        '│   │       ╲  ╱     │   │   │',
        '└───┘        ╲╱      │   └───┘',
        '                     │',
        '                     z',
        '                     │',
        '                     │',
        '                     │   ┌───┐',
        '                     │   │   │',
        '                     └──►│ E │',
        '                         │   │',
        '                         └───┘',
      ].join('\n'),
    )
  })

  it('joins a fourth branch to the right-face trunk (#2366)', () => {
    expect(
      render(
        'graph LR\n  A --> B{Ok?}\n  B --> C\n  B --> D\n  B --> E\n  B --> F',
      ),
    ).toBe(
      [
        '                       ┌───┐',
        '                       │   │',
        '                    ┌─►│ C │',
        '                    │  │   │',
        '                    │  └───┘',
        '                    │',
        '                    │',
        '                    │',
        '                    │',
        '                    │  ┌───┐',
        '                    │  │   │',
        '                    ├─►│ D │',
        '                    │  │   │',
        '┌───┐        ╱╲     │  └───┘',
        '│   │       ╱  ╲    │',
        '│ A ├────►< Ok?  >──┤',
        '│   │       ╲  ╱    │',
        '└───┘        ╲╱     │  ┌───┐',
        '                    │  │   │',
        '                    ├─►│ E │',
        '                    │  │   │',
        '                    │  └───┘',
        '                    │',
        '                    │',
        '                    │',
        '                    │',
        '                    │  ┌───┐',
        '                    │  │   │',
        '                    └─►│ F │',
        '                       │   │',
        '                       └───┘',
      ].join('\n'),
    )
  })
})
