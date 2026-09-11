/** @jsxRuntime automatic */
/**
 * The hero's install pill: `npm install zombie-mermaid` behind the same
 * package-manager popover the nav bar's install pill uses
 * (use-package-manager-install.ts's {@link usePackageManagerInstall},
 * zombie-mermaid#719) — moved here and made compact so a visitor can pick
 * npm/pnpm/yarn/bun straight from the hero. The homepage's own header has no
 * room for this control today: its install-pill slot carries the live theme
 * picker instead (`nav.tsx`'s `NavProps.installSlot` doc comment), which is
 * also why this pill needs its own instance rather than reusing the
 * header's.
 *
 * Reuses nav-install-popover.tsx's {@link NavInstallPrefix}/{@link
 * NavInstallPopover} verbatim rather than re-implementing the trigger/
 * popover chrome — the only hero-specific piece is the outer `<Pill>`'s
 * fill (`--panel`, this row's existing look, instead of the nav pill's
 * `--panel-2`) and the copy span's plain text (no
 * `.nav-npm-text`/600px-hiding rule here — the hero pill has no header
 * dead-zone to work around, so the full command stays visible at every
 * width; see `.hero-install-pill`'s own `${MEDIA.mobile}` rule in
 * index-page.tsx for the *different* mobile problem this pill does have —
 * keeping its own rendered width inside `.hero-copy` instead of widening
 * the page — and this file's own inner-wrapper `style` comment for the
 * rest of that fix).
 *
 * Split out of `index-app.tsx` into its own file (zombie-mermaid#932).
 */
import { NavInstallPrefix, NavInstallPopover } from './nav-install-popover.tsx'
import { usePackageManagerInstall } from './use-package-manager-install.ts'
import { CopyIcon } from './icons.tsx'
import { Pill } from './primitives.tsx'
import { SPACE, colorVar } from './tokens.tsx'

const NPM_INSTALL_COMMAND = 'npm install zombie-mermaid'

/** The hero's install pill's divider height, in px — matches the nav bar's
 * own install pill (`nav.tsx`'s `INSTALL_DIVIDER_HEIGHT`); kept as its own
 * literal here rather than importing a private constant from that file. */
const HERO_INSTALL_DIVIDER_HEIGHT = 18

/** The hero install pill's copy glyph, sized like {@link HeroInstall}'s
 * former static checkmark (14px) so replacing one with the other doesn't
 * shift the pill's height. */
const HERO_COPY_ICON_SIZE = 14
const HERO_COPY_ICON_STROKE = 2

export function HeroInstall() {
  const install = usePackageManagerInstall(NPM_INSTALL_COMMAND)

  return (
    <Pill
      mono
      className="hero-install-pill"
      style={{
        background: colorVar('--panel'),
        border: `1px solid ${colorVar('--border')}`,
        color: colorVar('--text'),
        position: 'relative',
        // The pill is a flex item of `.hero-copy`'s column flex layout
        // (index-app.tsx), whose default `min-width: auto` resolves to
        // this pill's own content width — the full `npm install
        // zombie-mermaid` command, which is wider than `.hero-copy` at
        // mobile widths. Without this, that trap overrides `.hero-copy`'s
        // `max-width: 100%` and widens the whole page instead of the pill
        // shrinking in place. The actual horizontal-scroll fallback (for
        // whatever the pill still can't shrink to fit) lives one level
        // in, on the wrapper span below — *not* here — because this `Pill`
        // is also `NavInstallPopover`'s positioned ancestor
        // (`position: relative`); an `overflow-x` other than `visible` on
        // it would clip the popover, which renders as this element's own
        // absolutely-positioned sibling and needs to hang below the pill
        // uncropped (matches diagram-page.tsx's `.dc-root`/`NavIsland`
        // comment — same "don't put a clipping overflow on a popover's own
        // positioned ancestor" trap, one popover over).
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${SPACE.sm}px`,
          // Scoped to just the trigger/divider/copy row (not the outer
          // `Pill`, and not the popover below) — see the `Pill` `style`
          // comment above for why.
          minWidth: 0,
          overflowX: 'auto',
        }}
      >
        <NavInstallPrefix
          manager={install.selectedManager}
          open={install.popoverOpen}
          onToggle={install.togglePopover}
          triggerRef={install.triggerRef}
        />
        <span
          aria-hidden="true"
          style={{
            width: '1px',
            height: `${HERO_INSTALL_DIVIDER_HEIGHT}px`,
            background: colorVar('--border'),
            flexShrink: 0,
          }}
        />
        <span
          role="button"
          tabIndex={0}
          aria-label="Copy install command"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${SPACE.sm}px`,
            // Reserves room for the widest of the four managers' commands —
            // see nav.tsx's `widestCommand` doc comment — so switching
            // managers can only ever leave trailing space here, never shrink
            // the pill and shove the CTA button beside it (zombie-mermaid#902).
            minWidth: `calc(${install.widestCommand.length}ch + ${SPACE.sm}px + ${HERO_COPY_ICON_SIZE}px)`,
            cursor: 'pointer',
          }}
          onClick={install.copyCommand}
          onKeyDown={install.handleCopyKeyDown}
        >
          <span>{install.displayedCommand}</span>
          <CopyIcon
            size={HERO_COPY_ICON_SIZE}
            strokeWidth={HERO_COPY_ICON_STROKE}
            color={install.copied ? colorVar('--green') : colorVar('--cyan')}
          />
        </span>
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
