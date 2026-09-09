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
