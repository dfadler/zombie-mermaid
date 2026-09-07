/**
 * Regression test for #530 — "State: transition labels between a
 * bidirectional state pair are swapped relative to their arrows."
 *
 * Root cause: `drawTextOnLine` (src/ascii/draw-arrows.ts) offsets a vertical
 * edge label away from the segment's midpoint to keep a same-pair
 * bidirectional edge's two labels from overlapping (they share the same
 * vertical channel). The offset was applied toward each edge's *source*
 * end (upward edge -> lower portion, i.e. near its own source; downward
 * edge -> upper portion, i.e. near its own source). For a reciprocal pair
 * of edges between the same two nodes, one edge's source is the other
 * edge's target, so pulling a label toward its own source pulls it right
 * next to the *other* edge's arrowhead instead — the visual effect
 * described in #530 as the two labels being "swapped" relative to the
 * arrows they sit beside.
 *
 * The fix pulls each label toward its own target (arrowhead) instead, so
 * the label next to a given arrowhead always belongs to that arrow.
 *
 * Uses the exact "Basic State Diagram" and "State: Connection Lifecycle"
 * samples from samples-data.ts (indices 29 and 31 in the sample list) that
 * the issue was filed against.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

const BASIC_STATE_DIAGRAM = `stateDiagram-v2
  [*] --> Idle
  Idle --> Active : start
  Active --> Idle : cancel
  Active --> Done : complete
  Done --> [*]`

const CONNECTION_LIFECYCLE = `stateDiagram-v2
  [*] --> Closed
  Closed --> Connecting : connect
  Connecting --> Connected : success
  Connecting --> Closed : timeout
  Connected --> Disconnecting : close
  Connected --> Reconnecting : error
  Reconnecting --> Connected : success
  Reconnecting --> Closed : max_retries
  Disconnecting --> Closed : done
  Closed --> [*]`

describe('ASCII state diagram — bidirectional pair label placement (issue #530)', () => {
  it('places "cancel" next to the arrow arriving at Idle and "start" next to the arrow arriving at Active', () => {
    const ascii = renderMermaidASCII(BASIC_STATE_DIAGRAM, { colorMode: 'none' })
    const lines = ascii.split('\n')

    // The Idle<->Active channel is the only place an upward arrowhead (▲)
    // appears in this diagram — every other edge routes downward.
    const upArrowIdx = lines.findIndex((l) => l.includes('▲'))
    const cancelIdx = lines.findIndex((l) => l.includes('cancel'))
    const startIdx = lines.findIndex((l) => l.includes('start'))
    // The next downward arrowhead (▼) after the "start" label is the one
    // arriving at Active.
    const downArrowIdx = lines.findIndex(
      (l, i) => i > startIdx && l.includes('▼'),
    )

    expect(upArrowIdx).toBeGreaterThan(-1)
    expect(cancelIdx).toBeGreaterThan(-1)
    expect(startIdx).toBeGreaterThan(-1)
    expect(downArrowIdx).toBeGreaterThan(-1)

    // "cancel" (Active --> Idle) sits immediately below the up-arrow that
    // arrives at Idle — i.e. next to its own arrowhead.
    expect(cancelIdx).toBe(upArrowIdx + 1)
    // "start" (Idle --> Active) sits immediately above the down-arrow that
    // arrives at Active — i.e. next to its own arrowhead.
    expect(startIdx).toBe(downArrowIdx - 1)

    // Reading top to bottom: Idle's border, ▲, cancel, ..., start, ▼,
    // Active's border — cancel precedes start.
    expect(cancelIdx).toBeLessThan(startIdx)
  })

  it('places "timeout" next to the arrow arriving at Closed and "connect" next to the arrow arriving at Connecting', () => {
    const ascii = renderMermaidASCII(CONNECTION_LIFECYCLE, {
      colorMode: 'none',
    })
    const lines = ascii.split('\n')

    // Scope the search to the Closed/Connecting channel: from the box that
    // renders "Closed" down to the box that renders "Connecting" (the
    // diagram has several other bidirectional pairs further down that
    // reuse the same glyphs/labels, e.g. Connected<->Reconnecting's
    // "success"/"error").
    const closedBoxIdx = lines.findIndex((l) => l.includes('Closed'))
    const connectingBoxIdx = lines.findIndex((l) => l.includes('Connecting'))
    expect(closedBoxIdx).toBeGreaterThan(-1)
    expect(connectingBoxIdx).toBeGreaterThan(closedBoxIdx)

    const channel = lines.slice(closedBoxIdx, connectingBoxIdx)
    const upArrowIdx = channel.findIndex((l) => l.includes('▲'))
    const timeoutIdx = channel.findIndex((l) => l.includes('timeout'))
    const connectIdx = channel.findIndex((l) => l.includes('connect'))
    const downArrowIdx = channel.findIndex(
      (l, i) => i > connectIdx && l.includes('▼'),
    )

    expect(upArrowIdx).toBeGreaterThan(-1)
    expect(timeoutIdx).toBeGreaterThan(-1)
    expect(connectIdx).toBeGreaterThan(-1)
    expect(downArrowIdx).toBeGreaterThan(-1)

    // "timeout" (Connecting --> Closed) sits next to the up-arrow arriving
    // at Closed; "connect" (Closed --> Connecting) sits next to the
    // down-arrow arriving at Connecting.
    expect(timeoutIdx).toBe(upArrowIdx + 1)
    expect(connectIdx).toBe(downArrowIdx - 1)
    expect(timeoutIdx).toBeLessThan(connectIdx)
  })

  it('still places a single (non-reciprocal) edge label before its own arrowhead', () => {
    const ascii = renderMermaidASCII(BASIC_STATE_DIAGRAM, { colorMode: 'none' })
    const lines = ascii.split('\n')

    // "complete" (Active --> Done) has no reverse counterpart, so it
    // should simply precede the arrowhead that arrives at Done.
    const completeIdx = lines.findIndex((l) => l.includes('complete'))
    const arrowIdx = lines.findIndex(
      (l, i) => i > completeIdx && l.includes('▼'),
    )
    expect(completeIdx).toBeGreaterThan(-1)
    expect(arrowIdx).toBeGreaterThan(completeIdx)
  })
})
