import { describe, expect, it } from 'vitest'
import { createEditorEnv, flushRenderTimers } from './support/harness.ts'

interface EditorWindow extends Window {
  state: { theme: string; zoom: number; config: Record<string, unknown> }
  cfgColors: Record<string, string>
  cfgFont: string
  cfgPadding: number
  cfgEdgeStroke: number
  cfgNodeStroke: number
  readConfig: () => void
  buildOptions: () => Record<string, unknown>
  setPadding: (val: number | string) => void
  setActiveColor: (hex: string) => void
  openColorPopup: (key: string, anchorEl: Element) => void
  setTheme: (key: string) => void
  applyStrokeOverrides: (svgEl: SVGElement) => void
  __mermaid: { THEMES: Record<string, { bg: string; fg: string }> }
}

function asEditorWindow(env: ReturnType<typeof createEditorEnv>): EditorWindow {
  return env.window as unknown as EditorWindow
}

describe('config panel state', () => {
  it('readConfig only includes overridden fields', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    // Nothing overridden yet -> empty config.
    win.readConfig()
    expect(win.state.config).toEqual({})

    win.cfgColors.bg = '#111111'
    win.cfgFont = 'Inter'
    win.cfgPadding = 40
    win.readConfig()

    expect(win.state.config).toEqual({
      bg: '#111111',
      font: 'Inter',
      padding: 40,
    })
  })

  it('buildOptions merges the active theme with config overrides, config wins', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    win.setTheme('nord')
    win.cfgColors.bg = '#custom'
    win.readConfig()

    const opts = win.buildOptions()
    expect(opts.bg).toBe('#custom')
    expect(opts.fg).toBe(win.__mermaid.THEMES.nord.fg)
  })

  it('setPadding clamps to [0, 120] and updates state.config', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    win.setPadding(500)
    expect(win.cfgPadding).toBe(120)
    expect(win.state.config.padding).toBe(120)

    win.setPadding(-20)
    expect(win.cfgPadding).toBe(0)
    expect(win.state.config.padding).toBe(0)
  })

  it('setActiveColor updates cfgColors and state.config for the active key', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)
    const anchor = env.document.querySelector(
      '.color-edit-btn[data-cfg="accent"]',
    )!

    win.openColorPopup('accent', anchor)
    win.setActiveColor('#ABCDEF')

    expect(win.cfgColors.accent).toBe('#ABCDEF')
    win.readConfig()
    expect(win.state.config.accent).toBe('#ABCDEF')
  })

  it('setTheme updates state.theme and persists to localStorage', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    win.setTheme('one-dark')
    expect(win.state.theme).toBe('one-dark')
    expect(win.localStorage.getItem('bm-editor-theme')).toBe('one-dark')

    win.setTheme('')
    expect(win.state.theme).toBe('')
    expect(win.localStorage.getItem('bm-editor-theme')).toBeNull()
  })

  it('feeds config changes through to the actual render call', async () => {
    const env = createEditorEnv()
    await flushRenderTimers()
    env.renderMermaidSVGAsync.mockClear()
    const win = asEditorWindow(env)

    win.cfgPadding = 80
    win.readConfig()
    await env.window.eval('doRender()')

    const [, opts] = env.renderMermaidSVGAsync.mock.calls.at(-1)!
    expect(opts).toMatchObject({ padding: 80 })
  })
})

describe('stroke overrides', () => {
  it('applies edge/node stroke-width to non-defs elements only', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    const svg = env.document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    )
    svg.innerHTML = `
      <defs><marker id="m"><path fill="none" /></marker></defs>
      <line x1="0" y1="0" x2="1" y2="1"></line>
      <rect width="10" height="10"></rect>
    `
    env.document.body.appendChild(svg)

    win.cfgEdgeStroke = 3
    win.cfgNodeStroke = 2
    win.applyStrokeOverrides(svg)

    const line = svg.querySelector('line')!
    expect(line.getAttribute('stroke-width')).toBe('3')
    const rect = svg.querySelector('rect')!
    expect(rect.getAttribute('stroke-width')).toBe('2')
    // The path lives inside <defs> and must be left alone.
    const pathInDefs = svg.querySelector('defs path')!
    expect(pathInDefs.getAttribute('stroke-width')).toBeNull()
  })
})
