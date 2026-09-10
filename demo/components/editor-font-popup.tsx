/** @jsxRuntime automatic */
/**
 * The font-picker popup -- split out of `editor-config.tsx`
 * (zombie-mermaid#935's audit) as an independent presentational component,
 * the same treatment as `editor-color-popup.tsx`'s `ColorPopup`: its
 * open/search state stays local to `editor-config.tsx`'s `ConfigPanel`
 * (see that file's header comment for why) and is threaded in as props.
 * Was `editor-panels.tsx`'s static `#font-popup` markup, wired imperatively
 * by `editor/js/font-picker.ts`, before #808.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { useEffect, useState, type RefObject } from 'react'
import {
  getBrowserLoadedFontNames,
  PRESET_FONTS,
  type PopupPosition,
  type PresetFont,
} from './editor-config-helpers.ts'
import { useCloseOnOutsideClick } from './use-close-on-outside-click.ts'

/** Mirrors `editor/js/font-picker.ts`'s `openFontPopup()` position math. */
export function computeFontPopupPosition(anchorRect: DOMRect): PopupPosition {
  let left = anchorRect.right - 220
  if (left < 8) left = 8
  return { left, top: anchorRect.bottom + 6 }
}

/** The font popup's own search-field icon -- only ever used here, so it stays private rather than joining icons.tsx's shared set. */
function StrokeSearchIcon() {
  return (
    <svg
      className="font-search-icon"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export interface FontPopupProps {
  open: boolean
  search: string
  currentFont: string
  onSearchChange: (query: string) => void
  onSelect: (value: string) => void
  onClose: () => void
  position: PopupPosition | null
  searchInputRef: RefObject<HTMLInputElement | null>
}

export function FontPopup({
  open,
  search,
  currentFont,
  onSearchChange,
  onSelect,
  onClose,
  position,
  searchInputRef,
}: FontPopupProps) {
  useCloseOnOutsideClick(open, '#font-popup', '#font-select-btn', onClose)
  const [browserFonts, setBrowserFonts] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setBrowserFonts(getBrowserLoadedFontNames(search))
  }, [open, search])

  // Only built while open -- matches editor/js/font-picker.ts's
  // buildFontList(), which only ever ran from openFontPopup()/the search
  // input's own listener, leaving #font-list genuinely empty in the
  // markup the rest of the time (confirmed against
  // __tests__/site-equivalence.test.ts's golden SSR snapshot, which pins
  // exactly that).
  const q = search.toLowerCase()
  const groups = new Map<string, PresetFont[]>()
  if (open) {
    const filtered = PRESET_FONTS.filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    )
    for (const f of filtered) {
      const list = groups.get(f.group)
      if (list) list.push(f)
      else groups.set(f.group, [f])
    }
  }

  return (
    <div
      className={'font-popup' + (open ? ' open' : '')}
      id="font-popup"
      style={
        position
          ? { left: position.left + 'px', top: position.top + 'px' }
          : undefined
      }
    >
      <div className="font-search-wrap">
        <StrokeSearchIcon />
        <input
          ref={searchInputRef}
          className="font-search"
          id="font-search"
          placeholder="Quick search"
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
      </div>
      <div className="font-list" id="font-list">
        {[...groups.entries()].map(([group, fonts]) => (
          <div key={group}>
            <div className="font-section-label">{group}</div>
            {fonts.map((f) => (
              <div
                key={f.value}
                className={
                  'font-item' + (currentFont === f.value ? ' active' : '')
                }
                onClick={() => onSelect(f.value)}
              >
                <span
                  className="font-item-preview"
                  style={{ fontFamily: f.value + ', sans-serif' }}
                >
                  Aa
                </span>
                <span className="font-item-name">{f.name}</span>
              </div>
            ))}
          </div>
        ))}
        {open && browserFonts.length > 0 && (
          <div>
            <div className="font-section-label">Loaded in browser</div>
            {browserFonts.map((name) => (
              <div
                key={name}
                className={
                  'font-item' + (currentFont === name ? ' active' : '')
                }
                onClick={() => onSelect(name)}
              >
                <span
                  className="font-item-preview"
                  style={{ fontFamily: name + ', sans-serif' }}
                >
                  Aa
                </span>
                <span className="font-item-name">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
