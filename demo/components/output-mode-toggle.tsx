/** @jsxRuntime automatic */
/**
 * The segmented "SVG / ASCII" output toggle — the two `.output-segment`/
 * `.output-segment.active` buttons `hero-output-panel.tsx`'s
 * `HeroOutputPanel` and `diagram-detail-app.tsx`'s `DetailOutputPanel`
 * independently rendered, byte-for-byte identical, before this extraction.
 * Both callers keep owning their own `useState<OutputMode>` — this
 * component only renders the two buttons and reports clicks via
 * {@link OutputModeToggleProps.onChange}, the same "state stays with the
 * caller" shape `editor-tabs.ts`'s `useEditorTabs` uses for the Code/Config
 * switcher.
 */
import { RADIUS, colorVar } from './tokens.tsx'

export type OutputMode = 'svg' | 'ascii'

export interface OutputModeToggleProps {
  /** Which button reads as pressed/`.active`. */
  mode: OutputMode
  /** Called with the clicked button's mode. */
  onChange: (mode: OutputMode) => void
}

export function OutputModeToggle({ mode, onChange }: OutputModeToggleProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        background: colorVar('--panel'),
        borderRadius: `${RADIUS.pill}px`,
        padding: '2px',
      }}
    >
      <button
        type="button"
        className={`output-segment${mode === 'svg' ? ' active' : ''}`}
        aria-pressed={mode === 'svg'}
        onClick={() => onChange('svg')}
      >
        SVG
      </button>
      <button
        type="button"
        className={`output-segment${mode === 'ascii' ? ' active' : ''}`}
        aria-pressed={mode === 'ascii'}
        onClick={() => onChange('ascii')}
      >
        ASCII
      </button>
    </div>
  )
}
