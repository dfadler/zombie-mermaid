/** @jsxRuntime automatic */
/**
 * The shared color-editing popup -- split out of `editor-config.tsx`
 * (zombie-mermaid#935's audit) as an independent presentational component:
 * every field it needs (which key is active, the popup's position, the
 * in-progress hex text) is threaded in as props by `editor-config.tsx`'s
 * `ConfigPanel`, which still owns that state locally (see that file's
 * header comment for why it's local rather than lifted into the reducer).
 * Was `editor-panels.tsx`'s static `#color-popup` markup, wired imperatively
 * by `editor/js/color-picker.ts`, before #808.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */
import {
  COLOR_LABELS,
  COLOR_PRESETS,
  isValidHexColor,
  type ColorKey,
  type PopupPosition,
} from './editor-config-helpers.ts'
import { useCloseOnOutsideClick } from './use-close-on-outside-click.ts'

/** Mirrors `editor/js/color-picker.ts`'s `openColorPopup()` position math (240px-wide popup, flips above the anchor if it would overflow the viewport bottom). */
export function computeColorPopupPosition(anchorRect: DOMRect): PopupPosition {
  const pw = 240
  let left = anchorRect.right - pw
  if (left < 8) left = 8
  let top = anchorRect.bottom + 6
  if (top + 400 > window.innerHeight) top = anchorRect.top - 406
  return { left, top }
}

export interface ColorPopupProps {
  activeKey: ColorKey | null
  position: PopupPosition | null
  value: string
  hexInput: string
  onHexInputChange: (raw: string) => void
  onNativeChange: (hex: string) => void
  onPickPreset: (hex: string) => void
  onClear: () => void
  onClose: () => void
}

export function ColorPopup({
  activeKey,
  position,
  value,
  hexInput,
  onHexInputChange,
  onNativeChange,
  onPickPreset,
  onClear,
  onClose,
}: ColorPopupProps) {
  useCloseOnOutsideClick(
    activeKey !== null,
    '#color-popup',
    '.color-edit-btn',
    onClose,
  )
  const nativeValue = isValidHexColor(value) ? value : '#ffffff'
  return (
    <div
      className={'color-popup' + (activeKey !== null ? ' open' : '')}
      id="color-popup"
      style={
        position
          ? { left: position.left + 'px', top: position.top + 'px' }
          : undefined
      }
    >
      <div className="color-popup-header">
        <span className="color-popup-title" id="color-popup-title">
          {activeKey ? COLOR_LABELS[activeKey] : 'Color'}
        </span>
        <button
          type="button"
          className="color-popup-close"
          id="color-popup-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="color-hex-row">
        <input
          type="color"
          className="color-native"
          id="color-native-input"
          value={nativeValue}
          onChange={(e) => onNativeChange(e.currentTarget.value)}
        />
        <input
          type="text"
          className="color-hex-input"
          id="color-hex-input"
          placeholder="#rrggbb"
          maxLength={9}
          value={hexInput}
          onChange={(e) => onHexInputChange(e.currentTarget.value)}
        />
        <button
          type="button"
          className="color-clear-btn"
          id="color-clear-btn"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <div className="color-palette-title">Presets</div>
      <div className="color-palette" id="color-palette">
        {COLOR_PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="color-swatch-btn"
            style={{ background: hex }}
            title={hex}
            onClick={() => onPickPreset(hex)}
          />
        ))}
      </div>
    </div>
  )
}
