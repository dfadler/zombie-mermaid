/** @jsxRuntime automatic */
/**
 * The nav bar's install pill: the package-manager popover trigger/menu
 * (zombie-mermaid#719) and the pill that composes them with the copy
 * button, split out of nav.tsx into their own component file
 * (zombie-mermaid#933).
 *
 * Invented — approved by the repo owner via a Claude Design exploration,
 * not part of the #590 canvas nav.tsx's own module doc comment describes —
 * see that comment for the exploration link. `usePackageManagerInstall`
 * itself (the state/handlers behind everything here) lives in its own
 * module, use-package-manager-install.ts, since it's pure logic with no
 * JSX and is shared with the homepage hero's own compact instance
 * (`index-app.tsx`'s `HeroInstall`, which imports {@link NavInstallPrefix}/
 * {@link NavInstallPopover} directly rather than a second copy).
 */
import type { KeyboardEvent, RefObject } from 'react'
import {
  CheckIcon,
  CopyIcon,
  ICON_LINE_CAP,
  ICON_STROKE_WIDTH,
  ICON_VIEW_BOX,
} from './icons.tsx'
import { NAV_Z_INDEX } from './nav-constants.ts'
import { Pill } from './primitives.tsx'
import { FONT_SIZE, RADIUS, SPACE, colorVar } from './tokens.tsx'
import {
  PACKAGE_MANAGERS,
  usePackageManagerInstall,
  type PackageManager,
} from './use-package-manager-install.ts'

/** The copy glyph's rendered size in px, and the stroke width it draws at.
 *
 * The canvas bumps this instance to 2 rather than the icon set's 1.8, the
 * optical compensation icons.tsx documents on `IconProps.strokeWidth`.
 * Exported: nav.tsx's `MobileNavPanel` renders the same copy glyph at the
 * same size in its own install pill, so both share this one definition. */
export const COPY_ICON_SIZE = 15
export const COPY_ICON_STROKE = 2

/** The prefix trigger's padding, in px — 6 vertical ({@link SPACE.xxs}), 10
 * horizontal ({@link SPACE.sm}), per the approved design spec. */
const INSTALL_PREFIX_PAD_Y = SPACE.xxs
const INSTALL_PREFIX_PAD_X = SPACE.sm

/**
 * The longest of {@link PACKAGE_MANAGERS}' own names, in characters
 * (`'pnpm'`/`'yarn'`, both 4) — reserved as the prefix label's `min-width`
 * (in `ch`, exact in the pill's monospace face) so switching between a
 * 3-letter manager (`npm`/`bun`) and a 4-letter one doesn't change the
 * trigger's rendered width and, with it, shove the divider/command/copy
 * glyph sideways (zombie-mermaid#902 — caught in the homepage hero, where
 * that shift visibly nudges the CTA button beside it; the header pill has
 * the identical dependency, just harder to notice next to a plain
 * hamburger icon).
 */
const INSTALL_PREFIX_LABEL_MIN_WIDTH_CH = Math.max(
  ...PACKAGE_MANAGERS.map((manager) => manager.length),
)

/** The chevron-down glyph's rendered size, in px — small enough to sit
 * beside the prefix label without competing with the copy glyph. */
const INSTALL_CHEVRON_SIZE = 10

/** The vertical divider's height, in px, between the prefix and the
 * command text — ~18px per the approved design spec; off tokens.tsx's
 * scale (16 and 20 both miss it), so it stays a literal. */
const INSTALL_DIVIDER_HEIGHT = 18

/** The popover's rendered width, in px — ~132px per the approved design
 * spec, wide enough for "pnpm" plus its checkmark without wrapping. */
const INSTALL_POPOVER_WIDTH = 132

/** Gap between the prefix trigger and the popover below it, in px. */
const INSTALL_POPOVER_GAP = SPACE.xxs

/** A popover menu item's font size, in px — {@link FONT_SIZE.bodySm} (14),
 * per the approved design spec. */
const INSTALL_POPOVER_ITEM_FONT_SIZE = FONT_SIZE.bodySm

/** The checkmark beside the popover's active item, in px. */
const INSTALL_CHECK_SIZE = 10

/**
 * The copy glyph's resting stroke — `var(--cyan)`, the same value
 * {@link CopyIcon}'s own `defaultColor` resolves to (icons.tsx's
 * `StrokeIcon`). {@link NavInstall} reverts to this after the "copied"
 * flash rather than a hand-typed duplicate of the color.
 */
