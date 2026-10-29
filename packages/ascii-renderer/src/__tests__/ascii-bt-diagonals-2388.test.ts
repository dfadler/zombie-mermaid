// BT vertical flip keeps the diagonals of hexagon, circle and diamond leaning
// as in TD (#2388); TD/LR/RL are guarded unchanged. Exact literals, both charsets.

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (dir: string, node: string, useAscii: boolean) =>
  renderMermaidASCII(`graph ${dir}\n  ${node} --> B`, {
    colorMode: 'none',
    useAscii,
  })

describe('hexagon in every direction (#2388)', () => {
  it('BT unicode', () => {
    expect(render('BT', 'A{{hex}}', false)).toBe(
      [
        '┌─────┐',
        '│     │',
        '│  B  │',
        '│     │',
        '└─────┘',
        '   ▲   ',
        '   │   ',
        '   │   ',
        '   │   ',
        '   │   ',
        '  ╱┴╲  ',
        ' ╱   ╲ ',
        '< hex >',
        ' ╲   ╱ ',
        '  ╲─╱  ',
      ].join('\n'),
    )
  })
  it('TD unicode', () => {
    expect(render('TD', 'A{{hex}}', false)).toBe(
      [
        '  ╱─╲  ',
        ' ╱   ╲ ',
        '< hex >',
        ' ╲   ╱ ',
        '  ╲┬╱  ',
        '   │   ',
        '   │   ',
        '   │   ',
        '   │   ',
        '   ▼   ',
        '┌─────┐',
        '│     │',
        '│  B  │',
        '│     │',
        '└─────┘',
      ].join('\n'),
    )
  })
  it('LR unicode', () => {
    expect(render('LR', 'A{{hex}}', false)).toBe(
      [
        '  ╱─╲       ┌───┐',
        ' ╱   ╲      │   │',
        '< hex >────►│ B │',
        ' ╲   ╱      │   │',
        '  ╲─╱       └───┘',
      ].join('\n'),
    )
  })
  it('RL unicode', () => {
    expect(render('RL', 'A{{hex}}', false)).toBe(
      [
        '┌───┐       ╱─╲  ',
        '│   │      ╱   ╲ ',
        '│ B │◄────< hex >',
        '│   │      ╲   ╱ ',
        '└───┘       ╲─╱  ',
      ].join('\n'),
    )
  })
  it('BT ascii', () => {
    expect(render('BT', 'A{{hex}}', true)).toBe(
      [
        '+-----+',
        '|     |',
        '|  B  |',
        '|     |',
        '+-----+',
        '   ^   ',
        '   |   ',
        '   |   ',
        '   |   ',
        '   |   ',
        '  /+\\  ',
        ' /   \\ ',
        '< hex >',
        ' \\   / ',
        '  \\-/  ',
      ].join('\n'),
    )
  })
  it('TD ascii', () => {
    expect(render('TD', 'A{{hex}}', true)).toBe(
      [
        '  /-\\  ',
        ' /   \\ ',
        '< hex >',
        ' \\   / ',
        '  \\+/  ',
        '   |   ',
        '   |   ',
        '   |   ',
        '   |   ',
        '   v   ',
        '+-----+',
        '|     |',
        '|  B  |',
        '|     |',
        '+-----+',
      ].join('\n'),
    )
  })
  it('LR ascii', () => {
    expect(render('LR', 'A{{hex}}', true)).toBe(
      [
        '  /-\\       +---+',
        ' /   \\      |   |',
        '< hex >---->| B |',
        ' \\   /      |   |',
        '  \\-/       +---+',
      ].join('\n'),
    )
  })
  it('RL ascii', () => {
    expect(render('RL', 'A{{hex}}', true)).toBe(
      [
        '+---+       /-\\  ',
        '|   |      /   \\ ',
        '| B |<----< hex >',
        '|   |      \\   / ',
        '+---+       \\-/  ',
      ].join('\n'),
    )
  })
})

