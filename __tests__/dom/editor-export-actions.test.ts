// @vitest-environment jsdom
/**
 * Direct-call unit tests for `editor-export-actions.ts` -- the pure/
 * framework-free decision and transform logic pulled out of
 * `editor-export.ts`'s `useEditorExport` (zombie-mermaid#809), split out
 * the same way zombie-mermaid#935's audit split `editor-config-helpers.ts`
 * out of `editor-config.tsx` (see that file's own `editor-config.test.ts`
 * for the style this mirrors). Unlike `__tests__/dom/editor-export.test.ts`,
 * none of these mount `<EditorApp>` -- they call the extracted functions
 * directly with a constructed SVG element, which is the actual payoff of
 * the extraction: this logic is now testable on its own.
 *
 * `svgElementToPngBlob` relies on an `<img>` decode-on-load round trip and
 * a `<canvas>` 2D context, neither of which jsdom implements without the
 * optional native `canvas` package (see `editor-export.test.ts`'s header
 * comment for the same limitation). These tests work around that by
 * replacing `Image` with a controllable fake (capturing the instance and
 * firing `onload`/`onerror` by hand) and, for the "successful
 * rasterization" case, stubbing `document.createElement('canvas')`'s
 * `getContext`/`toBlob`. The "no 2D context available" case deliberately
 * leaves `document.createElement` unstubbed, so it exercises jsdom's real
 * `getContext('2d')` -- which genuinely returns `null` without the
 * optional package -- proving the null-resolves branch against real jsdom
 * behavior, not just a mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resolveExportGuardMessage,
  svgElementToPngBlob,
  svgElementToSvgBlob,
} from '../../demo/components/editor-export-actions.ts'

function makeSvgEl(viewBox = '0 0 100 50'): SVGSVGElement {
  const svg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  ) as unknown as SVGSVGElement
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return svg
}

/** Controllable stand-in for the DOM `Image` -- see header comment. */
class FakeImage {
  static instances: FakeImage[] = []
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 0
  naturalHeight = 0
  src = ''
  constructor() {
    FakeImage.instances.push(this)
  }
}

beforeEach(() => {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  window.URL.revokeObjectURL = vi.fn()
  FakeImage.instances = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('resolveExportGuardMessage (extracted from editor-export.ts’s getSvgEl)', () => {
  it('points at switching output mode while ASCII output is showing', () => {
    expect(resolveExportGuardMessage('ascii')).toBe(
      'Switch to SVG output to export an image.',
    )
  })

  it('falls back to the generic "render first" message for SVG output', () => {
    expect(resolveExportGuardMessage('svg')).toBe('Render a diagram first.')
  })
})

describe('svgElementToSvgBlob (extracted from editor-export.ts’s exportSVG)', () => {
  it('serializes the svg element into an image/svg+xml blob', async () => {
    const svg = makeSvgEl()
    const blob = svgElementToSvgBlob(svg)

    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    const text = await blob.text()
    expect(text).toContain('<svg')
    expect(text).toContain('viewBox="0 0 100 50"')
  })
})

describe('svgElementToPngBlob (extracted from editor-export.ts’s svgToPngBlob)', () => {
  it('resolves the PNG blob canvas.toBlob produces, scaled by the given factor', async () => {
    vi.stubGlobal('Image', FakeImage)
    const fakeBlob = new Blob(['png-bytes'], { type: 'image/png' })
    const ctx = { scale: vi.fn(), drawImage: vi.fn() }
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreateElement(tag)
      if (tag === 'canvas') {
        Object.assign(el, {
          getContext: () => ctx,
          toBlob: (cb: BlobCallback) => cb(fakeBlob),
        })
      }
      return el
    })

    const svg = makeSvgEl()
    const promise = svgElementToPngBlob(svg, 3)

    const img = FakeImage.instances.at(-1)!
    img.naturalWidth = 100
    img.naturalHeight = 50
    img.onload?.()

    const blob = await promise
    expect(blob).toBe(fakeBlob)
    expect(ctx.scale).toHaveBeenCalledWith(3, 3)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('resolves null when no 2D canvas context is available (real jsdom behavior without the optional canvas package)', async () => {
    vi.stubGlobal('Image', FakeImage)
    const svg = makeSvgEl()
    const promise = svgElementToPngBlob(svg, 2)

    const img = FakeImage.instances.at(-1)!
    img.naturalWidth = 100
    img.naturalHeight = 50
    img.onload?.()

    await expect(promise).resolves.toBeNull()
  })

  it('rejects when the serialized svg fails to load as an image', async () => {
    vi.stubGlobal('Image', FakeImage)
    const svg = makeSvgEl()
    const promise = svgElementToPngBlob(svg, 1)

    const img = FakeImage.instances.at(-1)!
    img.onerror?.()

    await expect(promise).rejects.toThrow()
  })
})
