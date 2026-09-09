/** @jsxRuntime automatic */
/**
 * The live editor's top bar (was editor/html/topbar.html) as React
 * components — the follow-up work #423's prototype deferred and #589
 * finished: the fragment is a real component tree now, not a raw HTML
 * partial spliced into `<body>`.
 *
 * `.topbar` stays the single root element `editor/css/variables.css`'s
 * `body { display: flex }` layout expects as a direct child of `<body>` —
 * no wrapper is introduced anywhere, which is the specific hazard the
 * migration plan flagged for this page.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { CSSProperties, ReactNode } from 'react'
import { COLORS } from './tokens.tsx'

/** The stroke-style icon shape shared by every button in the bar. */
function StrokeIcon({
  children,
  ...props
}: {
  children: ReactNode
  id?: string
  className?: string
  width?: string
  height?: string
  strokeWidth?: string
  style?: CSSProperties
}) {
  const { strokeWidth = '2', ...rest } = props
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** The image icon reused by the "Save PNG" and "Save SVG" export items. */
function ImageIcon() {
  return (
    <StrokeIcon className="export-item-icon" strokeWidth="1.75">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </StrokeIcon>
  )
}

/** One export-menu row: icon, label, and its keyboard shortcut. */
function ExportItem({
  id,
  icon,
  label,
  keys,
}: {
  id: string
  icon: ReactNode
  label: string
  keys: string[]
}) {
  return (
    <button className="export-item" id={id}>
      {icon}
      <span className="export-item-label">{label}</span>
      <span className="export-item-kbd">
        {keys.map((key) => (
          <kbd key={key}>{key}</kbd>
        ))}
      </span>
    </button>
  )
}

/**
 * The zombie-mermaid logo mark shown at the far left of the bar.
 *
 * Matches nav.tsx's `LogoMark` (icons.tsx) — two rounded squares over a
 * bracket — the redesign's shared brand mark. It draws the same three
 * accents as literal hex from tokens.tsx's `COLORS` rather than
 * `LogoMark`'s own `var(--cyan)`/`var(--violet)`/`var(--pink)`:
 * editor-page.tsx scopes the design-system palette to `.zm-shell`, and
 * `.editor-tool-shell` (this bar's ancestor) sits outside that scope, so
 * those custom properties are unresolved here — a `var()` reference would
 * compute to its initial value and render invisible strokes.
 */
function EditorLogo() {
  return (
    <a href="/zombie-mermaid/" className="logo">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="2"
          y="2"
          width="9"
          height="9"
          rx="3"
          stroke={COLORS['--cyan']}
          strokeWidth="1.6"
        />
        <rect
          x="13"
          y="2"
          width="9"
          height="9"
          rx="3"
          stroke={COLORS['--violet']}
          strokeWidth="1.6"
        />
        <path
          d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5"
          stroke={COLORS['--pink']}
          strokeWidth="1.6"
          fill="none"
        />
      </svg>
      <span>
        <strong>zombie-mermaid</strong>
        <span className="logo-sub">Live Editor</span>
      </span>
    </a>
  )
}

/** One entry in the topbar's theme dropdown. */
export interface EditorThemeItem {
  /** The `THEMES` key this entry selects. */
  key: string
  /** The theme's background colour, shown as the entry's swatch. */
  bg: string
  /** The human-friendly name shown to the reader. */
  label: string
}

/**
 * The theme dropdown's entries: the "Default" pseudo-theme (no override)
 * followed by every built-in theme, each with a build-time colour swatch.
 */
export function EditorThemeItems({
  themes,
}: {
  themes: readonly EditorThemeItem[]
}) {
  return (
    <>
      <button className="theme-dropdown-item active" data-theme="">
        Default
      </button>
      {themes.map((theme) => (
        <button
          className="theme-dropdown-item"
          data-theme={theme.key}
          key={theme.key}
        >
          <span className="theme-swatch" style={{ background: theme.bg }} />
          {theme.label}
        </button>
      ))}
    </>
  )
}

/** The editor's top bar: logo, tabs, dark mode, themes, and export. */
export function EditorTopbar({ themeItems }: { themeItems: ReactNode }) {
  return (
    <div className="topbar">
      <EditorLogo />

      <div className="topbar-sep" />

      <div className="tab-group">
        <button className="tab active" id="tab-code" data-panel="code">
          Code
        </button>
        <button className="tab" id="tab-config" data-panel="config">
          Config
        </button>
      </div>

      <div className="spacer" />

      <button
        className="btn"
        id="dark-light-btn"
        title="Toggle dark/light mode"
      >
        <StrokeIcon id="icon-moon">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </StrokeIcon>
        <StrokeIcon id="icon-sun" style={{ display: 'none' }}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </StrokeIcon>
      </button>

      <div className="topbar-sep" />

      <div className="theme-dropdown-wrap" id="theme-dropdown-wrap">
        <button className="theme-dropdown-btn" id="theme-dropdown-btn">
          <span className="theme-swatch" id="theme-btn-swatch" />
          <span id="theme-btn-label">Default</span>
          <StrokeIcon strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </StrokeIcon>
        </button>
        <div className="theme-dropdown-menu" id="theme-dropdown-menu">
          {themeItems}
        </div>
      </div>

      <div className="topbar-sep" />

      <div className="export-wrap" id="export-wrap">
        <button
          className="btn btn-primary"
          id="export-main-btn"
          title="Save PNG (⌘S)"
        >
          <StrokeIcon>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </StrokeIcon>
          {' Export Image '}
        </button>
        <button
          className="btn btn-primary export-chevron"
          id="export-chevron-btn"
          title="More export options"
        >
          <StrokeIcon width="12" height="12" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </StrokeIcon>
        </button>

        <div className="export-dropdown" id="export-dropdown">
          <ExportItem
            id="export-png-btn"
            icon={<ImageIcon />}
            label="Save PNG"
            keys={['⌘', 'S']}
          />

          <ExportItem
            id="export-svg-btn"
            icon={<ImageIcon />}
            label="Save SVG"
            keys={['⌘', '⇧', 'S']}
          />

          <div className="export-divider" />

          <ExportItem
            id="copy-image-btn"
            icon={
              <StrokeIcon className="export-item-icon" strokeWidth="1.75">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </StrokeIcon>
            }
            label="Copy Image"
            keys={['⌘', 'C']}
          />

          <ExportItem
            id="copy-link-btn"
            icon={
              <StrokeIcon className="export-item-icon" strokeWidth="1.75">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </StrokeIcon>
            }
            label="Copy URL"
            keys={['⌘', '⇧', 'C']}
          />

          <div className="export-divider" />

          <div className="export-size-row">
            <StrokeIcon className="export-item-icon" strokeWidth="1.75">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </StrokeIcon>
            <span className="export-item-label">Size</span>
            <div className="size-pills" id="size-pills">
              <button className="size-pill" data-scale="1">
                1x
              </button>
              <button className="size-pill" data-scale="2">
                2x
              </button>
              <button className="size-pill active" data-scale="4">
                4x
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
