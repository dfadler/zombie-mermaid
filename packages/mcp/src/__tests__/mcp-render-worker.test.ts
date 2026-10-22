// ============================================================================
// Worker-thread rendering (#1856): real worker_threads, real terminate() and
// real heap-limit OOM, driven through a stub worker so no build is needed;
// plus a byte-identical check against the built dist/render-worker.js (runs
// only after `pnpm run build`; the packed smoke test covers it in CI).
// ============================================================================

import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk } from '@zombie-mermaid/svg-renderer'
import { MermaidParseError } from '@zombie-mermaid/core'
import { createWorkerRenderer } from '../tools/render-worker-client.ts'
import { renderErrorResult } from '../tools/parse-diagnostics.ts'
import { renderSvgHandler, svgRenderOptions } from '../tools/render-svg.ts'
import { svgResult } from '../tools/render-svg.ts'
import {
  asciiRenderOptions,
  renderAsciiHandler,
} from '../tools/render-ascii.ts'

const STUB = new URL('./fixtures/stub-render-worker.mjs', import.meta.url)
const req = (diagram: string) =>
  ({ kind: 'svg', diagram, options: {} }) as const

const renderers: Array<ReturnType<typeof createWorkerRenderer>> = []
function make(opts: Parameters<typeof createWorkerRenderer>[0]) {
  const r = createWorkerRenderer({ workerUrl: STUB, ...opts })
  renderers.push(r)
  return r
}
afterEach(async () => {
  await Promise.all(renderers.splice(0).map((r) => r.dispose()))
})

describe('worker timeout and OOM', () => {
  it('times out a busy loop within timeout + 1 s, then respawns', async () => {
    const r = make({ timeoutMs: 300 })
    const first = await r.render(req('ok'))
    const t0 = Date.now()
    await expect(r.render(req('hang'))).rejects.toThrow(
      /timed out after 0\.3 s/,
    )
    expect(Date.now() - t0).toBeLessThan(1300)
    const after = await r.render(req('ok'))
    expect(after).toMatch(/^thread \d+$/)
    expect(after).not.toBe(first) // A fresh worker thread
  })

  it('turns a heap blowup into an error, then respawns', async () => {
    const r = make({ maxOldGenerationSizeMb: 16, timeoutMs: 20_000 })
    await expect(r.render(req('oom'))).rejects.toThrow(
      /ran out of memory \(limit 16 MB\)/,
    )
    await expect(r.render(req('ok'))).resolves.toMatch(/^thread/)
  })

  it('keeps the worker after a render error and rebuilds MermaidParseError', async () => {
    const r = make({})
    const a = await r.render(req('ok'))
    const err = await r.render(req('throw')).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MermaidParseError)
    expect((err as MermaidParseError).line).toBe(2)
    expect(await r.render(req('ok'))).toBe(a) // Same thread: not respawned
  })

  it('rebuilds other render errors by name and message', async () => {
    const r = make({})
    const err = await r.render(req('limit')).catch((e: unknown) => e)
    expect(err).toMatchObject({
      name: 'LimitExceededError',
      message: 'maxNodes exceeded: 9 > 1',
    })
  })

  it('surfaces a worker crash and an unexpected exit, then respawns', async () => {
    const r = make({})
    await expect(r.render(req('crash'))).rejects.toThrow('boom')
    await expect(r.render(req('exit'))).rejects.toThrow(
      /exited unexpectedly \(code 0\)/,
    )
    await expect(r.render(req('ok'))).resolves.toMatch(/^thread/)
  })

  it('serialises calls so a queued render never inherits the earlier timeout', async () => {
    const r = make({ timeoutMs: 300 })
    const slow = r.render(req('hang')).catch((e: unknown) => e)
    const next = r.render(req('ok'))
    expect(await slow).toBeInstanceOf(Error)
    await expect(next).resolves.toMatch(/^thread/)
  })

  it('reuses the existing error-result shape', async () => {
    const r = make({ timeoutMs: 200 })
    const err = await r.render(req('hang')).catch((e: unknown) => e)
    const result = renderErrorResult('Failed to render diagram to SVG', err, '')
    expect(result.isError).toBe(true)
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(
        /^Failed to render diagram to SVG: render timed out/,
      ),
    })
  })
})

const BUILT = new URL('../../dist/render-worker.js', import.meta.url)
// The built worker imports these packages by name, which resolves to their
// own dist/ (the vitest aliases don't apply inside a worker thread). A partial
// or mid-rebuild dist (vite empties each outDir first) otherwise fails with
// "Cannot find module .../dist/index.js" instead of skipping (#1825).
const WORKER_DEPS = ['svg-renderer', 'ascii-renderer', 'core', 'mermaid-parser']
const BUILT_COMPLETE =
  existsSync(BUILT) &&
  WORKER_DEPS.every((p) =>
    existsSync(new URL(`../../../${p}/dist/index.js`, import.meta.url)),
  )

describe.skipIf(!BUILT_COMPLETE)('built worker output', () => {
  it('is byte-identical to in-thread output (ELK registered in the worker)', async () => {
    registerElk(ELK)
    const r = make({ workerUrl: pathToFileURL(BUILT.pathname) as URL })
    const svgIn = {
      diagram: 'graph TD\n  A[Start] --> B{Q}\n  B --> C',
      theme: 'tokyo-night',
    }
    const asciiIn = { diagram: 'graph LR\n  A --> B', useAscii: true }
    const svg = await r.render({
      kind: 'svg',
      diagram: svgIn.diagram,
      options: svgRenderOptions(svgIn),
    })
    expect(svgResult(svgIn, svg)).toEqual(renderSvgHandler(svgIn))
    const ascii = await r.render({
      kind: 'ascii',
      diagram: asciiIn.diagram,
      options: asciiRenderOptions(asciiIn),
    })
    expect({ content: [{ type: 'text', text: ascii }] }).toEqual(
      renderAsciiHandler(asciiIn),
    )
    // Errors keep their result (incl. parse diagnostics) across the thread hop.
    const bad = {
      diagram: 'classDiagram\n  class Animal {\n    <<interface\n  }',
    }
    const viaWorker = await r
      .render({
        kind: 'svg',
        diagram: bad.diagram,
        options: svgRenderOptions(bad),
      })
      .then(
        () => undefined,
        (e: unknown) =>
          renderErrorResult('Failed to render diagram to SVG', e, bad.diagram),
      )
    expect(viaWorker?.content).toHaveLength(2) // Message + diagnostics block
    expect(viaWorker).toEqual(renderSvgHandler(bad))
  })
})
