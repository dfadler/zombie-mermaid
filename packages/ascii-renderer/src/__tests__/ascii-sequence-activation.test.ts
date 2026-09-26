// ============================================================================
// ASCII sequence diagrams — activation bars on lifelines (issue #1133)
//
// Mermaid overlays a highlighted rectangle on a lifeline while a participant
// is actively processing a call, driven by standalone `activate`/`deactivate`
// statements or the `+`/`-` arrow shorthand (`A->>+B` / `A-->>-B`). The
// parser already models both forms (`SequenceDiagram.activations` and
// `Message.activate`/`Message.deactivate` — see mermaid-parser's
// sequence/types.ts) and the SVG renderer already draws the bars
// (svg-renderer's sequence/layout.ts), but the ASCII renderer drew every
// lifeline as a uniform `│` regardless of activation state.
// ============================================================================

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'

describe('ASCII sequence diagrams – activation bars (issue #1133)', () => {
  it('draws a double-line glyph on the recipient lifeline for +/- shorthand activation', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant Client
  participant Server
  Client->>+Server: request
  Server-->>-Client: response`,
      { useAscii: false },
    )

    expect(result).toBe(
      [
        '┌────────┐    ┌────────┐   ',
        '│ Client │    │ Server │   ',
        '└────┬───┘    └────┬───┘   ',
        '     │             │       ',
        '     │   request   │       ',
        '     │─────────────▶       ',
        '     │             ║       ',
        '     │  response   ║       ',
        '     ◀╌╌╌╌╌╌╌╌╌╌╌╌╌║       ',
        '     │             │       ',
        '┌────┴───┐    ┌────┴───┐   ',
        '│ Client │    │ Server │   ',
        '└────────┘    └────────┘   ',
      ].join('\n'),
    )
  })

  it('uses the ASCII-fallback glyph (‖) in useAscii mode', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant Client
  participant Server
  Client->>+Server: request
  Server-->>-Client: response`,
      { useAscii: true },
    )

    const lines = result.split('\n')
    expect(lines.some((l) => l.includes('‖'))).toBe(true)
    expect(result).not.toContain('║')
  })

  it('draws the same bar for standalone activate/deactivate statements', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  participant B
  A->>B: hello
  activate B
  B->>A: world
  deactivate B`,
      { useAscii: false },
    )

    expect(result).toBe(
      [
        ' ┌───┐      ┌───┐   ',
        ' │ A │      │ B │   ',
        ' └─┬─┘      └─┬─┘   ',
        '   │          │     ',
        '   │  hello   │     ',
        '   │──────────▶     ',
        '   │          ║     ',
        '   │  world   ║     ',
        '   ◀──────────║     ',
        '   │          │     ',
        ' ┌─┴─┐      ┌─┴─┐   ',
        ' │ A │      │ B │   ',
        ' └───┘      └───┘   ',
      ].join('\n'),
    )
  })

  it('keeps a nested self-activation active across the outer activation without a distinct nesting glyph', () => {
    // B activates itself while already active (A->>+B, then B->>+B on the
    // same actor): the lifeline stays marked active continuously from the
    // outer activate through the outer deactivate, including the nested
    // span — this renderer intentionally doesn't offset nested activations
    // sideways the way the SVG renderer does (no spare column per lifeline
    // without reflowing spacing), so nesting depth isn't visually distinct.
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  participant B
  A->>+B: outer
  B->>+B: inner
  B-->>-B: inner done
  B-->>-A: outer done`,
      { useAscii: false },
    )

    expect(result).toBe(
      [
        ' ┌───┐           ┌───┐                 ',
        ' │ A │           │ B │                 ',
        ' └─┬─┘           └─┬─┘                 ',
        '   │               │                   ',
        '   │     outer     │                   ',
        '   │───────────────▶                   ',
        '   │               ║                   ',
        '   │               ├───┐               ',
        '   │               ║   │ inner         ',
        '   │               ◀───┘               ',
        '   │               ║                   ',
        '   │               ├╌╌╌┐               ',
        '   │               ║   │ inner done    ',
        '   │               ◀╌╌╌┘               ',
        '   │               ║                   ',
        '   │  outer done   ║                   ',
        '   ◀╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌║                   ',
        '   │               │                   ',
        ' ┌─┴─┐           ┌─┴─┐                 ',
        ' │ A │           │ B │                 ',
        ' └───┘           └───┘                 ',
      ].join('\n'),
    )
  })

  it('keeps an unbalanced activate (no matching deactivate) active through to the lifeline end', () => {
    const result = renderMermaidASCII(
      `
sequenceDiagram
  participant A
  participant B
  A->>+B: call
  B->>A: reply`,
      { useAscii: false },
    )

    expect(result).toBe(
      [
        ' ┌───┐      ┌───┐   ',
        ' │ A │      │ B │   ',
        ' └─┬─┘      └─┬─┘   ',
        '   │          │     ',
        '   │  call    │     ',
        '   │──────────▶     ',
        '   │          ║     ',
        '   │  reply   ║     ',
        '   ◀──────────║     ',
        '   │          ║     ',
        ' ┌─┴─┐      ┌─┴─┐   ',
        ' │ A │      │ B │   ',
        ' └───┘      └───┘   ',
      ].join('\n'),
    )
  })
})
