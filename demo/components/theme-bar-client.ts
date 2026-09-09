/**
 * The interactive controller for the global `ThemeBar`/`ThemePicker` (see
 * `site-chrome.tsx`'s `ThemeBar` and `theme-picker.tsx`'s `ThemePicker`) --
 * #686's piece of the theme-selector restoration (#684).
 *
 * `ThemeBar`/`ThemePicker` are server-rendered React components (see
 * `theme-picker.tsx`'s header comment): they produce markup at build time
 * with no client-side React runtime attached, the same way `pages.ts`'s
 * per-diagram-type pages already work. This module is the client-side half
 * every page that mounts them needs to bundle and call once the markup is
 * in the DOM -- one `initThemeBar()` call wires pill selection, the "More"
 * dropdown, and keyboard support, all routed through `theme-state.ts`
 * rather than each page reimplementing its own `localStorage` handling (the
 * duplication that module's own header comment describes).
 *
 * Deliberately standalone from `demo/diagram-page-client.ts`: that file
 * also re-themes an embedded `<svg>` and the page chrome around it, neither
 * of which is this shared component's concern (SVG re-theming is #689's
 * job) -- this module only ever touches the theme bar itself.
 *
 * Accessibility: restores the `aria-expanded`/`aria-haspopup` behavior
 * fixed for the old picker in #281 (see that commit for the regression --
 * the "More" button's `aria-expanded` silently drifting from the
 * dropdown's actual open/closed state), plus the keyboard support the old
 * picker never had: `Escape` returns focus to the trigger (not just closes
 * the dropdown), and `ArrowUp`/`ArrowDown`/`Home`/`End` roam the dropdown's
 * own pills while it's open. Every real theme pill is a native `<button>`,
 * so `Tab` and `Enter`/`Space` already work for free without any JS here.
 */
import { getTheme, setTheme, subscribe } from '../theme-state.ts'

export interface ThemeBarController {
  /**
   * Removes every listener this call added and unsubscribes from
   * `theme-state.ts`. Idempotent-ish in that calling it twice is harmless,
   * but not meant to be called more than once per `initThemeBar()` call.
   */
  destroy(): void
}

const NOOP_CONTROLLER: ThemeBarController = {
  destroy() {
    // Nothing was wired -- see initThemeBar()'s early return below.
  },
}

/**
 * Wires a mounted `ThemeBar`/`ThemePicker` DOM subtree to `theme-state.ts`.
 *
 * `root` scopes every lookup and the pill-click listener (defaults to
 * `document`) so a page with more than one theme bar, or a test harness
 * mounting a detached fragment, doesn't leak a listener onto unrelated
 * markup. When the expected `#theme-pills` container isn't present under
 * `root`, this returns a no-op controller instead of throwing -- a page
 * with no theme bar (most of them, today -- #687 is what starts passing
 * `themePills` more broadly) can safely call this unconditionally.
 */
export function initThemeBar(root: ParentNode = document): ThemeBarController {
  const pillsContainer = root.querySelector<HTMLElement>('#theme-pills')
  if (!pillsContainer) return NOOP_CONTROLLER

  const moreBtn = root.querySelector<HTMLButtonElement>('#theme-more-btn')
  const moreDropdown = root.querySelector<HTMLElement>('#theme-more-dropdown')

  function allPills(): HTMLElement[] {
    return Array.from(
      pillsContainer!.querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
    )
  }

  function dropdownPills(): HTMLElement[] {
    return moreDropdown
      ? Array.from(
          moreDropdown.querySelectorAll<HTMLElement>('.theme-pill[data-theme]'),
        )
      : []
  }

  /** Marks whichever pill(s) match `themeKey` active, everywhere else not. */
  function syncActive(themeKey: string): void {
    for (const pill of allPills()) {
      pill.classList.toggle(
        'active',
        pill.getAttribute('data-theme') === themeKey,
      )
    }
  }

  function isOpen(): boolean {
    return moreDropdown?.classList.contains('open') ?? false
  }

  function closeDropdown(opts: { refocus?: boolean } = {}): void {
    if (!moreDropdown || !moreBtn || !isOpen()) return
    moreDropdown.classList.remove('open')
    moreBtn.setAttribute('aria-expanded', 'false')
    if (opts.refocus) moreBtn.focus()
  }

  function openDropdown(): void {
    if (!moreDropdown || !moreBtn) return
    moreDropdown.classList.add('open')
    moreBtn.setAttribute('aria-expanded', 'true')
  }

  // Initial paint: a server-rendered page always starts on its own
  // build-time default (e.g. pages.ts's per-diagram default), which can
  // differ from whatever this visitor last picked.
  syncActive(getTheme())

  // -- Pill selection (event delegation covers both the inline row and the
  //    dropdown copy, since #theme-pills wraps both -- see ThemeBar) --
  function onPillsClick(e: MouseEvent): void {
    const target = e.target
    if (!(target instanceof Element)) return
    const pill = target.closest('.theme-pill')
    // The "More" button itself carries the .theme-pill class for shared
    // styling -- exclude it so opening the dropdown isn't mistaken for
    // picking a (nonexistent) theme.
    if (!pill || pill === moreBtn) return
    const themeKey = pill.getAttribute('data-theme')
    // `!== null`, not a truthiness check -- the Default pill's data-theme
    // is '', a valid key a truthiness check would silently ignore.
    if (themeKey === null) return
    setTheme(themeKey)
    closeDropdown({ refocus: true })
  }
  pillsContainer.addEventListener('click', onPillsClick)

  const cleanupFns: Array<() => void> = [
    () => pillsContainer.removeEventListener('click', onPillsClick),
  ]

  if (moreBtn && moreDropdown) {
    function onMoreBtnClick(e: MouseEvent): void {
      e.stopPropagation()
      if (isOpen()) closeDropdown()
      else openDropdown()
    }
    function onDocumentClick(e: MouseEvent): void {
      if (!isOpen()) return
      const target = e.target
      if (
        !(target instanceof Element) ||
        !target.closest('.theme-more-wrapper')
      ) {
        closeDropdown()
      }
    }
    function onDocumentKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && isOpen()) closeDropdown({ refocus: true })
    }
    // Roving arrow-key navigation between the dropdown's own pills while
    // it's open. Wraps at both ends (ArrowDown from the last pill lands on
    // the first, and vice versa) and Home/End jump straight to an end --
    // the standard menu-navigation pattern, restoring what the old picker
    // never actually had (it only ever supported Escape-to-close).
    function onDropdownKeydown(e: KeyboardEvent): void {
      const items = dropdownPills()
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

    moreBtn.addEventListener('click', onMoreBtnClick)
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)
    moreDropdown.addEventListener('keydown', onDropdownKeydown)

    cleanupFns.push(
      () => moreBtn.removeEventListener('click', onMoreBtnClick),
      () => document.removeEventListener('click', onDocumentClick),
      () => document.removeEventListener('keydown', onDocumentKeydown),
      () => moreDropdown.removeEventListener('keydown', onDropdownKeydown),
    )
  }

  // Cross-tab/cross-page sync -- and same-tab, for a page that ever calls
  // setTheme() from somewhere other than this controller's own click
  // handler above (subscribe() delivers both; syncActive() is idempotent
  // either way).
  cleanupFns.push(subscribe(syncActive))

  return {
    destroy() {
      for (const fn of cleanupFns) fn()
    },
  }
}
