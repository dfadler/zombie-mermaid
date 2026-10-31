// Double circle `(((x)))` is drawn as two concentric rings like mermaid's (#2164).
// Exact literals in every direction and both charsets.

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

const render = (
  dir: string,
  node: string,
  useAscii: boolean,
  boxBorderPadding?: number,
) =>
  renderMermaidASCII(`graph ${dir}\n  ${node} --> B`, {
    colorMode: 'none',
    useAscii,
    ...(boxBorderPadding === undefined ? {} : { boxBorderPadding }),
  })

describe('double circle in every direction, default and zero padding (#2164)', () => {
  it('TD unicode', () => {
    expect(render('TD', 'A(((dbl)))', false)).toBe(
      [
        '  ╭─────╮  ',
        '  ╱╭───╮╲  ',
        ' ╱ ╱   ╲ ╲ ',
        '( ( dbl ) )',
        ' ╲ ╲   ╱ ╱ ',
        '  ╲╰───╯╱  ',
        '  ╰──┬──╯  ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     ▼     ',
        '┌─────────┐',
        '│         │',
        '│    B    │',
        '│         │',
        '└─────────┘',
      ].join('\n'),
    )
  })
  it('BT unicode', () => {
    expect(render('BT', 'A(((dbl)))', false)).toBe(
      [
        '┌─────────┐',
        '│         │',
        '│    B    │',
        '│         │',
        '└─────────┘',
        '     ▲     ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     │     ',
        '  ╭──┴──╮  ',
        '  ╱╭───╮╲  ',
        ' ╱ ╱   ╲ ╲ ',
        '( ( dbl ) )',
        ' ╲ ╲   ╱ ╱ ',
        '  ╲╰───╯╱  ',
        '  ╰─────╯  ',
      ].join('\n'),
    )
  })
  it('LR unicode', () => {
    expect(render('LR', 'A(((dbl)))', false)).toBe(
      [
        '  ╭─────╮       ┌───┐',
        '  ╱╭───╮╲       │   │',
        ' ╱ ╱   ╲ ╲      │   │',
        '( ( dbl ) )────►│ B │',
        ' ╲ ╲   ╱ ╱      │   │',
        '  ╲╰───╯╱       │   │',
        '  ╰─────╯       └───┘',
      ].join('\n'),
    )
  })
  it('RL unicode', () => {
    expect(render('RL', 'A(((dbl)))', false)).toBe(
      [
        '┌───┐       ╭─────╮  ',
        '│   │       ╱╭───╮╲  ',
        '│   │      ╱ ╱   ╲ ╲ ',
        '│ B │◄────( ( dbl ) )',
        '│   │      ╲ ╲   ╱ ╱ ',
        '│   │       ╲╰───╯╱  ',
        '└───┘       ╰─────╯  ',
      ].join('\n'),
    )
  })
  it('TD ascii', () => {
    expect(render('TD', 'A(((dbl)))', true)).toBe(
      [
        '  .-----.  ',
        '  /.---.\\  ',
        ' / /   \\ \\ ',
        '( ( dbl ) )',
        ' \\ \\   / / ',
        "  \\'---'/  ",
        "  '--+--'  ",
        '     |     ',
        '     |     ',
        '     |     ',
        '     |     ',
        '     v     ',
        '+---------+',
        '|         |',
        '|    B    |',
        '|         |',
        '+---------+',
      ].join('\n'),
    )
  })
  it('BT ascii', () => {
    expect(render('BT', 'A(((dbl)))', true)).toBe(
      [
        '+---------+',
        '|         |',
        '|    B    |',
        '|         |',
        '+---------+',
        '     ^     ',
        '     |     ',
        '     |     ',
        '     |     ',
        '     |     ',
        "  '--+--'  ",
        "  /'---'\\  ",
        ' / /   \\ \\ ',
        '( ( dbl ) )',
        ' \\ \\   / / ',
        '  \\.---./  ',
        '  .-----.  ',
      ].join('\n'),
    )
  })
  it('LR ascii', () => {
    expect(render('LR', 'A(((dbl)))', true)).toBe(
      [
        '  .-----.       +---+',
        '  /.---.\\       |   |',
        ' / /   \\ \\      |   |',
        '( ( dbl ) )---->| B |',
        ' \\ \\   / /      |   |',
        "  \\'---'/       |   |",
        "  '-----'       +---+",
      ].join('\n'),
    )
  })
  it('RL ascii', () => {
    expect(render('RL', 'A(((dbl)))', true)).toBe(
      [
        '+---+       .-----.  ',
        '|   |       /.---.\\  ',
        '|   |      / /   \\ \\ ',
        '| B |<----( ( dbl ) )',
        '|   |      \\ \\   / / ',
        "|   |       \\'---'/  ",
        "+---+       '-----'  ",
      ].join('\n'),
    )
  })
  it('TD unicode padding 0', () => {
    expect(render('TD', 'A(((dbl)))', false, 0)).toBe(
      [
        ' ╭───────╮ ',
        ' ╱╭─────╮╲ ',
        '( ( dbl ) )',
        ' ╲╰─────╯╱ ',
        ' ╰───┬───╯ ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     ▼     ',
        '┌─────────┐',
        '│    B    │',
        '└─────────┘',
      ].join('\n'),
    )
  })
  it('BT unicode padding 0', () => {
    expect(render('BT', 'A(((dbl)))', false, 0)).toBe(
      [
        '┌─────────┐',
        '│    B    │',
        '└─────────┘',
        '     ▲     ',
        '     │     ',
        '     │     ',
        '     │     ',
        '     │     ',
        ' ╭───┴───╮ ',
        ' ╱╭─────╮╲ ',
        '( ( dbl ) )',
        ' ╲╰─────╯╱ ',
        ' ╰───────╯ ',
      ].join('\n'),
    )
  })
  it('LR unicode padding 0', () => {
    expect(render('LR', 'A(((dbl)))', false, 0)).toBe(
      [
        ' ╭───────╮      ┌─┐',
        ' ╱╭─────╮╲      │ │',
        '( ( dbl ) )────►│B│',
        ' ╲╰─────╯╱      │ │',
        ' ╰───────╯      └─┘',
      ].join('\n'),
    )
  })
  it('RL unicode padding 0', () => {
    expect(render('RL', 'A(((dbl)))', false, 0)).toBe(
      [
        '┌─┐      ╭───────╮ ',
        '│ │      ╱╭─────╮╲ ',
        '│B│◄────( ( dbl ) )',
        '│ │      ╲╰─────╯╱ ',
        '└─┘      ╰───────╯ ',
      ].join('\n'),
    )
  })
  it('TD ascii padding 0', () => {
    expect(render('TD', 'A(((dbl)))', true, 0)).toBe(
      [
        ' .-------. ',
        ' /.-----.\\ ',
        '( ( dbl ) )',
        " \\'-----'/ ",
        " '---+---' ",
        '     |     ',
        '     |     ',
        '     |     ',
        '     |     ',
        '     v     ',
        '+---------+',
        '|    B    |',
        '+---------+',
      ].join('\n'),
    )
  })
  it('BT ascii padding 0', () => {
    expect(render('BT', 'A(((dbl)))', true, 0)).toBe(
      [
        '+---------+',
        '|    B    |',
        '+---------+',
        '     ^     ',
        '     |     ',
        '     |     ',
        '     |     ',
        '     |     ',
        " '---+---' ",
        " /'-----'\\ ",
        '( ( dbl ) )',
        ' \\.-----./ ',
        ' .-------. ',
      ].join('\n'),
    )
  })
  it('LR ascii padding 0', () => {
    expect(render('LR', 'A(((dbl)))', true, 0)).toBe(
      [
        ' .-------.      +-+',
        ' /.-----.\\      | |',
        '( ( dbl ) )---->|B|',
        " \\'-----'/      | |",
        " '-------'      +-+",
      ].join('\n'),
    )
  })
  it('RL ascii padding 0', () => {
    expect(render('RL', 'A(((dbl)))', true, 0)).toBe(
      [
        '+-+      .-------. ',
        '| |      /.-----.\\ ',
        '|B|<----( ( dbl ) )',
        "| |      \\'-----'/ ",
        "+-+      '-------' ",
      ].join('\n'),
    )
  })
})

describe('double circle labels (#2164)', () => {
  it('keeps the inner ring clear of a two-line label', () => {
    const out = render('LR', 'A(((Hello world<br/>two lines)))', false)
    expect(out).toContain('( ( Hello world ) )')
    expect(out).toContain(' ╲ ╲ two lines ╱ ╱ ')
  })

  it('keeps wide (CJK) labels inside the inner ring', () => {
    const out = render('LR', 'A(((日本語)))', false)
    const row = out.split('\n').find((l) => l.includes('日本語'))!
    expect(row).toMatch(/^\( \( 日本語 \) \)/)
  })
})
