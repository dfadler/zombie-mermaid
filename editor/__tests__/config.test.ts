import { describe, expect, it } from 'vitest'
import { createEditorEnv, flushRenderTimers } from './support/harness.ts'

interface EditorWindow extends Window {
  state: { theme: string }
  buildOptions: () => Record<string, unknown>
  setTheme: (key: string) => void
  __mermaid: { THEMES: Record<string, { bg: string; fg: string }> }
  __themeState: {
    getTheme(): string
    setTheme(key: string): void
    subscribe(listener: (themeKey: string) => void): () => void
  }
  __editorConfigState: {
    getConfig(): Record<string, unknown>
    applyStrokeOverrides(svgEl: SVGSVGElement | null): void
  }
}

function asEditorWindow(env: ReturnType<typeof createEditorEnv>): EditorWindow {
  return env.window as unknown as EditorWindow
}

// zombie-mermaid#808 ported editor/js/config-panel.ts,
// editor/js/color-picker.ts, and editor/js/font-picker.ts (and their
// cfgColors/cfgFont/cfgPadding/cfgEdgeStroke/cfgNodeStroke/readConfig/
// setPadding/setActiveColor/openColorPopup/applyStrokeOverrides exports)
// to React -- see demo/components/editor-config.tsx and its own
// __tests__/dom/editor-config.test.ts (RTL) for that coverage now.
// state.theme/window.__themeState stay legacy (out of #808's scope), so
// those tests remain here unchanged in spirit, just no longer coupled to
// the now-deleted cfgColors/readConfig() exports.
describe('config panel state', () => {
  it('buildOptions merges the active theme with config overrides, config wins', async () => {
    const env = await createEditorEnv()
    const win = asEditorWindow(env)

    win.setTheme('nord')
    // window.__editorConfigState (zombie-mermaid#808's bridge, stubbed by
    // the harness) stands in for the React-owned config overrides
    // demo/components/editor-config.tsx's ConfigPanel would otherwise
    // supply -- see that file's header comment.
    win.__editorConfigState.getConfig = () => ({ bg: '#custom' })

    const opts = win.buildOptions()
    expect(opts.bg).toBe('#custom')
    expect(opts.fg).toBe(win.__mermaid.THEMES.nord.fg)
  })

  it('setTheme updates state.theme and persists through the shared theme-state key (#688)', async () => {
    const env = await createEditorEnv()
    const win = asEditorWindow(env)

    // #688: the editor's theme now persists under the same shared
    // 'mermaid-theme' key every other page reads/writes through
    // window.__themeState (demo/theme-state.ts) -- not its own
    // now-retired 'bm-editor-theme' key.
    win.setTheme('one-dark')
    expect(win.state.theme).toBe('one-dark')
    expect(win.localStorage.getItem('mermaid-theme')).toBe('one-dark')

    win.setTheme('')
    expect(win.state.theme).toBe('')
    expect(win.localStorage.getItem('mermaid-theme')).toBeNull()
  })

  it('migrates a legacy bm-editor-theme value through window.__themeState.setTheme() (#688)', async () => {
    const env = await createEditorEnv({
      localStorage: { 'bm-editor-theme': 'nord' },
    })
    const win = asEditorWindow(env)

    // The migration (init.js, module-top-level) runs once, before this
    // test ever calls anything -- it should have already persisted the
    // legacy value under the shared key and discarded the old one.
    expect(win.localStorage.getItem('mermaid-theme')).toBe('nord')
    expect(win.localStorage.getItem('bm-editor-theme')).toBeNull()
    expect(win.state.theme).toBe('nord')
  })

  it('does not let a legacy bm-editor-theme value override an already-set shared preference', async () => {
    const env = await createEditorEnv({
      localStorage: { 'mermaid-theme': 'dracula', 'bm-editor-theme': 'nord' },
    })
    const win = asEditorWindow(env)

    expect(win.localStorage.getItem('mermaid-theme')).toBe('dracula')
    expect(win.state.theme).toBe('dracula')
  })

  it('reapplies the theme when window.__themeState notifies a change from elsewhere', async () => {
    const env = await createEditorEnv()
    const win = asEditorWindow(env)

    // Simulates a theme picked on another page/tab -- not this page's own
    // setTheme() click handler -- reaching this page via the shared
    // theme-state module's subscribe() mechanism.
    win.__themeState.setTheme('one-dark')

    expect(win.state.theme).toBe('one-dark')
    expect(win.localStorage.getItem('mermaid-theme')).toBe('one-dark')
  })

  it('feeds config changes through to the actual render call', async () => {
    const env = await createEditorEnv()
    await flushRenderTimers()
    env.renderMermaidSVGAsync.mockClear()
    const win = asEditorWindow(env)

    win.__editorConfigState.getConfig = () => ({ padding: 80 })
    await env.window.eval('doRender()')

    const [, opts] = env.renderMermaidSVGAsync.mock.calls.at(-1)!
    expect(opts).toMatchObject({ padding: 80 })
  })
})
