/**
 * Package-manager install state (zombie-mermaid#719), split out of nav.tsx
 * into its own module (zombie-mermaid#933) since it's pure state/DOM-event
 * logic with no JSX of its own — the easiest of nav.tsx's four tangled
 * concerns to test in isolation, once it lived somewhere that could be
 * imported without the rest of the nav bar.
 *
 * Shared by nav-install-popover.tsx's `NavInstall` (the nav bar, on every
 * page but the homepage) and the homepage hero's own compact instance
 * (`hero-install.tsx`'s `HeroInstall`) — both drive the same popover-and-copy
 * behavior off this one hook, so there is exactly one definition of it
 * regardless of which chrome wraps it.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

/**
 * The four package managers the install pill's popover offers, in the
 * order the popover lists them. `'npm'` is first and the default —
 * matching `NAV_INSTALL_COMMAND` (nav.tsx) and this hook's pre-#719
 * behavior.
 */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const

/** One of {@link PACKAGE_MANAGERS}, e.g. `'pnpm'`. */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/**
 * The literal prefix an npm-style install command (e.g. nav.tsx's
 * `NAV_INSTALL_COMMAND`, and by convention any page's `installCommand`
 * override) starts with — `'npm install '`. Used only to recover the bare
 * package name so the other three managers' own verbs can be substituted
 * in; see {@link packageNameFromCommand}.
 */
const NPM_INSTALL_PREFIX = 'npm install '

/**
 * Recovers the package name from an npm-style install command, e.g.
 * `'npm install zombie-mermaid'` → `'zombie-mermaid'`.
 *
 * A page's `installCommand` prop is the only source for this — there is no
 * separate "package name" prop — so this assumes the npm phrasing
 * nav.tsx's `NAV_INSTALL_COMMAND` uses. A command that doesn't start with
 * {@link NPM_INSTALL_PREFIX} (a page overriding it with something else
 * entirely) is returned as-is: the pnpm/yarn/bun options then repeat that
 * same string verbatim rather than guessing at its structure, which is the
 * smallest safe fallback for a prop that's free-form text.
 */
export function packageNameFromCommand(installCommand: string): string {
  return installCommand.startsWith(NPM_INSTALL_PREFIX)
    ? installCommand.slice(NPM_INSTALL_PREFIX.length)
    : installCommand
}

/**
 * The install command for a given package manager and package name —
 * `npm install <pkg>` for npm, `<manager> add <pkg>` for the other three
 * (pnpm, yarn, and bun all share the `add` verb).
 */
export function installCommandFor(
  manager: PackageManager,
  packageName: string,
): string {
  return manager === 'npm'
    ? `npm install ${packageName}`
    : `${manager} add ${packageName}`
}

/**
 * The copy glyph's flash duration, in ms — how long {@link
 * PackageManagerInstall.copied} stays `true` after a successful copy.
 */
const NAV_COPY_FEEDBACK_MS = 1200

/**
 * The runtime dependency {@link usePackageManagerInstall} needs for
 * copy-to-clipboard — an injectable stand-in for `navigator.clipboard`
 * (zombie-mermaid#933's acceptance criteria) so a direct unit test can pass
 * a mock in without touching global `navigator`/jsdom, which is finicky:
 * `@testing-library/user-event`'s `setup()` installs its own jsdom
 * `Clipboard` polyfill onto `navigator.clipboard` the first time it runs
 * (see `__tests__/dom/nav-hydration.test.ts`'s module doc comment for the
 * gotcha that caused).
 *
 * Omit the whole `env` argument (rather than passing `{}`) to keep reading
 * `navigator.clipboard` fresh on every {@link
 * PackageManagerInstall.copyCommand} call, exactly as this hook did before
 * #933 — the default for every existing caller (`NavInstall`, `HeroInstall`).
 * Passing `env` explicitly (even `{ clipboard: undefined }`, the "Clipboard
 * API unavailable" case) opts out of that fallback entirely, which is what
 * makes the "no clipboard" branch directly testable without deleting a
 * global.
 */
export interface PackageManagerInstallEnv {
  /** Writes text to the clipboard, or `undefined` when the Clipboard API
   * isn't available. */
  clipboard: Pick<Clipboard, 'writeText'> | undefined
}

/** Everything {@link usePackageManagerInstall} hands back to a caller. */
export interface PackageManagerInstall {
  /** The popover's current selection. */
  selectedManager: PackageManager
  /** Whether the popover is open. */
  popoverOpen: boolean
  /** Whether the "copied" flash is showing. */
  copied: boolean
  /** `command`, rewritten for {@link selectedManager}. */
  displayedCommand: string
  /** The longest of the four managers' commands for this `command`'s
   * package name — always the npm form. A caller reserves this as the copy
   * target's `min-width` (in `ch`) so switching managers never shrinks the
   * pill (zombie-mermaid#902). */
  widestCommand: string
  /** Attach to the trigger element a popover trigger component renders. */
  triggerRef: RefObject<HTMLSpanElement | null>
  /** Attach to the wrapper around a rendered popover. */
  popoverRef: RefObject<HTMLSpanElement | null>
  /** Attach to each popover item, for the popover's roving focus. */
  itemRefs: RefObject<(HTMLSpanElement | null)[]>
  /** Opens/closes the popover. */
  togglePopover: () => void
  /** Closes the popover without moving focus. */
  closePopover: () => void
  /** Picks a manager, closes the popover, and returns focus to the trigger. */
  selectManager: (next: PackageManager) => void
  /** Copies {@link displayedCommand} and flashes {@link copied}. */
  copyCommand: () => void
  /** Enter/Space activates {@link copyCommand}. */
  handleCopyKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => void
}

