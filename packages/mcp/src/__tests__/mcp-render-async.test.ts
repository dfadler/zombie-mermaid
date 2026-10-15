// The async wrappers around the worker client (#1856): success returns the
// same result as the sync handler's text; a failed worker call becomes the
// existing renderErrorResult shape rather than a thrown protocol error.

import { describe, expect, it, vi } from 'vitest'

const renderInWorker = vi.hoisted(() => vi.fn())
vi.mock('../tools/render-worker-client.ts', () => ({ renderInWorker }))

import {
  renderAsciiHandlerAsync,
  renderSvgHandlerAsync,
} from '../tools/render-async.ts'

describe('async render handlers', () => {
  it('wrap the worker text as a tool result and pass the shared options', async () => {
    renderInWorker.mockResolvedValueOnce('<svg/>')
    expect(
      await renderSvgHandlerAsync({ diagram: 'graph LR\n A-->B' }),
    ).toEqual({ content: [{ type: 'text', text: '<svg/>' }] })
    expect(renderInWorker).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'svg',
        options: expect.objectContaining({
          limits: expect.objectContaining({ maxNodes: 150 }),
        }),
      }),
    )
    renderInWorker.mockResolvedValueOnce('A-->B')
    expect(
      await renderAsciiHandlerAsync({ diagram: 'graph LR\n A-->B' }),
    ).toEqual({ content: [{ type: 'text', text: 'A-->B' }] })
    expect(renderInWorker).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'ascii',
        options: expect.objectContaining({ colorMode: 'none' }),
      }),
    )
  })

  it('turn a worker failure into an isError result', async () => {
    renderInWorker.mockRejectedValue(new Error('render timed out after 15 s'))
    expect(await renderSvgHandlerAsync({ diagram: 'x' })).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Failed to render diagram to SVG: render timed out after 15 s',
        },
      ],
    })
    expect(await renderAsciiHandlerAsync({ diagram: 'x' })).toMatchObject({
      isError: true,
      content: [
        {
          text: 'Failed to render diagram to ASCII: render timed out after 15 s',
        },
      ],
    })
  })
})
