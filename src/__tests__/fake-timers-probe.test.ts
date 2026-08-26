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
})
