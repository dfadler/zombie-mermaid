/** @jsxRuntime automatic */
/**
 * Shared theme-picker UI: a few pills inline, the rest in a "More" dropdown.
 *
 * Used by both the interactive gallery (index.ts) and the per-diagram-type
 * SEO pages (pages.ts) -- both include the "Default" pseudo-theme pill
 * (empty key) and both render it active initially, so a first-time visitor
 * sees the exact same look on either surface. On index.ts, Default means
 * "no override, use each sample's own baked-in colors"; on pages.ts it
 * means DEFAULT_SWATCH below, since a diagrams page always renders exactly
 * one diagram with no per-sample baked-in colors to fall back to.
 *
 * React components as of #589 (was theme-picker.ts, a template-literal
 * module at the repo root). Same markup, class names, and ARIA attributes;
 * the pills are simply built by JSX now so the two React page generators
 * that embed them don't have to splice a raw HTML string in.
 *
 * As of #801, `ThemePicker` is a real hydrated component rather than static
 * markup wired up after the fact by `demo/components/theme-bar-client.ts`'s
 * `initThemeBar()` (deleted by this issue): pill selection, the "More"
 * dropdown, keyboard support, and `theme-state.ts` sync all live here as
 * `useState`/`useEffect`, driven by the shared `activeKey` state that every
 * pill (inline and dropdown copies alike) reads for its own `active` class.
 * `demo/components/theme-picker-island.tsx`'s `ThemePickerIsland` is what a
 * page generator actually renders — it produces the hydratable markup (via
 * `renderToString`) plus the JSON props blob `demo/theme-bar-client.tsx`'s
 * `hydrateThemeBar()` reads to `hydrateRoot()` this same component tree on
 * the client, exactly mirroring `nav-island.tsx`/`nav-client.tsx`'s
 * established pattern (zombie-mermaid#800).
 *
 * Accessibility: preserves the `aria-expanded`/`aria-haspopup` behavior
 * fixed for the old picker in #281 (the "More" button's `aria-expanded`
 * silently drifting from the dropdown's actual open/closed state), plus the
 * keyboard support `initThemeBar()` added: `Escape` returns focus to the
 * trigger (not just closes the dropdown), and
 * `ArrowUp`/`ArrowDown`/`Home`/`End` roam the dropdown's own pills while
 * it's open. Every real theme pill is a native `<button>`, so `Tab` and
 * `Enter`/`Space` already work for free without any extra handling here.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { THEMES } from '@zombie-mermaid/core'
import { THEME_LABELS, THEME_DESCRIPTIONS } from '../theme-labels.ts'
import {
  DEFAULT_THEME_KEY,
  getTheme,
  setTheme,
  subscribe,
} from '../theme-state.ts'

/** The `id` of the hydration root `ThemePickerIsland` renders `#theme-pills` as — load-bearing: a page must render exactly one. */
export const THEME_PILLS_ROOT_ID = 'theme-pills'

/** The `id` of the `<script type="application/json">` `ThemePickerIsland` embeds its `ThemePickerProps` into, for `hydrateThemeBar()` to read. */
export const THEME_PILLS_PROPS_ELEMENT_ID = 'theme-pills-props'

/** Themes shown as inline pills; the rest live in the "More" dropdown. */
export const INLINE_THEMES = new Set(['dracula', 'solarized-light'])

/** The Default (no theme) pill's swatch colors. */
export const DEFAULT_SWATCH = { bg: '#FFFFFF', fg: '#27272A' }

/**
 * The `.theme-pill`/`.theme-more-dropdown`/etc CSS every `ThemePicker`
 * instance needs, extracted from `demo/styles.css` (lines ~221-330 as of
 * this writing) so a page that doesn't load that whole legacy stylesheet
 * — every #590-redesigned page (Home, Blog, Fork Fixes, Dashboard, the
 * Diagrams hub) — can still render a correctly-styled picker by inlining
 * just this function's output, the same way those pages already inline
 * `designBaseCss()`/`primitivesCss()`/`navCss()` rather than linking an
 * external stylesheet (see index.ts's `<style>` block for the pattern this
 * mirrors).
 *
 * `demo/diagram-page.css` (pages.ts's per-diagram-type pages) still gets
 * these same rules for free via the full `demo/styles.css` concatenation —
 * this is an additive extraction, not a replacement, so nothing there
 * changes.
 *
 * `--t-bg`/`--t-fg` default here to {@link DEFAULT_SWATCH}'s colors, scoped
 * to `#theme-pills` rather than `:root`, so a page that never sets them
 * (no live diagram to re-theme, e.g. the Diagrams hub) still gets a sane,
 * self-contained pill appearance instead of inheriting nothing. A page
 * that *does* re-theme a live diagram (pages.ts's `DiagramTypePage`, via
 * `demo/diagram-page-client.ts`'s `applyThemeToPage`) sets real values on
 * `<body>`, which cascade down and override this default exactly the way
 * an inline default is supposed to.
 */
