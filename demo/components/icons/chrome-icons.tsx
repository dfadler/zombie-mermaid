/** @jsxRuntime automatic */
/**
 * The recurring nav, footer, and page chrome icons — split out of the
 * original `icons.tsx` (#934) as one family of the icon set (#596).
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */

import { type IconProps, StrokeIcon } from './base.tsx'

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