/**
 * State and handlers behind the install pill's package-manager popover and
 * copy-to-clipboard button — shared by `NavInstall` (nav-install-
 * popover.tsx, the nav bar on every page but the homepage) and the
 * homepage hero's own compact instance. Takes the same `command` prop
 * either caller already has (a page's `installCommand`/nav.tsx's
 * `NAV_INSTALL_COMMAND`), so there is exactly one definition of this
 * behavior regardless of which chrome wraps it.
 *
 * The initial SSR render always shows npm (`useState`'s default), matching
 * the pill's pre-#719 behavior exactly; the popover starts closed.
 *
 * `env` is optional — see {@link PackageManagerInstallEnv}'s doc comment
 * for the default-vs-explicit distinction that makes the clipboard
 * dependency directly testable.
 */
export function usePackageManagerInstall(
  command: string,
  env?: PackageManagerInstallEnv,
): PackageManagerInstall {
  const [selectedManager, setSelectedManager] = useState<PackageManager>('npm')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const popoverRef = useRef<HTMLSpanElement | null>(null)
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([])

  const packageName = packageNameFromCommand(command)
  const displayedCommand =
    selectedManager === 'npm'
      ? command
      : installCommandFor(selectedManager, packageName)
  // Always the `npm install <pkg>` form: `install` outruns the other three
  // managers' shared `add` verb regardless of `packageName`, so this is
  // always at least as long as any of the four rendered commands. Reserved
  // as the copy target's `min-width` (see the two call sites) so switching
  // managers can only ever leave *trailing* space in the pill, never shrink
  // it and shove whatever sits next to it (zombie-mermaid#902).
  const widestCommand = installCommandFor('npm', packageName)

  // Cleared on unmount so a pending revert never fires against an
  // unmounted component (defensive — neither caller intentionally unmounts
  // this, but hydration boundaries are exactly the place to not assume
  // that).
  useEffect(() => {
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current)
    }
  }, [])

  // Closes the popover on a click/tap outside both the trigger and the
  // popover itself, and on Escape regardless of which of the two currently
  // holds focus — the same "click elsewhere or Escape closes it" contract
  // mobile-menu.client.ts's script gives the mobile menu, done here in
  // React state instead since this popover is real `useState`, not a
  // runtime script.
  useEffect(() => {
    if (!popoverOpen) return

    function handlePointerDown(event: globalThis.MouseEvent): void {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setPopoverOpen(false)
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        setPopoverOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popoverOpen])

  // Moves focus into the popover when it opens — onto the currently
  // selected item, mirroring how opening the mobile nav panel focuses its
  // first link.
  useEffect(() => {
    if (!popoverOpen) return
    const activeIndex = PACKAGE_MANAGERS.indexOf(selectedManager)
    itemRefs.current[activeIndex >= 0 ? activeIndex : 0]?.focus()
    // Deliberately keyed on `popoverOpen` alone, not every `selectedManager`
    // change while open — selecting an item already closes the popover
    // (see `selectManager`), so re-running this on that change would never
    // observably differ.
  }, [popoverOpen])

  function copyCommand(): void {
    // `env` omitted entirely -> read `navigator.clipboard` fresh (this
    // hook's pre-#933 behavior); `env` passed explicitly -> use exactly
    // what it says, `undefined` included. See PackageManagerInstallEnv's
    // doc comment.
    const clipboard = env
      ? env.clipboard
      : typeof navigator === 'undefined'
        ? undefined
        : navigator.clipboard
    if (!displayedCommand || !clipboard) return
    clipboard.writeText(displayedCommand).then(() => {
      setCopied(true)
      if (revertTimer.current) clearTimeout(revertTimer.current)
      revertTimer.current = setTimeout(
        () => setCopied(false),
        NAV_COPY_FEEDBACK_MS,
      )
    })
  }

  function handleCopyKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      copyCommand()
    }
  }

  function selectManager(next: PackageManager): void {
    setSelectedManager(next)
    setPopoverOpen(false)
    triggerRef.current?.focus()
  }

  return {
    selectedManager,
    popoverOpen,
    copied,
    displayedCommand,
    widestCommand,
    triggerRef,
    popoverRef,
    itemRefs,
    togglePopover: () => setPopoverOpen((open) => !open),
    closePopover: () => setPopoverOpen(false),
    selectManager,
    copyCommand,
    handleCopyKeyDown,
  }
}
