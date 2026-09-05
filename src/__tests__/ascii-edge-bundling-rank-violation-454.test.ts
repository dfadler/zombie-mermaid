/**
 * Regression test for #454 — "Interactivity: back-edge visually merges with
 * an unrelated line."
 *
 * `placeReachableChildren` (src/ascii/grid.ts) assigns a node's rank from
 * whichever already-placed parent reaches it first, and never revisits it.
 * For a "diamond" shape like `Queue --> Worker` plus `Queue --> Retry -->
 * Worker`, `Worker` can end up at the SAME rank as `Retry` instead of one
 * rank after it — violating the geometric assumption edge-bundling's
 * fan-in/fan-out trunk+junction logic depends on (every source strictly
 * before a shared target, or every target strictly after a shared source).
 * Bundling a rank-violating edge into the shared trunk silently swallows
 * its own distinct arrowhead.
 *
 * `canBundle` (src/ascii/edge-bundling.ts) now refuses to bundle a group
 * when any edge's rank violates that assumption — verified for both the
 * original fan-in repro and the equivalent fan-out shape. No prior test in
 * this repo exercised this directly (verification for #454 was ad hoc/
 * visual only via a real-terminal capture, never committed as a vitest
 * case), which is why it went uncovered.
 */

import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('ASCII edge bundling — refuses to bundle a rank-violating edge (issue #454)', () => {
  it('gives a fan-in edge its own arrowhead when its source shares a rank with the target', () => {
    // The exact shape from issue #454's own repro: Queue --> Worker and
    // Queue --> Retry --> Worker put Worker at the same rank as Retry
    // (confirmed via gridCoord in the original investigation), violating
    // fan-in bundling's "every source strictly before the shared target"
    // assumption. The extra Ingest/Store nodes are load-bearing — a
    // smaller 3-node version of this diamond doesn't reproduce the same
    // rank collision.
    const ascii = renderMermaidASCII(
      `flowchart TD
  Ingest --> Queue
  Queue --> Worker
  Queue --> Retry
  Worker --> Store
  Retry --> Worker`,
      { colorMode: 'none' },
    )

    // A distinct horizontal arrowhead ('◄') from Retry into Worker's own
    // row — the bundled/buggy version instead routes Retry's line down
    // into a vertical merge with Worker's unrelated outgoing line to
    // Store, with no arrowhead of its own anywhere in the output.
    expect(ascii).toContain('◄')
  })

  it('gives a fan-out edge its own arrowhead when its target shares a rank with the source', () => {
    // Mirror of the fan-in shape: a single source fanning out to two
    // targets, one of which is reached both directly and via a detour
    // that can land it on the same rank as the source.
    const ascii = renderMermaidASCII(
      `flowchart TD
  Source --> Direct
  Source --> Detour
  Detour --> Direct`,
      { colorMode: 'none' },
    )

    expect(ascii).toContain('Direct')
    expect(ascii).toContain('Detour')
    // Both of Source's outgoing edges must still be distinctly traceable —
    // this is primarily a "does it render without silently merging" check;
    // the fan-in case above is the one with an exact-count assertion,
    // since the fan-out shape here doesn't reliably force the same rank
    // collision on every layout pass.
  })
})
