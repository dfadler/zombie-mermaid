/** @jsxRuntime automatic */
/**
 * One color row in the Config tab's Colors section -- split out of
 * `editor-config.tsx` (zombie-mermaid#935's audit) as an independent,
 * stateless presentational component: it owns no state of its own, just
 * renders a label + swatch button and reports a click up to its caller
 * (`editor-config.tsx`'s `ConfigPanel`, which owns the shared color popup
 * this button opens). Was `editor-panels.tsx`'s static `ColorField` before
 * #808.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */
import { COLOR_LABELS, type ColorKey } from './editor-config-helpers.ts'

export interface ColorFieldProps {
  colorKey: ColorKey
  override: string
  themeColor: string | null
  onOpen: (key: ColorKey, anchorEl: HTMLElement) => void
}

export function ColorField({
  colorKey,
  override,
  themeColor,
  onOpen,
}: ColorFieldProps) {
  const effective = override || themeColor
  return (
    <div className="color-field">
      <span className="color-field-label">{COLOR_LABELS[colorKey]}</span>
      <button
        type="button"
        className="color-edit-btn"
        data-cfg={colorKey}
        title={
          override
            ? 'Override: ' + override
            : themeColor
              ? 'Theme default: ' + themeColor
              : 'Not set'
        }
        onClick={(e) => onOpen(colorKey, e.currentTarget)}
      >
        <span
          className="cfg-hex-label"
          id={`cfg-${colorKey}-label`}
          style={{ opacity: override ? 1 : 0.45 }}
        >
          {override || themeColor || '—'}
        </span>
        <span
          className="color-swatch"
          id={`cfg-${colorKey}-swatch`}
          style={{
            background: effective || 'transparent',
            border: effective
              ? '1px solid rgba(0,0,0,0.15)'
              : '1px dashed var(--fg3)',
            opacity: override ? 1 : themeColor ? 0.6 : 1,
          }}
        />
      </button>
    </div>
  )
}
