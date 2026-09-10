/** @jsxRuntime automatic */
/**
 * A numeric field + linked range slider -- split out of `editor-config.tsx`
 * (zombie-mermaid#935's audit) as an independent, fully generic presentational
 * component: it holds no state and knows nothing about colors, fonts, or the
 * config panel that reuses it three times (padding, edge stroke, node
 * stroke). Was `editor-panels.tsx`'s static `PaddingField` before #808.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here --
 * see the `jsx` comment in demo/tsconfig.json.
 */

export interface NumberSliderFieldProps {
  label: string
  id: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
}

export function NumberSliderField({
  label,
  id,
  min,
  max,
  step,
  value,
  onChange,
}: NumberSliderFieldProps) {
  return (
    <div className="padding-field">
      <div className="padding-row">
        <label>{label}</label>
        <input
          className="padding-num"
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.currentTarget.value) || 0)}
        />
      </div>
      <input
        className="padding-slider"
        id={`${id}-slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.currentTarget.value) || 0)}
      />
    </div>
  )
}
