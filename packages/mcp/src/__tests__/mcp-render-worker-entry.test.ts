// The worker entry's message handler (#1856), run in-process with a fake
// parentPort: a request in, a RenderReply out. The real thread hop is covered
// by mcp-render-worker.test.ts and the packed-tarball smoke test.

import { describe, expect, it, vi } from 'vitest'

const port = vi.hoisted(() => ({ on: vi.fn(), postMessage: vi.fn() }))
vi.mock('node:worker_threads', () => ({ parentPort: port }))
vi.mock('@zombie-mermaid/ascii-renderer', async (orig) => {
  const actual = await orig<typeof import('@zombie-mermaid/ascii-renderer')>()
  return { ...actual, renderMermaidASCII: vi.fn(actual.renderMermaidASCII) }
})

import { renderMermaidASCII } from '@zombie-mermaid/ascii-renderer'
import { renderMermaidSVG } from '../../../../src/index.ts'
import '../tools/render-worker.ts'

type Handler = (req: unknown) => void
const handle = port.on.mock.calls[0]?.[1] as Handler

describe('render worker entry', () => {
  it('listens for messages and replies with the rendered text', () => {
    expect(port.on).toHaveBeenCalledWith('message', expect.any(Function))
    handle({
      kind: 'svg',
      diagram: 'sequenceDiagram\n  A->>B: hi',
      options: {},
    })
    expect(port.postMessage).toHaveBeenLastCalledWith({
      ok: true,
      text: renderMermaidSVG('sequenceDiagram\n  A->>B: hi', {}),
    })
    handle({ kind: 'ascii', diagram: 'graph LR\n  A --> B', options: {} })
    expect(port.postMessage).toHaveBeenLastCalledWith({
      ok: true,
      text: renderMermaidASCII('graph LR\n  A --> B', {}),
    })
  })

  it('replies with name, message and line when the render throws', () => {
    handle({ kind: 'svg', diagram: 'graph XX\n  A --> B', options: {} })
    expect(port.postMessage).toHaveBeenLastCalledWith({
      ok: false,
      name: 'MermaidParseError',
      message: expect.stringContaining('graph XX'),
      line: 1,
    })
  })

  it('reports an empty diagram as a failed reply', () => {
    handle({ kind: 'nope', diagram: '', options: undefined })
    expect(port.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ ok: false }),
    )
  })

  it('wraps a non-Error throw', () => {
    vi.mocked(renderMermaidASCII).mockImplementationOnce(() => {
      throw 'plain string'
    })
    handle({ kind: 'ascii', diagram: 'graph LR\n  A --> B', options: {} })
    expect(port.postMessage).toHaveBeenLastCalledWith({
      ok: false,
      name: 'Error',
      message: 'plain string',
      line: undefined,
    })
  })
})
