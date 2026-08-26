/**
 * EXPERIMENT — not a real regression test, see PR description.
 *
 * Demonstrates what `vi.useFakeTimers()` actually does to elapsed-time
 * measurement around a real, synchronous, CPU-bound render (the same dense
 * fan-in stress case from ascii-edge-routing-fixes.test.ts). Run with
 * `--reporter=verbose --silent=false` to see the logged timings:
 *
 *   pnpm exec vitest run src/__tests__/fake-timers-probe.test.ts --reporter=verbose --silent=false
 */
import { describe, it, vi } from 'vitest'
import { renderMermaidAscii } from '../ascii/index.ts'

function denseFanInSource(): string {
  let src = 'graph TD\n  A --> C\n  B --> C\n  C --> D\n  D --> E\n'
  for (let i = 0; i < 60; i++) src += `  A${i}["Root A${i}"] --> A\n`
  for (let i = 0; i < 60; i++) src += `  B${i}["Root B${i}"] --> B\n`
  return src
}

describe('fake timers probe', () => {
  it('measures real elapsed time with no mocking active (baseline)', () => {
    const start = performance.now()
    renderMermaidAscii(denseFanInSource())
    console.log(`[baseline] real elapsed: ${performance.now() - start}ms`)
  })

  it('measures elapsed time for the same render under vi.useFakeTimers()', () => {
    vi.useFakeTimers()
    const dateStart = Date.now()
    const perfStart = performance.now()
    renderMermaidAscii(denseFanInSource())
    const dateElapsed = Date.now() - dateStart
    const perfElapsed = performance.now() - perfStart
    vi.useRealTimers()
    console.log(
      `[fake timers] Date.now() elapsed: ${dateElapsed}ms, performance.now() elapsed: ${perfElapsed}ms`,
    )
  })

  it('shows vi.advanceTimersByTime() reports back whatever value is passed to it, not real duration', () => {
    // renderMermaidAscii never calls setTimeout/setInterval (see
    // src/ascii/index.ts's renderMermaidASCII doc comment: "Synchronous —
    // no async layout engine needed"), so there is nothing scheduled for
    // advanceTimersByTime to fast-forward past. All it does here is bump
    // the frozen fake clock by the literal number passed in.
    vi.useFakeTimers()
    const startA = Date.now()
    renderMermaidAscii(denseFanInSource()) // identical real work both times
    vi.advanceTimersByTime(3000)
    const elapsedA = Date.now() - startA

    const startB = Date.now()
    renderMermaidAscii(denseFanInSource()) // identical real work both times
    vi.advanceTimersByTime(50)
    const elapsedB = Date.now() - startB
    vi.useRealTimers()

    console.log(
      `[advanceTimersByTime(3000)] elapsed: ${elapsedA}ms; [advanceTimersByTime(50)] elapsed: ${elapsedB}ms — same render, different reported "duration" purely because of the argument chosen`,
    )
    // Note: this test needs a longer-than-default timeout even though the
    // fake clock reports 3000ms/50ms above — because two real dense-fan-in
    // renders (~1.1-1.2s of actual CPU time each, unaffected by fake
    // timers) still ran, and vitest's *own* test-level timeout is driven by
    // real wall-clock time regardless of what the fake clock says inside
    // the test. Fake timers didn't remove the real time cost; they just
    // hid it from the assertions.
  }, 10000)
})
