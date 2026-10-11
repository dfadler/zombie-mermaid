/**
 * Closes an open popup on a click outside it -- split out of
 * `editor-config.tsx` (zombie-mermaid#935's audit) since it's shared,
 * unmodified, by two now-separate files: `editor-color-popup.tsx`'s
 * `ColorPopup` and `editor-font-popup.tsx`'s `FontPopup`. Mirrors
 * `editor/js/color-picker.ts`'s/`font-picker.ts`'s identical
 * `document.addEventListener('click', ...)` + `closest()` pattern.
 */
import { useEffect } from 'react'

function eventTargetClosest(
  target: EventTarget | null,
  selector: string,
): Element | null {
  return target instanceof Element ? target.closest(selector) : null
}

/**
 * `excludeSelector` additionally exempts the trigger button itself (its own
 * click handler already toggles the popup; without the exemption, the same
 * click would immediately re-close what it just opened, since this
 * document-level listener also fires for it).
 */
export function useCloseOnOutsideClick(
  isOpen: boolean,
  popupSelector: string,
  excludeSelector: string,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return
    function onDocumentClick(e: MouseEvent): void {
      if (
        !eventTargetClosest(e.target, popupSelector) &&
        !eventTargetClosest(e.target, excludeSelector)
      ) {
        onClose()
      }
    }
    document.addEventListener('click', onDocumentClick)
    return () => {
      document.removeEventListener('click', onDocumentClick)
    }
  }, [isOpen, popupSelector, excludeSelector, onClose])
}
