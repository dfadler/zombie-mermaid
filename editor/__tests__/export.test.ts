import { describe, expect, it, type Mock } from 'vitest'
import { createEditorEnv, flushRenderTimers } from './support/harness.ts'

/**
 * PNG rasterization (exportPNG/copyImage) relies on <canvas> 2D context and
 * <img> decode-on-load, neither of which jsdom implements without the
 * optional native `canvas` package. Rather than pull in a native dependency
 * for a lightweight test suite, this file covers the deterministic parts of
 * export: the SVG-serialization path (exportSVG), URL copying (copyURL), and
 * the shared "no diagram rendered yet" guard all three exported actions rely
 * on (getSvgEl). See the PR description for the full list of what's skipped.
 */
describe('export', () => {
  it('downloads the rendered SVG with the right filename and mime type', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()

    let created: HTMLAnchorElement | null = null
    const realCreateElement = env.document.createElement.bind(env.document)
    env.document.createElement = ((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'a') {
        created = el as HTMLAnchorElement
        el.click = () => {}
      }
      return el
    }) as typeof env.document.createElement

    env.window.eval('exportSVG()')

    expect(created).not.toBeNull()
    expect(created!.download).toBe('diagram.svg')
    expect(created!.href).toBe('blob:mock-url')
    expect(env.window.URL.createObjectURL).toHaveBeenCalledTimes(1)
    const blob = (env.window.URL.createObjectURL as Mock).mock
      .calls[0][0] as Blob
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')

    const toast = env.document.getElementById('toast')!
    expect(toast.textContent).toBe('SVG saved!')
  })

  it('shows a toast and does not attempt a download when nothing is rendered', () => {
    const env = createEditorEnv()
    const previewInner = env.document.getElementById('preview-inner')!
    previewInner.innerHTML = ''

    env.window.eval('exportSVG()')

    const toast = env.document.getElementById('toast')!
    expect(toast.textContent).toBe('Render a diagram first.')
    expect(env.window.URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('copies the current share URL to the clipboard', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()

    const editor = env.document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    editor.value = 'graph TD\n  A --> B'

    await env.window.eval('copyURL()')

    const clipboard = env.window.navigator.clipboard as unknown as {
      writeText: Mock
    }
    expect(clipboard.writeText).toHaveBeenCalledTimes(1)
    const copied = clipboard.writeText.mock.calls[0][0] as string
    expect(copied).toBe(env.window.location.href)
    expect(copied).toContain('#')
  })
})
