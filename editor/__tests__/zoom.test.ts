import { describe, expect, it } from 'vitest'
import { createEditorEnv } from './support/harness.ts'

interface EditorWindow extends Window {
  state: { theme: string; zoom: number; config: Record<string, unknown> }
  applyZoom: (z: number) => void
  getSvgNaturalSize: (svgEl: SVGElement) => { w: number; h: number }
}

function asEditorWindow(env: ReturnType<typeof createEditorEnv>): EditorWindow {
  return env.window as unknown as EditorWindow
}

describe('zoom', () => {
  it('scales the rendered SVG and updates the zoom label', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)
    const previewInner = env.document.getElementById('preview-inner')!
    previewInner.innerHTML =
      '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg"></svg>'
    const svg = previewInner.querySelector(
      'svg',
    ) as unknown as SVGSVGElement & {
      style: CSSStyleDeclaration
    }

    win.applyZoom(2)

    expect(win.state.zoom).toBe(2)
    expect(svg.style.width).toBe('200px')
    expect(svg.style.height).toBe('100px')
    expect(env.document.getElementById('zoom-label')!.textContent).toBe('200%')
  })

  it('clamps zoom to [0.1, 8]', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)

    win.applyZoom(100)
    expect(win.state.zoom).toBe(8)

    win.applyZoom(0)
    expect(win.state.zoom).toBe(0.1)
  })

  it('getSvgNaturalSize prefers the viewBox over attributes', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)
    const svg = env.document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    )
    svg.setAttribute('viewBox', '0 0 300 150')
    svg.setAttribute('width', '999')
    svg.setAttribute('height', '999')

    expect(win.getSvgNaturalSize(svg)).toEqual({ w: 300, h: 150 })
  })

  it('getSvgNaturalSize falls back to width/height attributes without a viewBox', () => {
    const env = createEditorEnv()
    const win = asEditorWindow(env)
    const svg = env.document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    )
    svg.setAttribute('width', '640')
    svg.setAttribute('height', '480')

    expect(win.getSvgNaturalSize(svg)).toEqual({ w: 640, h: 480 })
  })
})