export function themePickerCss(): string {
  return `#theme-pills {
  --t-bg: ${DEFAULT_SWATCH.bg};
  --t-fg: ${DEFAULT_SWATCH.fg};
}
.theme-pills {
  display: flex;
  gap: 0.3rem;
  overflow: visible;
  padding: 4px;
  margin: -4px;
  position: relative;
  z-index: 2;
}
.theme-pills-inline {
  display: flex;
  gap: 0.3rem;
}
@media (max-width: 1024px) {
  .theme-pills-inline {
    display: none;
  }
}
.theme-pill {
  display: flex;
  align-items: center;
  height: 30px;
  gap: 8px;
  padding: 0 14px 0 12px;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--t-bg) 97%, var(--t-fg));
  color: color-mix(in srgb, var(--t-fg) 80%, var(--t-bg));
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s,
    background 0.15s,
    box-shadow 0.2s,
    transform 0.1s;
}
.theme-pill:hover {
  color: var(--t-fg);
  background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg));
}
.theme-pill.active {
  color: var(--t-fg);
  background: var(--t-bg);
  font-weight: 600;
}
.theme-pill:active {
  transform: translateY(0.5px);
}
.theme-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}
.theme-more-wrapper {
  position: relative;
}
.theme-more-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--t-bg);
  border-radius: 12px;
  padding: 6px;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
  z-index: 1002;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.theme-more-dropdown.open {
  display: flex;
}
.theme-more-dropdown .theme-pill {
  width: 100%;
  justify-content: flex-start;
  background: transparent;
  box-shadow: none;
}
.theme-more-dropdown .theme-pill:hover {
  background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg));
}
.theme-more-dropdown .theme-pill.active {
  background: var(--t-bg);
}`
}

/** {@link themePickerCss} in a `<style>` element, for a page's `<head>`. */
export function ThemePickerStyle() {
  return <style>{themePickerCss()}</style>
}

export interface ThemePillProps {
  /** Theme key, or `''` for the "Default" pseudo-theme. */
  themeKey: string
  colors: { bg: string; fg: string }
  active?: boolean
  /** Fires on click/Enter/Space -- native `<button>` semantics give Enter/Space for free. */
  onClick?: () => void
}

/** One theme pill, with a color swatch rendered at build time. */
export function ThemePill({
  themeKey,
  colors,
  active = false,
  onClick,
}: ThemePillProps) {
  const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
  const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  const label =
    themeKey === '' ? 'Default' : (THEME_LABELS[themeKey] ?? themeKey)
  const description = THEME_DESCRIPTIONS[themeKey]
  return (
    <button
      className={`theme-pill shadow-minimal${active ? ' active' : ''}`}
      data-theme={themeKey}
      title={description}
      onClick={onClick}
    >
      <span
        className="theme-swatch"
        style={{
          background: colors.bg,
          boxShadow: `inset 0 0 0 1px ${shadow}`,
        }}
      />
      {label}
    </button>
  )
}

export interface ThemePickerProps {
  /**
   * Prepends the "Default" pseudo-theme pill (empty key) ahead of the real
   * themes.
   */
  includeDefault: boolean
  /**
   * Which key starts active. Defaults to `''` (the Default pseudo-theme,
   * matching `theme-state.ts`'s own `DEFAULT_THEME_KEY`) when omitted --
   * every current call site with `includeDefault: false` passes an explicit
   * real key instead (see `ThemeShowcase`, demo/components/index-page.tsx),
   * since there's no Default pill in that case for the fallback to land on.
   */
  activeThemeKey?: string
}