const NAV_COPY_ICON_COLOR = colorVar('--cyan')

/**
 * The copy glyph's flash color on a successful copy — `var(--green)`, the
 * same accent icons.tsx's `CheckIcon` already draws its "satisfied claim"
 * tick in, reused here rather than inventing a new one.
 */
const NAV_COPY_SUCCESS_COLOR = colorVar('--green')

/**
 * The chevron-down glyph after the popover trigger's "npm" label —
 * {@link ChevronRightIcon}'s path rotated 90°, drawn locally rather than
 * imported since {@link IconProps} has no rotation escape hatch. Invented
 * for the package-manager selector (zombie-mermaid#719, see the module
 * doc comment); still drawn in the icon set's own stroke style (the same
 * {@link ICON_VIEW_BOX}/{@link ICON_STROKE_WIDTH}/{@link ICON_LINE_CAP}
 * nav.tsx's `MenuToggle` draws its own local svg with) so it reads as part
 * of the same family.
 */
export function InstallChevronGlyph() {
  return (
    <svg
      width={INSTALL_CHEVRON_SIZE}
      height={INSTALL_CHEVRON_SIZE}
      viewBox={ICON_VIEW_BOX}
      fill="none"
      stroke={colorVar('--cyan')}
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap={ICON_LINE_CAP}
      strokeLinejoin={ICON_LINE_CAP}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * The install pill's leading "npm ▾" segment — clicking or pressing
 * Enter/Space opens {@link NavInstallPopover} below it. A `role="button"`
 * span, not a `<button>`, matching {@link NavInstall}'s own pre-existing
 * pattern (see `__tests__/demo-nav.test.ts`'s "no extra `<button>`"
 * assertion nav.tsx's module doc comment references).
 *
 * Invented for the package-manager selector (zombie-mermaid#719) — see
 * nav.tsx's module doc comment for where the design came from.
 */
export function NavInstallPrefix({
  manager,
  open,
  onToggle,
  triggerRef,
}: {
  manager: PackageManager
  open: boolean
  onToggle: () => void
  triggerRef: RefObject<HTMLSpanElement | null>
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()
      if (!open) onToggle()
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <span
      ref={triggerRef}
      className="nav-install-prefix"
      role="button"
      tabIndex={0}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label="Choose package manager"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${SPACE.xxs}px`,
        padding: `${INSTALL_PREFIX_PAD_Y}px ${INSTALL_PREFIX_PAD_X}px`,
        borderRadius: `${RADIUS.sm}px`,
        color: colorVar('--cyan'),
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span style={{ minWidth: `${INSTALL_PREFIX_LABEL_MIN_WIDTH_CH}ch` }}>
        {manager}
      </span>
      <InstallChevronGlyph />
    </span>
  )
}

/**
 * The install pill's popover: all four {@link PACKAGE_MANAGERS}, with a
 * checkmark on the current selection. Reachable via the arrow keys once
 * focus lands inside it ({@link NavInstall} moves focus to the active
 * item when it opens), and each item is itself a `role="option"` span —
 * same "no literal `<button>`" reasoning as {@link NavInstallPrefix}.
 *
 * Invented for the package-manager selector (zombie-mermaid#719) — see
 * nav.tsx's module doc comment for where the design came from.
 */
export function NavInstallPopover({
  manager,
  onSelect,
  onClose,
  triggerRef,
  itemRefs,
  popoverRef,
}: {
  manager: PackageManager
  onSelect: (manager: PackageManager) => void
  onClose: () => void
  triggerRef: RefObject<HTMLSpanElement | null>
  itemRefs: RefObject<(HTMLSpanElement | null)[]>
  popoverRef: RefObject<HTMLSpanElement | null>
}) {
  function handleItemKeyDown(
    event: KeyboardEvent<HTMLSpanElement>,
    item: PackageManager,
    index: number,
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(item)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      triggerRef.current?.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      itemRefs.current[(index + 1) % PACKAGE_MANAGERS.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      itemRefs.current[
        (index - 1 + PACKAGE_MANAGERS.length) % PACKAGE_MANAGERS.length
      ]?.focus()
    }
  }

  return (
    <span
      ref={popoverRef}
      className="nav-install-popover"
      role="listbox"
      aria-label="Package manager"
      style={{
        position: 'absolute',
        top: `calc(100% + ${INSTALL_POPOVER_GAP}px)`,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        width: `${INSTALL_POPOVER_WIDTH}px`,
        background: colorVar('--panel'),
        border: `1px solid ${colorVar('--border')}`,
        borderRadius: `${RADIUS.lg}px`,
        padding: `${SPACE.xs}px`,
        zIndex: NAV_Z_INDEX + 1,
        cursor: 'default',
      }}
    >
      {PACKAGE_MANAGERS.map((item, index) => {
        const active = item === manager
        return (
          <span
            key={item}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            className="nav-install-option"
            role="option"
            aria-selected={active}
            tabIndex={0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: `${SPACE.xs}px`,
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              borderRadius: `${RADIUS.sm}px`,
              fontFamily: 'var(--font-mono)',
              fontSize: `${INSTALL_POPOVER_ITEM_FONT_SIZE}px`,
              color: colorVar(active ? '--text' : '--text-dim'),
              background: active ? colorVar('--panel-2') : 'transparent',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => handleItemKeyDown(event, item, index)}
          >
            {item}
            {active ? (
              <CheckIcon size={INSTALL_CHECK_SIZE} color={colorVar('--cyan')} />
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

/**
 * The install pill: the canvas's `muted` {@link Pill} lifted onto
 * `--panel-2`, holding the package-manager selector, the command, and a
 * copy glyph — all driven by {@link usePackageManagerInstall}.
 *
 * The text is the element the 600px rule (nav-css.ts's `navCss()`) hides,
 * so it must stay its own `.nav-npm-text` span rather than being the
 * pill's bare text content.
 *
 * As of zombie-mermaid#719 (invented, not canvas-pinned — see nav.tsx's
 * module doc comment), the pill also carries {@link NavInstallPrefix}:
 * clicking it (rather than the rest of the pill) opens {@link
 * NavInstallPopover} to pick a package manager, which drives both the
 * prefix label and the command text/copy payload. Neither the prefix nor
 * the popover is nested inside a click-to-copy region — they sit beside it
 * as their own focusable, `role`-carrying spans — so there is no ambiguity
 * between "open the popover" and "copy the command" clicks, and no nested
 * interactive roles for assistive tech to untangle.
 */
export function NavInstall({ command }: { command: string }) {
  const install = usePackageManagerInstall(command)

  return (
    <Pill
      mono
      style={{
        background: colorVar('--panel-2'),
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <NavInstallPrefix
        manager={install.selectedManager}
        open={install.popoverOpen}
        onToggle={install.togglePopover}
        triggerRef={install.triggerRef}
      />
      <span
        className="nav-install-divider"
        aria-hidden="true"
        style={{
          width: '1px',
          height: `${INSTALL_DIVIDER_HEIGHT}px`,
          background: colorVar('--border'),
        }}
      />
      <span
        className="nav-install-copy"
        role="button"
        tabIndex={0}
        aria-label="Copy install command"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${SPACE.sm}px`,
          flex: 1,
          // Reserves room for the widest of the four managers' commands —
          // see `widestCommand`'s doc comment — so switching managers can
          // only ever leave trailing space here, never shrink the pill.
          // Zeroed back out (nav-css.ts's `.nav-install-copy` rules)
          // wherever `.nav-npm-text` itself goes `display: none` — no
          // sense reserving room for text that isn't rendered.
          minWidth: `calc(${install.widestCommand.length}ch + ${SPACE.sm}px + ${COPY_ICON_SIZE}px)`,
          cursor: 'pointer',
        }}
        onClick={install.copyCommand}
        onKeyDown={install.handleCopyKeyDown}
      >
        <span className="nav-npm-text">{install.displayedCommand}</span>
        <CopyIcon
          size={COPY_ICON_SIZE}
          strokeWidth={COPY_ICON_STROKE}
          color={install.copied ? NAV_COPY_SUCCESS_COLOR : NAV_COPY_ICON_COLOR}
        />
      </span>
      {install.popoverOpen ? (
        <NavInstallPopover
          manager={install.selectedManager}
          onSelect={install.selectManager}
          onClose={install.closePopover}
          triggerRef={install.triggerRef}
          itemRefs={install.itemRefs}
          popoverRef={install.popoverRef}
        />
      ) : null}
    </Pill>
  )
}
