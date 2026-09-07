/** @jsxRuntime automatic */
/**
 * The redesign's icon set (#596, part of the #591 component library and the
 * #590 site redesign) — stroke-based inline SVG, never emoji.
 *
 * Every path below was lifted verbatim from the design canvas linked in
 * #590's body (`https://claude.ai/code/artifact/2f623662-5eaf-42c4-9fd9-c21588e34993`),
 * read through the same route tokens.tsx used: the canvas's `appifact-doc`
 * script block carries one `.dc.html` source per artboard, and the icons are
 * the `viewBox="0 0 24 24"` SVGs inside them. Nothing here was drawn from
 * scratch; the `CANVAS` note on each icon names the artboard and the heading
 * or `aria-label` it sits under, so a path can be traced back.
 *
 * The canvas's eighteen artboards are three families: the sixteen
 * "Diagram-Native Showcase" pages (eight, each desktop + mobile) that
 * tokens.tsx treats as canonical, plus two single-artboard explorations
 * (`TerminalNative`, `EditorialProduct`) that restate the same six features
 * with different drawings at `stroke-width: 1.6`. This module follows the
 * canonical sixteen throughout, so the six feature icons here are the ones
 * on the home page's feature grid.
 *
 * Two things the canvas does NOT have, and this module therefore does not
 * invent: a pan control (the editor toolbar's third button is "Fit to view",
 * {@link FitToViewIcon}) and a GitHub or npm mark (the nav links to GitHub as
 * plain text and shows `npm install zombie-mermaid` as a text pill).
 *
 * Nothing on the site consumes these yet — wiring belongs to the shared Nav
 * (#593), the animated variants (#597), and the per-page redesigns.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import type { ReactNode } from 'react'

import { type ColorToken, colorVar } from './tokens.tsx'

/* -----------------------------------------------------------------
 * The shared stroke style
 * ----------------------------------------------------------------- */

/**
 * Every icon draws in a 24×24 user-space box, whatever it renders at.
 *
 * The canvas is unanimous on this: all 49 distinct icons across all eighteen
 * artboards use `viewBox="0 0 24 24"`, and vary only the `width`/`height`
 * they present it at (12px through 34px).
 */
export const ICON_VIEW_BOX = '0 0 24 24'

/**
 * The stroke width the whole set draws at.
 *
 * 1.8 is the canonical artboards' value for a *drawn* icon — every one of the
 * six feature-grid icons, both 34px teaser icons, and the editor's four
 * feature-card icons use it. The canvas then optically compensates smaller
 * instances of its incidental chrome (2 at 13–16px, 2.4–2.6 at 12–14px)
 * rather than treating stroke width as a set-wide constant. This module does
 * treat it as one — a single value is what makes the set read as one family
 * — and exposes {@link IconProps.strokeWidth} for a caller that needs the
 * canvas's optical bump back at a small size.
 */
export const ICON_STROKE_WIDTH = 1.8

/** `stroke-linecap`/`stroke-linejoin` — round on every stroke icon in the canvas. */
export const ICON_LINE_CAP = 'round'

/** The size, in px, an icon renders at when the caller doesn't say. */
export const ICON_DEFAULT_SIZE = 24

/* -----------------------------------------------------------------
 * Props
 * ----------------------------------------------------------------- */

/** The props every icon in this module accepts. */
export interface IconProps {
  /**
   * Rendered width and height in px. Defaults to
   * {@link ICON_DEFAULT_SIZE}; the drawing scales, the stroke does not
   * thin (SVG strokes scale with the viewBox, so a 12px render of a 1.8
   * stroke is proportionally the same weight as a 34px one).
   */
  size?: number
  /**
   * Stroke colour. Defaults to the accent the canvas assigns this icon —
   * see each component's `CANVAS` note — expressed through tokens.tsx's
   * {@link colorVar}, so it resolves against the `:root` block
   * `designTokensCss()` publishes. Pass `'currentColor'` to inherit from
   * the surrounding text instead.
   */
  color?: string
  /**
   * Stroke width. Defaults to {@link ICON_STROKE_WIDTH}; override only to
   * restore the canvas's optical compensation at a small render size.
   */
  strokeWidth?: number
  /** Class on the `<svg>`, for layout or an animation hook (#597). */
  className?: string
  /**
   * Accessible name. Given one, the icon becomes `role="img"` with a
   * `<title>`; without one it is `aria-hidden` — the right default, since
   * most of these sit beside a text label that already names them.
   */
  title?: string
}