describe('circle in every direction (#2388)', () => {
  it('BT unicode', () => {
    expect(render('BT', 'A((circ))', false)).toBe(
      [
        '┌──────┐',
        '│      │',
        '│  B   │',
        '│      │',
        '└──────┘',
        '    ▲   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    │   ',
        ' ╭──┴─╮ ',
        ' ╱    ╲ ',
        '( circ )',
        ' ╲    ╱ ',
        ' ╰────╯ ',
      ].join('\n'),
    )
  })
  it('TD unicode', () => {
    expect(render('TD', 'A((circ))', false)).toBe(
      [
        ' ╭────╮ ',
        ' ╱    ╲ ',
        '( circ )',
        ' ╲    ╱ ',
        ' ╰──┬─╯ ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    ▼   ',
        '┌──────┐',
        '│      │',
        '│  B   │',
        '│      │',
        '└──────┘',
      ].join('\n'),
    )
  })
  it('LR unicode', () => {
    expect(render('LR', 'A((circ))', false)).toBe(
      [
        ' ╭────╮      ┌───┐',
        ' ╱    ╲      │   │',
        '( circ )────►│ B │',
        ' ╲    ╱      │   │',
        ' ╰────╯      └───┘',
      ].join('\n'),
    )
  })
  it('RL unicode', () => {
    expect(render('RL', 'A((circ))', false)).toBe(
      [
        '┌───┐      ╭────╮ ',
        '│   │      ╱    ╲ ',
        '│ B │◄────( circ )',
        '│   │      ╲    ╱ ',
        '└───┘      ╰────╯ ',
      ].join('\n'),
    )
  })
  it('BT ascii', () => {
    expect(render('BT', 'A((circ))', true)).toBe(
      [
        '+------+',
        '|      |',
        '|  B   |',
        '|      |',
        '+------+',
        '    ^   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '    |   ',
        " '--+-' ",
        ' /    \\ ',
        '( circ )',
        ' \\    / ',
        ' .----. ',
      ].join('\n'),
    )
  })
  it('TD ascii', () => {
    expect(render('TD', 'A((circ))', true)).toBe(
      [
        ' .----. ',
        ' /    \\ ',
        '( circ )',
        ' \\    / ',
        " '--+-' ",
        '    |   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '    v   ',
        '+------+',
        '|      |',
        '|  B   |',
        '|      |',
        '+------+',
      ].join('\n'),
    )
  })
  it('LR ascii', () => {
    expect(render('LR', 'A((circ))', true)).toBe(
      [
        ' .----.      +---+',
        ' /    \\      |   |',
        '( circ )---->| B |',
        ' \\    /      |   |',
        " '----'      +---+",
      ].join('\n'),
    )
  })
  it('RL ascii', () => {
    expect(render('RL', 'A((circ))', true)).toBe(
      [
        '+---+      .----. ',
        '|   |      /    \\ ',
        '| B |<----( circ )',
        '|   |      \\    / ',
        "+---+      '----' ",
      ].join('\n'),
    )
  })
})

describe('diamond in every direction (#2388)', () => {
  it('BT unicode', () => {
    expect(render('BT', 'A{dia}', false)).toBe(
      [
        '┌──────┐',
        '│      │',
        '│  B   │',
        '│      │',
        '└──────┘',
        '    ▲   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '   ╱╲   ',
        '  ╱  ╲  ',
        '< dia  >',
        '  ╲  ╱  ',
        '   ╲╱   ',
      ].join('\n'),
    )
  })
  it('TD unicode', () => {
    expect(render('TD', 'A{dia}', false)).toBe(
      [
        '   ╱╲   ',
        '  ╱  ╲  ',
        '< dia  >',
        '  ╲  ╱  ',
        '   ╲╱   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    │   ',
        '    ▼   ',
        '┌──────┐',
        '│      │',
        '│  B   │',
        '│      │',
        '└──────┘',
      ].join('\n'),
    )
  })
  it('LR unicode', () => {
    expect(render('LR', 'A{dia}', false)).toBe(
      [
        '   ╱╲        ┌───┐',
        '  ╱  ╲       │   │',
        '< dia  >────►│ B │',
        '  ╲  ╱       │   │',
        '   ╲╱        └───┘',
      ].join('\n'),
    )
  })
  it('RL unicode', () => {
    expect(render('RL', 'A{dia}', false)).toBe(
      [
        '┌───┐        ╱╲   ',
        '│   │       ╱  ╲  ',
        '│ B │◄────< dia  >',
        '│   │       ╲  ╱  ',
        '└───┘        ╲╱   ',
      ].join('\n'),
    )
  })
  it('BT ascii', () => {
    expect(render('BT', 'A{dia}', true)).toBe(
      [
        '+------+',
        '|      |',
        '|  B   |',
        '|      |',
        '+------+',
        '    ^   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '   /\\   ',
        '  /  \\  ',
        '< dia  >',
        '  \\  /  ',
        '   \\/   ',
      ].join('\n'),
    )
  })
  it('TD ascii', () => {
    expect(render('TD', 'A{dia}', true)).toBe(
      [
        '   /\\   ',
        '  /  \\  ',
        '< dia  >',
        '  \\  /  ',
        '   \\/   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '    |   ',
        '    v   ',
        '+------+',
        '|      |',
        '|  B   |',
        '|      |',
        '+------+',
      ].join('\n'),
    )
  })
  it('LR ascii', () => {
    expect(render('LR', 'A{dia}', true)).toBe(
      [
        '   /\\        +---+',
        '  /  \\       |   |',
        '< dia  >---->| B |',
        '  \\  /       |   |',
        '   \\/        +---+',
      ].join('\n'),
    )
  })
  it('RL ascii', () => {
    expect(render('RL', 'A{dia}', true)).toBe(
      [
        '+---+        /\\   ',
        '|   |       /  \\  ',
        '| B |<----< dia  >',
        '|   |       \\  /  ',
        '+---+        \\/   ',
      ].join('\n'),
    )
  })
})
