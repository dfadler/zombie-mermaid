/**
 * Framework-free helpers for the editor's PNG/SVG export and copy-image/
 * copy-link actions -- the decision/transform logic pulled out of
 * `editor-export.ts`'s `useEditorExport` (zombie-mermaid#809) so it's
 * directly callable from a test without mounting `<EditorApp>`, the same
 * split `editor-config-helpers.ts` did for the config panel's color/font/
 * padding helpers (zombie-mermaid#935's audit). No React, no refs, no
 * dispatch -- everything here is a plain function that takes DOM values in
 * and returns a value or a `Promise`, safe to import from a test file with
 * no risk of pulling in `useEditorExport`'s hook/wiring surface.
 *
 * Moved (behavior unchanged) from `editor-export.ts`; see that file's
 * `useEditorExport` for how these are wired to refs/dispatch/keyboard
 * shortcuts and the `<a download>`/clipboard side effects.
 */
import type { EditorState } from './editor-app.tsx'

/**
 * The "nothing rendered yet" guard message shared by all export/copy
 * actions that operate on the rendered `<svg>` (`exportPNG`, `exportSVG`,
 * `copyImage` -- `copyURL` doesn't touch the SVG at all). `outputMode`
 * (zombie-mermaid#976) only changes the toast copy, not the guard itself:
 * PNG/SVG-file export, copy-image, and the size pills all operate on the
 * rendered `<svg>` element, which simply doesn't exist in `#preview-inner`
 * while ASCII output is showing (see `editor-rendering.ts`'s `doRender`)
 * -- the exact same "nothing rendered yet" shape as an empty source, just
 * for a different reason, so a reader gets a message that tells them how
 * to fix it instead of the generic one.
 */
export function resolveExportGuardMessage(
  outputMode: EditorState['outputMode'],
): string {
  return outputMode === 'ascii'
    ? 'Switch to SVG output to export an image.'
    : 'Render a diagram first.'
}

/**
 * Serializes `svgEl` into a downloadable/copyable SVG `Blob`. Moved
 * verbatim from `editor-export.ts`'s `exportSVG`, which duplicated this
 * exact serialize-then-`Blob` pair inline; the old `svgToPngBlob` did its
 * own separate copy of the same two lines to get an object URL for the
 * `<img>` it rasterizes through, so both now share this one function.
 */
export function svgElementToSvgBlob(svgEl: SVGSVGElement): Blob {
  const serialized = new XMLSerializer().serializeToString(svgEl)
  return new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
}

/**
 * Promisified wrapper around `editor-export.ts`'s old `svgToPngBlob`
 * callback pair -- rasterizes `svgEl` onto a `<canvas>` at `scale`x via an
 * `<img>` load round-trip and resolves the PNG `Blob`. Preserves the old
 * callback's exact branching, just expressed as a `Promise`:
 * - No 2D canvas context available: resolves `null` (the old code silently
 *   returned without invoking either callback -- callers already treat a
 *   `null`/falsy blob as a no-op, so this stays a no-op resolution rather
 *   than a rejection).
 * - `canvas.toBlob`'s own callback can itself pass `null` (per the DOM
 *   spec, e.g. an unsupported/zero-size canvas): resolves `null` too, for
 *   the same reason.
 * - The `<img>` fails to load the serialized SVG: rejects, matching the
 *   old `onError` path -- callers show the same "PNG export failed."
 *   toast from their `.catch`.
 */
export function svgElementToPngBlob(
  svgEl: SVGSVGElement,
  scale: number,
): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const svgBlob = svgElementToSvgBlob(svgEl)
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = function () {
      const canvas = document.createElement('canvas')
      const w = img.naturalWidth || svgEl.viewBox.baseVal.width || 800
      const h = img.naturalHeight || svgEl.viewBox.baseVal.height || 600
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(null)
        return
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    }
    img.onerror = function () {
      URL.revokeObjectURL(url)
      reject(new Error('svg image load failed'))
    }
    img.src = url
  })
}