/** An icon's own props plus the paths it draws — the base component's input. */
interface StrokeIconProps extends IconProps {
  /** The colour token the canvas uses for this icon. */
  defaultColor: ColorToken | 'currentColor'
  /** The icon's paths, in canvas order. */
  children: ReactNode
}

/**
 * The one `<svg>` wrapper every icon renders through.
 *
 * Centralising the open tag is what actually enforces the set's consistency:
 * an individual icon supplies only its paths and its canvas accent, and
 * cannot drift the viewBox, the stroke joins, or the fill rule.
 */
function StrokeIcon({
  size = ICON_DEFAULT_SIZE,
  color,
  strokeWidth = ICON_STROKE_WIDTH,
  className,
  title,
  defaultColor,
  children,
}: StrokeIconProps) {
  const stroke =
    color ??
    (defaultColor === 'currentColor' ? 'currentColor' : colorVar(defaultColor))
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={ICON_LINE_CAP}
      strokeLinejoin={ICON_LINE_CAP}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/* -----------------------------------------------------------------
 * The six features — home page feature grid
 * ----------------------------------------------------------------- */

/**
 * Dual output (SVG and ASCII) — two panes over a shared base.
 *
 * CANVAS: Main.dc.html, feature grid, "Dual output", `--blue` at 28px.
 */
export function DualOutputIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--blue">
      <rect x="2" y="4" width="9" height="7" rx="1.5" />
      <rect x="13" y="4" width="9" height="7" rx="1.5" />
      <path d="M6.5 11v3a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3" />
    </StrokeIcon>
  )
}

/**
 * Themes — a painter's palette with three wells.
 *
 * CANVAS: Main.dc.html, feature grid, "15 built-in themes", `--violet` at
 * 28px (and the same drawing at 26px on Editor.dc.html's feature cards).
 * The canvas fills the three wells with the icon's own accent
 * (`fill="var(--violet)"`); `currentColor` here is the canvas's own idiom
 * for the same drawing when it takes its colour from context —
 * TerminalNative.dc.html's copy of this icon writes it that way.
 */
export function ThemesIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.3c1.7 0 3.2-1.4 3.2-3.1C20.5 6.6 16.7 2 12 2Z" />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Shiki compatibility — a pair of code chevrons.
 *
 * CANVAS: Main.dc.html, feature grid, "Full Shiki compatibility", `--cyan`
 * at 28px.
 */
export function ShikiIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <polyline points="9 6 3 12 9 18" />
      <polyline points="15 6 21 12 15 18" />
    </StrokeIcon>
  )
}

/**
 * Mono mode — a circle filled on one half, the two-colour idea in one mark.
 *
 * CANVAS: Main.dc.html, feature grid, "Mono mode", `--amber` at 28px. The
 * canvas fills the half with the icon's own accent; see {@link ThemesIcon}
 * on why that becomes `currentColor` here.
 */
export function MonoModeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </StrokeIcon>
  )
}

/**
 * Zero DOM dependencies — a self-contained package solid.
 *
 * CANVAS: Main.dc.html, feature grid, "Zero DOM dependencies", `--pink` at
 * 28px.
 */
export function ZeroDomIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      <path d="M12 2 3 7v10l9 5 9-5V7Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </StrokeIcon>
  )
}

/**
 * Synchronous rendering — a lightning bolt.
 *
 * CANVAS: Main.dc.html, feature grid, "Synchronous rendering", `--green` at
 * 28px. Blog.dc.html reuses the drawing at 26px for "Why we forked
 * beautiful-mermaid" (`--violet`), and Editor.dc.html for "Live, debounced
 * rendering" (`--blue`) — pass `color` for those.
 */
export function SyncRenderIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </StrokeIcon>
  )
}

/* -----------------------------------------------------------------
 * Editor toolbar chrome
 * ----------------------------------------------------------------- */

/**
 * Zoom in — a magnifier with a plus.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Zoom in"`, `--text-dim` at
 * 16px.
 */
export function ZoomInIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <circle cx="10" cy="10" r="7" />
      <line x1="21" y1="21" x2="15.5" y2="15.5" />
      <line x1="10" y1="7" x2="10" y2="13" />
      <line x1="7" y1="10" x2="13" y2="10" />
    </StrokeIcon>
  )
}

/**
 * Zoom out — the same magnifier, minus the vertical stroke.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Zoom out"`, `--text-dim` at
 * 16px.
 */
export function ZoomOutIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <circle cx="10" cy="10" r="7" />
      <line x1="21" y1="21" x2="15.5" y2="15.5" />
      <line x1="7" y1="10" x2="13" y2="10" />
    </StrokeIcon>
  )
}

