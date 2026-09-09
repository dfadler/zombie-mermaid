/**
 * The export dropdown (PNG/SVG/copy-image/copy-link, size pills, and their
 * keyboard shortcuts) as React state (zombie-mermaid#809). Replaces
 * `editor/js/export.ts`'s module-level `exportScale` variable and its
 * top-level `addEventListener` wiring with `editor-app.tsx`'s reducer
 * (`exportScale`, `exportDropdownOpen`) and {@link useEditorExport}, called
 * directly from `<EditorApp>`'s own body -- the same shape
 * `editor-viewport.ts`'s `useEditorViewport` established for #807.
 *
 * `copyURL()`'s one legacy dependency, `editor/js/sharing.ts`'s
 * `updateHash()`, is reached through `window.__editorSharingState` --
 * `sharing.ts` isn't migrated by this issue (not one of #809's five named
 * files), and `demo/components/*.tsx` doesn't import from `editor/js/*.ts`
 * (see `editor-app.tsx`'s `requireEditorElement` doc comment), so
 * `sharing.ts` now exposes this one function on `window` for this hook to
 * call -- the mirror image of `window.__editorViewportState` (there, a
 * still-legacy module calls into React-owned state; here, React calls into
 * a still-legacy function). See `editor/js/global.d.ts` for the ambient
 * declaration and `sharing.ts` for the one-line registration.
 */
import { useLayoutEffect, useRef, type Dispatch } from 'react'
import type { EditorAction, EditorRefs, EditorState } from './editor-app.tsx'

declare global {
  interface Window {
    __editorSharingState: {
      updateHash(): void
    }
  }
}

export interface UseEditorExportArgs {
  state: EditorState
  dispatch: Dispatch<EditorAction>
  refs: { current: EditorRefs | null }
}

function getSvgEl(
  refs: EditorRefs,
  dispatch: Dispatch<EditorAction>,
): SVGSVGElement | null {
  const el = refs.previewInner.querySelector<SVGSVGElement>('svg')
  if (!el) {
    dispatch({ type: 'SHOW_TOAST', message: 'Render a diagram first.' })
    return null
  }
  return el
}

function svgToPngBlob(
  svgEl: SVGSVGElement,
  scale: number,
  cb: BlobCallback,
  onError: () => void,
): void {
  const serialized = new XMLSerializer().serializeToString(svgEl)
  const svgBlob = new Blob([serialized], {
    type: 'image/svg+xml;charset=utf-8',
  })
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
      return
    }
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob(cb, 'image/png')
  }
  img.onerror = function () {
    URL.revokeObjectURL(url)
    onError()
  }
  img.src = url
}

/**
 * Wires the export dropdown, its size pills, and the export keyboard
 * shortcuts -- replacing `editor/js/export.ts`'s module-top-level
 * equivalent. Call once, unconditionally, from `<EditorApp>`'s own body.
 */
