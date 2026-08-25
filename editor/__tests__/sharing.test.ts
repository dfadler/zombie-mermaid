import { describe, expect, it } from 'vitest'
import { createEditorEnv, flushRenderTimers } from './support/harness.ts'

describe('sharing (URL hash source)', () => {
  it('round-trips arbitrary source text through encodeSource/decodeSource', () => {
    const env = createEditorEnv()
    const encodeSource = (
      env.window as unknown as { encodeSource: (s: string) => string }
    ).encodeSource
    const decodeSource = (
      env.window as unknown as { decodeSource: (s: string) => string }
    ).decodeSource

    const original = 'graph TD\n  A[héllo "world"] --> B{日本語}'
    expect(decodeSource(encodeSource(original))).toBe(original)
  })

  it('encodes the current source and theme into the URL hash', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()

    const editor = env.document.getElementById(
      'code-editor',
    ) as HTMLTextAreaElement
    editor.value = 'graph TD\n  A --> B'
    env.window.eval("setTheme('nord')")

    env.window.eval('updateHash()')

    const decodeSource = (
      env.window as unknown as { decodeSource: (s: string) => string }
    ).decodeSource
    const hash = env.window.location.hash.slice(1)
    const decoded = JSON.parse(decodeSource(hash))
    expect(decoded).toEqual({ source: 'graph TD\n  A --> B', theme: 'nord' })
  })

  it('reads source and theme back out of an existing URL hash', () => {
    const env = createEditorEnv()
    const encodeSource = (
      env.window as unknown as { encodeSource: (s: string) => string }
    ).encodeSource

    const payload = JSON.stringify({
      source: 'graph LR\n  X --> Y',
      theme: 'dracula',
    })
    env.window.location.hash = '#' + encodeSource(payload)

    const getHashSource = (
      env.window as unknown as { getHashSource: () => string | null }
    ).getHashSource
    const source = getHashSource()

    expect(source).toBe('graph LR\n  X --> Y')
    const state = (env.window as unknown as { state: { theme: string } }).state
    expect(state.theme).toBe('dracula')
  })

  it('returns null when there is no hash', () => {
    const env = createEditorEnv()
    env.window.location.hash = ''
    const getHashSource = (
      env.window as unknown as { getHashSource: () => string | null }
    ).getHashSource
    expect(getHashSource()).toBeNull()
  })
})