/**
 * Fit to view — four corner brackets.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Fit to view"`, `--text-dim`
 * at 16px. This is the canvas's third viewport control; there is no pan
 * icon anywhere in the canvas, so none is offered here.
 */
export function FitToViewIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-dim">
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </StrokeIcon>
  )
}

/**
 * Share — two chain links, for the URL-hash share link.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Copy share link"`, `--cyan`
 * at 16px; the same drawing at 26px on the "Shareable via URL" feature card.
 */
export function ShareIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5" />
    </StrokeIcon>
  )
}

/**
 * Download — an arrow onto a baseline.
 *
 * CANVAS: Editor.dc.html, toolbar, `aria-label="Download SVG"`, `--amber` at
 * 16px; the same drawing at 26px on the "One-click SVG export" feature card.
 */
export function DownloadIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </StrokeIcon>
  )
}

/* -----------------------------------------------------------------
 * Recurring nav, footer, and page chrome
 * ----------------------------------------------------------------- */

/**
 * Copy — the offset-rectangles clipboard beside the install command.
 *
 * CANVAS: every canonical artboard's nav pill, after
 * `npm install zombie-mermaid`, `--cyan` at 15px.
 */
export function CopyIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </StrokeIcon>
  )
}

/**
 * Check — the bare tick used for a satisfied claim.
 *
 * CANVAS: Main.dc.html's hero bullet list and Dashboard.dc.html's
 * "0 days ago last commit" metric card, `--green` at 14–20px.
 */
export function CheckIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      <polyline points="4 12 10 18 20 6" />
    </StrokeIcon>
  )
}

/**
 * Arrow right — the trailing arrow on a call to action.
 *
 * CANVAS: the `.arrow-link` and primary-button arrow across Main, Blog,
 * DiagramGallery and Dashboard, at 14px. The canvas colours it by context
 * (`currentColor` in a link, the button's dark ink on an accent fill), so
 * this one inherits rather than defaulting to an accent.
 */
export function ArrowRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="currentColor">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </StrokeIcon>
  )
}

/**
 * Chevron right — the breadcrumb separator.
 *
 * CANVAS: Dashboard.dc.html's breadcrumb (`Home › Dashboard`),
 * `--text-faint` at 12px.
 */
export function ChevronRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-faint">
      <path d="M9 6l6 6-6 6" />
    </StrokeIcon>
  )
}

/**
 * Clock — the "snapshot as of…" freshness stamp.
 *
 * CANVAS: Dashboard.dc.html, beside the snapshot timestamp, `--text-faint`
 * at 13px.
 */
export function ClockIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--text-faint">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </StrokeIcon>
  )
}

/**
 * Warning — the triangle marking a "before" (broken) render.
 *
 * CANVAS: ForkFixes.dc.html, the `.ba-label` on every before panel,
 * `--amber` at 12px.
 */
export function WarningIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 2.7 17.1a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </StrokeIcon>
  )
}

/**
 * Pull request — the branch-and-merge mark on a `PR #NN` pill.
 *
 * CANVAS: ForkFixes.dc.html, `.meta-pill`, `--violet` at 13px.
 */
export function PullRequestIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M6 9v6M18 9a4 4 0 0 1-4 4H9" />
    </StrokeIcon>
  )
}

/**
 * Commit — a node on a line, for a commit SHA pill.
 *
 * CANVAS: ForkFixes.dc.html, `.meta-pill`, `--cyan` at 13px.
 */
export function CommitIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12h7M15 12h7" />
    </StrokeIcon>
  )
}

/**
 * External link — the outbound chain to an upstream issue.
 *
 * CANVAS: ForkFixes.dc.html, the `upstream #NNN` link pill, `--pink` at
 * 13px. A distinct drawing from {@link ShareIcon}, which is the editor's own
 * copy-link control.
 */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--pink">
      <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </StrokeIcon>
  )
}

/**
 * Frame — a bounded artboard, marking the `SVG output` surface pill.
 *
 * CANVAS: ForkFixes.dc.html, `.meta-pill`, `--amber` at 13px.
 */
export function FrameIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 8h8v8H8z" />
    </StrokeIcon>
  )
}

/**
 * Lock — the padlock on the experimental `MCP server` pill.
 *
 * CANVAS: Main.dc.html, MCP section pill, `--violet` at 12px.
 */
export function LockIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--violet">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </StrokeIcon>
  )
}

/**
 * Terminal — the screen-on-a-stand avatar for an agent tool call.
 *
 * CANVAS: Main.dc.html, MCP transcript rows, `--cyan` at 16px.
 */
export function TerminalIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--cyan">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </StrokeIcon>
  )
}