/**
 * The theme picker: a few pills inline, every theme in a dropdown.
 *
 * Interactive as of #801 -- see this file's header comment. `activeKey`
 * starts from `activeThemeKey` (matching the server-rendered markup exactly,
 * so hydration has nothing to reconcile) and is resynced from
 * `theme-state.ts` once mounted, since only the client actually knows the
 * visitor's stored preference; `theme-state.ts` itself is what a pill click
 * updates going forward, notifying this same `subscribe()` listener (rather
 * than this component setting its own state directly on click) so same-tab
 * and cross-tab updates are handled by exactly one code path.
 */
export function ThemePicker({
  includeDefault,
  activeThemeKey,
}: ThemePickerProps) {
  const [activeKey, setActiveKey] = useState(
    activeThemeKey ?? DEFAULT_THEME_KEY,
  )
  const [open, setOpen] = useState(false)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  // Initial sync + ongoing same-tab/cross-tab updates -- mirrors the old
  // initThemeBar()'s synchronous `syncActive(getTheme())` call plus its
  // `subscribe(syncActive)` registration, just as effects instead of
  // imperative DOM writes.
  useEffect(() => {
    setActiveKey(getTheme())
    return subscribe(setActiveKey)
  }, [])

  // Escape (global, whenever open -- not scoped to focus, matching the old
  // document-level listener) and outside-click (scoped to .theme-more-wrapper).
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      setOpen(false)
      moreBtnRef.current?.focus()
    }
    function onClickOutside(e: MouseEvent): void {
      const target = e.target
      if (target instanceof Element && target.closest('.theme-more-wrapper')) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClickOutside)
    }
  }, [open])

  /** A pill was picked -- persist, and close+refocus only if the dropdown was actually open (matches the old closeDropdown()'s own `!isOpen()` early-return). */
  function pickTheme(themeKey: string): void {
    setTheme(themeKey)
    if (open) {
      setOpen(false)
      moreBtnRef.current?.focus()
    }
  }

  /**
   * ArrowUp/ArrowDown/Home/End roving navigation among the dropdown's own
   * pills, scoped to whatever's actually rendered under `e.currentTarget`
   * (the dropdown wrapper this handler is attached to) -- same technique
   * `initThemeBar()`'s `onDropdownKeydown` used, just reading from the
   * event target instead of a captured DOM reference.
   */
  function onDropdownKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    let nextIndex: number | null = null
    if (e.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      nextIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length
    } else if (e.key === 'Home') {
      nextIndex = 0
    } else if (e.key === 'End') {
      nextIndex = items.length - 1
    }
    if (nextIndex === null) return
    e.preventDefault()
    items[nextIndex]!.focus()
  }

  const themeEntries = Object.entries(THEMES)
  const defaultPill = includeDefault ? (
    <ThemePill
      key=""
      themeKey=""
      colors={DEFAULT_SWATCH}
      active={activeKey === ''}
      onClick={() => pickTheme('')}
    />
  ) : null

  const pill = ([themeKey, colors]: [string, { bg: string; fg: string }]) => (
    <ThemePill
      key={themeKey}
      themeKey={themeKey}
      colors={colors}
      active={themeKey === activeKey}
      onClick={() => pickTheme(themeKey)}
    />
  )

  const inlinePills = themeEntries
    .filter(([themeKey]) => INLINE_THEMES.has(themeKey))
    .map(pill)
  const dropdownPills = themeEntries.map(pill)
  const dropdownCount = dropdownPills.length + (includeDefault ? 1 : 0)

  return (
    <>
      <div className="theme-pills-inline">
        {defaultPill}
        {inlinePills}
      </div>
      <div className="theme-more-wrapper">
        <button
          ref={moreBtnRef}
          className="theme-pill shadow-minimal"
          id="theme-more-btn"
          aria-label="More themes"
          aria-haspopup="true"
          aria-controls="theme-more-dropdown"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {dropdownCount} Themes
        </button>
        <div
          className={`theme-more-dropdown shadow-modal-small${open ? ' open' : ''}`}
          id="theme-more-dropdown"
          onKeyDown={onDropdownKeyDown}
        >
          {defaultPill}
          {dropdownPills}
        </div>
      </div>
    </>
  )
}
