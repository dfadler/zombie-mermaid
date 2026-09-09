/** @jsxRuntime automatic */
/**
 * `<ThemePicker>`'s hydration island (zombie-mermaid#801, mirroring
 * `nav-island.tsx`'s `NavIsland` from #800): a page-level generator renders
 * {@link ThemePickerIsland} in place of hand-rolling a `#theme-pills`
 * wrapper around `<ThemePicker .../>`, and gets back both the pre-rendered
 * markup React needs a stable container for, and the
 * `<script type="application/json">` `demo/theme-bar-client.tsx`'s
 * `hydrateThemeBar()` reads to re-render the *same* tree via `hydrateRoot()`.
 *
 * Server-only: this file imports `react-dom/server`, so — exactly like
 * `nav-island.tsx` — nothing that ends up in a browser bundle may import
 * *this* file. `demo/theme-bar-client.tsx` imports `ThemePicker` and the id
 * constants directly from `theme-picker.tsx` instead, never from here.
 *
 * The `renderToString`-into-`dangerouslySetInnerHTML` splice (not plain JSX
 * nesting) is the same technique `nav-island.tsx` uses, for the same reason:
 * every page's outer document still goes through `render-html.ts`'s
 * `renderToStaticMarkup`, which never emits the `<!-- -->` text-boundary
 * comments `hydrateRoot()` needs to match adjacent text-node siblings.
 * `renderToString`, called here just for this island, produces them.
 *
 * `className`/`style` are threaded through rather than fixed here because
 * every one of this component's three call sites (`theme-picker-section.tsx`,
 * `diagram-page.tsx`'s `DiagramTypePage`, `index-page.tsx`'s `ThemeShowcase`)
 * lays the `#theme-pills` wrapper out slightly differently (e.g. `justify-
 * content: center` only on the homepage's showcase) — the wrapper `<div>`
 * itself was always each page's own JSX before this issue, never
 * `ThemePicker`'s concern, and stays that way.
 */
import type { CSSProperties } from 'react'
import { renderToString } from 'react-dom/server'
import { escapeJsonForScriptTag } from '../format.ts'
import {
  ThemePicker,
  THEME_PILLS_PROPS_ELEMENT_ID,
  THEME_PILLS_ROOT_ID,
  type ThemePickerProps,
} from './theme-picker.tsx'

export interface ThemePickerIslandProps extends ThemePickerProps {
  /** Defaults to `'theme-pills'`, matching every current call site. */
  className?: string
  style?: CSSProperties
}

/**
 * Renders `<ThemePicker>` as a hydratable island: the pre-rendered markup
 * inside {@link THEME_PILLS_ROOT_ID}, plus the
 * {@link THEME_PILLS_PROPS_ELEMENT_ID} JSON blob `hydrateThemeBar()` reads
 * to hydrate it. Use this everywhere a page used to wrap `<ThemePicker
 * .../>` in its own `#theme-pills` div directly.
 */
export function ThemePickerIsland({
  className = 'theme-pills',
  style,
  ...pickerProps
}: ThemePickerIslandProps) {
  return (
    <>
      <div
        id={THEME_PILLS_ROOT_ID}
        className={className}
        style={style}
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own ThemePicker component tree rendered via renderToString (see the module doc comment); never user input
        dangerouslySetInnerHTML={{
          __html: renderToString(<ThemePicker {...pickerProps} />),
        }}
      />
      <script
        type="application/json"
        id={THEME_PILLS_PROPS_ELEMENT_ID}
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own ThemePickerProps, escaped with escapeJsonForScriptTag; never user input
        dangerouslySetInnerHTML={{
          __html: escapeJsonForScriptTag(JSON.stringify(pickerProps)),
        }}
      />
    </>
  )
}