/**
 * Checklist — a ticked box, for the fork-fixes teaser.
 *
 * CANVAS: Main.dc.html's "What this fork fixes" teaser card, `--amber` at
 * 34px.
 */
export function ChecklistIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--amber">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </StrokeIcon>
  )
}

/**
 * Activity — the heartbeat line on the rescued-issues card.
 *
 * CANVAS: Dashboard.dc.html's "Rescued issues" card, `--green` at 34px
 * (where it carries the canvas's `pulse-line` animation class — the
 * animated variant belongs to #597).
 */
export function ActivityIcon(props: IconProps) {
  return (
    <StrokeIcon {...props} defaultColor="--green">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </StrokeIcon>
  )
}

/* -----------------------------------------------------------------
 * The brand mark
 * ----------------------------------------------------------------- */

/**
 * The stroke width the wordmark's glyph draws at — 1.6, not
 * {@link ICON_STROKE_WIDTH}. See {@link LogoMark}.
 */
export const LOGO_STROKE_WIDTH = 1.6

/**
 * The zombie-mermaid mark: two rounded squares over a bracket.
 *
 * CANVAS: every canonical artboard's nav (30px) and footer (22px).
 *
 * Deliberately not part of {@link ICONS}. It is a three-colour logotype
 * rather than a single-stroke icon — the canvas strokes each of its three
 * elements in a different accent (`--cyan`, `--violet`, `--pink`) and draws
 * it at 1.6 with butt caps — so it satisfies neither the one-colour nor the
 * one-stroke-width rule the rest of the set is built on, and folding it in
 * would mean loosening both. It takes `size`/`className`/`title` but no
 * `color`: recolouring a logotype is not a thing a caller should do.
 */
export function LogoMark({
  size = 30,
  className,
  title,
}: Pick<IconProps, 'size' | 'className' | 'title'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="2"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--cyan')}
        strokeWidth={LOGO_STROKE_WIDTH}
      />
      <rect
        x="13"
        y="2"
        width="9"
        height="9"
        rx="3"
        stroke={colorVar('--violet')}
        strokeWidth={LOGO_STROKE_WIDTH}
      />
      <path
        d="M6.5 11 V16 a2 2 0 0 0 2 2 h7 a2 2 0 0 0 2-2 v-5"
        stroke={colorVar('--pink')}
        strokeWidth={LOGO_STROKE_WIDTH}
        fill="none"
      />
    </svg>
  )
}

/* -----------------------------------------------------------------
 * The registry
 * ----------------------------------------------------------------- */

/**
 * Every stroke icon in the set, by name.
 *
 * A consumer that needs to pick an icon from data (a feature key, a pill
 * type) indexes this instead of switching over imports, and the test suite
 * iterates it so a new icon is held to the set's rules automatically rather
 * than needing its own case.
 */
export const ICONS = {
  dualOutput: DualOutputIcon,
  themes: ThemesIcon,
  shiki: ShikiIcon,
  monoMode: MonoModeIcon,
  zeroDom: ZeroDomIcon,
  syncRender: SyncRenderIcon,
  zoomIn: ZoomInIcon,
  zoomOut: ZoomOutIcon,
  fitToView: FitToViewIcon,
  share: ShareIcon,
  download: DownloadIcon,
  copy: CopyIcon,
  check: CheckIcon,
  arrowRight: ArrowRightIcon,
  chevronRight: ChevronRightIcon,
  clock: ClockIcon,
  warning: WarningIcon,
  pullRequest: PullRequestIcon,
  commit: CommitIcon,
  externalLink: ExternalLinkIcon,
  frame: FrameIcon,
  lock: LockIcon,
  terminal: TerminalIcon,
  checklist: ChecklistIcon,
  activity: ActivityIcon,
} as const satisfies Record<string, (props: IconProps) => ReactNode>

/** An icon's key in {@link ICONS}, e.g. `'monoMode'`. */
export type IconName = keyof typeof ICONS

/**
 * The six features the home page's grid enumerates, in canvas order, each
 * paired with the accent the canvas gives it.
 */
export const FEATURE_ICONS = [
  { name: 'dualOutput', accent: '--blue', label: 'Dual output' },
  { name: 'themes', accent: '--violet', label: '15 built-in themes' },
  { name: 'shiki', accent: '--cyan', label: 'Full Shiki compatibility' },
  { name: 'monoMode', accent: '--amber', label: 'Mono mode' },
  { name: 'zeroDom', accent: '--pink', label: 'Zero DOM dependencies' },
  { name: 'syncRender', accent: '--green', label: 'Synchronous rendering' },
] as const satisfies readonly {
  name: IconName
  accent: ColorToken
  label: string
}[]
