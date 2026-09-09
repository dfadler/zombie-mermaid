import { editor } from './elements.ts'
import { setEditorTheme, state } from './state.ts'

export function encodeSource(src: string): string {
  try {
    return btoa(unescape(encodeURIComponent(src)))
  } catch {
    return ''
  }
}

export function decodeSource(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64)))
  } catch {
    return ''
  }
}

export function getHashSource(): string | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return null
  try {
    // JSON.parse's declared return type is `any`, matching the original
    // untyped JS here -- `obj.source`/`obj.theme` stay loosely checked on
    // purpose rather than validated, same as before this file had types.
    const obj = JSON.parse(decodeSource(hash))
    if (obj && obj.source) {
      if (obj.theme) {
        setEditorTheme(obj.theme)
      }
      return obj.source
    }
  } catch {
    // fall through to the raw-hash fallback below
  }
  return decodeSource(hash) || null
}

export function updateHash(): void {
  const obj: { source: string; theme?: string } = { source: editor.value }
  if (state.theme) obj.theme = state.theme
  window.history.replaceState(null, '', '#' + encodeSource(JSON.stringify(obj)))
}

// The window.__editorSharingState bridge for
// demo/components/editor-export.ts's copyURL() (zombie-mermaid#809) --
// this module isn't migrated by that issue (it's also used by
// rendering.ts's doRender(), well outside #809's five named files), and
// demo/components/*.tsx doesn't import from editor/js/*.ts directly (see
// demo/components/editor-app.tsx's requireEditorElement doc comment), so
// it exposes this one function the same way editor-helpers.ts exposes
// updateLineNumbers for the identical reason.
window.__editorSharingState = { updateHash }
