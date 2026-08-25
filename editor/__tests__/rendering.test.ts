import { describe, expect, it } from 'vitest'
import { createEditorEnv, flushRenderTimers } from './support/harness.ts'

describe('editor rendering', () => {
  it('renders the default diagram on init with no theme options', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()

    expect(env.renderMermaidSVGAsync).toHaveBeenCalledTimes(1)
    const [source, opts] = env.renderMermaidSVGAsync.mock.calls[0]!
    expect(source).toContain('graph TD')
    expect(opts).toEqual({})

    const previewInner = env.document.getElementById('preview-inner')!
    expect(previewInner.innerHTML).toContain('data-mock-render')
  })

  it('calls the renderer with the current editor source', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()
    env.renderMermaidSVGAsync.mockClear()

    const editor = env.document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    editor.value = 'graph TD\n  A --> B'
    await env.window.eval('doRender()')

    expect(env.renderMermaidSVGAsync).toHaveBeenCalledWith(
      'graph TD\n  A --> B',
      {},
    )
  })

  it('merges the selected theme colors into the render options', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()
    env.renderMermaidSVGAsync.mockClear()

    env.window.eval("setTheme('dracula')")
    await env.window.eval('doRender()')

    const [, opts] = env.renderMermaidSVGAsync.mock.calls.at(-1)!
    const dracula = (
      env.window as unknown as {
        __mermaid: { THEMES: Record<string, { bg: string; fg: string }> }
      }
    ).__mermaid.THEMES.dracula
    expect(opts).toMatchObject({ bg: dracula.bg, fg: dracula.fg })
  })

  it('shows an error status and message when rendering throws', async () => {
    const env = createEditorEnv({
      renderImpl: async () => {
        throw new Error('boom')
      },
    })
    await flushRenderTimers()

    const statusText = env.document.getElementById('status-text')!
    expect(statusText.textContent).toBe('Error')
    const previewInner = env.document.getElementById('preview-inner')!
    expect(previewInner.innerHTML).toContain('boom')
  })

  it('shows the placeholder and resets status when the source is empty', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()

    const editor = env.document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    editor.value = '   '
    await env.window.eval('doRender()')

    const previewInner = env.document.getElementById('preview-inner')!
    expect(previewInner.innerHTML).toContain(
      'Start typing to render your diagram',
    )
    expect(env.document.getElementById('status-text')!.textContent).toBe(
      'Ready',
    )
  })
})

describe('hexToRgb', () => {
  it('parses 6-digit and 3-digit hex colors', () => {
    const env = createEditorEnv()
    const hexToRgb = (
      env.window as unknown as { hexToRgb: (v: string) => unknown }
    ).hexToRgb
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('returns null for invalid input', () => {
    const env = createEditorEnv()
    const hexToRgb = (
      env.window as unknown as { hexToRgb: (v: string) => unknown }
    ).hexToRgb
    expect(hexToRgb('')).toBeNull()
    expect(hexToRgb('not-a-color')).toBeNull()
    expect(hexToRgb(null as unknown as string)).toBeNull()
  })
})
