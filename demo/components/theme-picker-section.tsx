/** @jsxRuntime automatic */
/**
 * A page-body "Pick a look" section wrapping {@link ThemePicker} — the
 * global theme control's home on every page that isn't `pages.ts`'s
 * per-diagram-type detail page (which already has its own copy of this
 * exact markup, predating this extraction — see `demo/components/
 * diagram-page.tsx`'s `DiagramTypePage`, left as-is rather than migrated
 * onto this component to keep #687's diff additive).
 *
 * Part of #687 (wiring the theme selector, from #686, onto every page).
 * See `docs/decisions/theme-selector-shared-state.md` for why this renders
 * as a body section rather than folding into `Nav` (`demo/components/
 * nav.tsx`): `Nav` is pinned byte-for-byte to the #590 design canvas, which
 * has no theme control in it anywhere, so adding one there would be a
 * design change this repo's own convention reserves for the canvas, not
 * page-generator code.
 *
 * Renders `#theme-pills` (the container `demo/components/theme-bar-
 * client.ts`'s `initThemeBar()` looks for) so a page that mounts this
 * section just needs to bundle and call `initThemeBar()` once — see
 * `demo/theme-bar-only-client.ts` for the shared bundle entry every plain
 * page (no other client JS of its own) uses for exactly that.
 */
import { SectionEyebrow } from './primitives.tsx'
import { ThemePicker } from './theme-picker.tsx'
import { LAYOUT, SPACE, LETTER_SPACING, colorVar } from './tokens.tsx'

export interface ThemePickerSectionProps {
  /** Eyebrow label above the heading. Defaults to `'Pick a look'`. */
  eyebrow?: string
  /** Section heading. Defaults to a copy matching the other pages' sections. */
  heading?: string
  /** Alternates the section background/border, matching a page's own rhythm. */
  tinted?: boolean
}

/**
 * The shared "Pick a look" theme-picker section: eyebrow, heading, and the
 * `ThemePicker` itself (Default pill + all built-in themes).
 */
export function ThemePickerSection({
  eyebrow = 'Pick a look',
  heading = 'Live in every built-in theme.',
  tinted = false,
}: ThemePickerSectionProps) {
  return (
    <div
      className="section-px"
      style={{
        padding: `80px ${LAYOUT.gutter.desktop}px`,
        ...(tinted
          ? {
              background: colorVar('--bg-soft'),
              borderTop: `1px solid ${colorVar('--border')}`,
              borderBottom: `1px solid ${colorVar('--border')}`,
            }
          : {}),
      }}
    >
      <div
        style={{
          maxWidth: `${LAYOUT.maxWidth}px`,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: `${SPACE['4xl']}px`,
        }}
      >
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <h2 style={{ fontSize: '30px', letterSpacing: LETTER_SPACING.heading }}>
          {heading}
        </h2>
        <div
          className="theme-pills"
          id="theme-pills"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: `${SPACE.md}px`,
            alignItems: 'flex-start',
          }}
        >
          <ThemePicker includeDefault activeThemeKey="" />
        </div>
      </div>
    </div>
  )
}