export function useEditorExport({
  state,
  dispatch,
  refs,
}: UseEditorExportArgs): void {
  const stateRef = useRef(state)
  stateRef.current = state

  const exportPNG = useRef((): void => {
    const r = refs.current
    if (!r) return
    const svgEl = getSvgEl(r, dispatch)
    if (!svgEl) return
    svgToPngBlob(
      svgEl,
      stateRef.current.exportScale,
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'diagram.png'
        a.click()
        URL.revokeObjectURL(url)
        dispatch({
          type: 'SHOW_TOAST',
          message: 'PNG saved (' + stateRef.current.exportScale + 'x)',
        })
        dispatch({ type: 'SET_EXPORT_DROPDOWN_OPEN', open: false })
      },
      () => dispatch({ type: 'SHOW_TOAST', message: 'PNG export failed.' }),
    )
  })

  const exportSVG = useRef((): void => {
    const r = refs.current
    if (!r) return
    const svgEl = getSvgEl(r, dispatch)
    if (!svgEl) return
    const data = new XMLSerializer().serializeToString(svgEl)
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'SHOW_TOAST', message: 'SVG saved!' })
    dispatch({ type: 'SET_EXPORT_DROPDOWN_OPEN', open: false })
  })

  const copyImage = useRef((): void => {
    const r = refs.current
    if (!r) return
    const svgEl = getSvgEl(r, dispatch)
    if (!svgEl) return
    svgToPngBlob(
      svgEl,
      stateRef.current.exportScale,
      (blob) => {
        if (!blob) return
        try {
          navigator.clipboard
            .write([new ClipboardItem({ 'image/png': blob })])
            .then(() => {
              dispatch({
                type: 'SHOW_TOAST',
                message: 'Image copied to clipboard!',
              })
              dispatch({ type: 'SET_EXPORT_DROPDOWN_OPEN', open: false })
            })
        } catch {
          dispatch({
            type: 'SHOW_TOAST',
            message: 'Copy not supported in this browser.',
          })
        }
      },
      () => dispatch({ type: 'SHOW_TOAST', message: 'PNG export failed.' }),
    )
  })

  const copyURL = useRef((): void => {
    window.__editorSharingState.updateHash()
    navigator.clipboard.writeText(window.location.href).then(() => {
      dispatch({ type: 'SHOW_TOAST', message: 'URL copied to clipboard!' })
      dispatch({ type: 'SET_EXPORT_DROPDOWN_OPEN', open: false })
    })
  })

  // Chevron toggles the dropdown; main button exports PNG directly.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onChevron = (e: Event) => {
      e.stopPropagation()
      dispatch({
        type: 'SET_EXPORT_DROPDOWN_OPEN',
        open: !stateRef.current.exportDropdownOpen,
      })
    }
    const onMain = () => exportPNG.current()
    r.exportChevronBtn.addEventListener('click', onChevron)
    r.exportMainBtn.addEventListener('click', onMain)
    return () => {
      r.exportChevronBtn.removeEventListener('click', onChevron)
      r.exportMainBtn.removeEventListener('click', onMain)
    }
  }, [refs, dispatch])

  // Clicking outside #export-wrap closes the dropdown.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !r.exportWrap.contains(e.target)) {
        dispatch({ type: 'SET_EXPORT_DROPDOWN_OPEN', open: false })
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [refs, dispatch])

  // Size pills -- editor/js/export.ts's old delegated click listener.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onClick = (e: MouseEvent) => {
      const pill =
        e.target instanceof Element ? e.target.closest('.size-pill') : null
      if (!pill || !(pill instanceof HTMLElement)) return
      const scale = parseInt(pill.dataset.scale || '', 10)
      dispatch({ type: 'SET_EXPORT_SCALE', scale })
    }
    r.sizePills.addEventListener('click', onClick)
    return () => r.sizePills.removeEventListener('click', onClick)
  }, [refs, dispatch])

  // Sync the size pills' `.active` class with state.exportScale.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.sizePills.querySelectorAll<HTMLElement>('.size-pill').forEach((pill) => {
      pill.classList.toggle(
        'active',
        parseInt(pill.dataset.scale || '', 10) === state.exportScale,
      )
    })
  }, [state.exportScale, refs])

  // Sync the dropdown's `.open` class with state.exportDropdownOpen.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    r.exportDropdown.classList.toggle('open', state.exportDropdownOpen)
  }, [state.exportDropdownOpen, refs])

  // Export/copy keyboard shortcuts -- editor/js/export.ts's old
  // document-level keydown listener.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onKeydown = (e: KeyboardEvent) => {
      if (e.target === r.editor) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        exportPNG.current()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        exportSVG.current()
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'c') {
        e.preventDefault()
        copyImage.current()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        copyURL.current()
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [refs])

  // Export/copy buttons themselves.
  useLayoutEffect(() => {
    const r = refs.current
    if (!r) return
    const onPng = () => exportPNG.current()
    const onSvg = () => exportSVG.current()
    const onCopyImg = () => copyImage.current()
    const onCopyLink = () => copyURL.current()
    r.exportPngBtn.addEventListener('click', onPng)
    r.exportSvgBtn.addEventListener('click', onSvg)
    r.copyImageBtn.addEventListener('click', onCopyImg)
    r.copyLinkBtn.addEventListener('click', onCopyLink)
    return () => {
      r.exportPngBtn.removeEventListener('click', onPng)
      r.exportSvgBtn.removeEventListener('click', onSvg)
      r.copyImageBtn.removeEventListener('click', onCopyImg)
      r.copyLinkBtn.removeEventListener('click', onCopyLink)
    }
  }, [refs])
}
