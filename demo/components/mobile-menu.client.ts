import { MOBILE_MENU_SCRIPT_SOURCE } from './mobile-menu-script.ts'
import { BREAKPOINTS } from './tokens.tsx'

/**
 * Opens, closes, and focus-manages the mobile nav panel (nav.tsx's
 * `MobileNavPanel`) — a plain runtime script, not React state, even though
 * `Nav` itself hydrates (#800): the toggle and panel render exactly the
 * same DOM either way, and this behavior was out of scope for #800 (see
 * nav.tsx's module doc comment on the mobile menu being invented, not
 * canvas-pinned) — the install pill's copy button is the one piece of
 * `Nav` interactivity that issue converted to real `onClick`/`useState`.
 *
 * Promoted out of nav.tsx's own `NAV_MOBILE_MENU_SCRIPT` template-literal
 * string constant into this real, type-checked source file
 * (zombie-mermaid#933) — tsc/oxlint/oxfmt all now check this logic like
 * any other module instead of treating it as opaque text. It stops short
 * of pages.ts/blog.ts/dashboard.ts's own `bundleForBrowser()`-based
 * pattern for their client scripts: those bundles get threaded through
 * every page generator and page component as an async prop, which for this
 * script would mean touching all six site generators and every page
 * component that renders `<NavMobileMenuScript>` — a far larger blast
 * radius than splitting nav.tsx, and one that would collide with the
 * concurrent #932/#935 work on exactly those page components. Instead,
 * nav.tsx uses `NAV_MOBILE_MENU_SCRIPT`, the compact literal form of {@link
 * initMobileMenu} (see that constant's doc comment) — a synchronous string
 * at every existing call site, identical runtime behavior.
 *
 * Pairs each `.nav-bar` with the `.mobile-nav-panel` that follows it —
 * `MobileNavPanel`'s own doc comment explains why that panel renders as
 * `Nav`'s sibling rather than nested inside the bar, which is what makes
 * `nextElementSibling` the right (and simplest) way to find it, with no
 * id lookup needed (the toggle's `aria-controls` still points at the
 * panel's id, purely for assistive tech).
 *
 * Behavior: click toggles; tapping a link or pressing Escape closes and
 * (for Escape) returns focus to the toggle; opening moves focus to the
 * first link and locks background scroll via the `mobile-nav-open` class
 * nav-css.ts's `navCss()` keys off. While open, Tab/Shift+Tab wrap inside
 * the panel (#1760); while closed, nav-css.ts hides it with
 * `visibility: hidden` so its links are not focusable.
 *
 * Also resets the menu when the viewport grows past the tablet breakpoint
 * while it's open (a window resize, or a phone rotated). `navCss()`'s own
 * `min-width` safety net only hides the panel visually
 * (`opacity`/`pointer-events`) at that point — the toggle (already
 * `display: none` there, so invisible either way) and `<html>` both stay
 * stuck in their "open" state otherwise, which leaves background scroll
 * locked on desktop indefinitely and, if the viewport later shrinks back
 * below the breakpoint, makes the panel reappear already open with no
 * click that opened it. `window.matchMedia`'s own `change` event is the
 * primary signal, with a `resize`-driven fallback gated on an actual
 * `.matches` flip for environments that don't reliably dispatch `change`
 * for an emulated viewport (devtools/CDP-driven resizing, observed the same
 * way in `demo/diagram-page-client.ts`'s `narrowViewportQuery` and
 * `demo/client.ts`'s gallery equivalent) even though `.matches` itself is
 * correct there — the exact same two-layer pattern, applied here to the
 * opposite (`min-width`) direction.
 *
 * `desktopMinWidthPx` is passed in rather than read from tokens.tsx
 * directly: this function's *source text* (not its return value) is what
 * ends up embedded in the page via {@link NAV_MOBILE_MENU_SCRIPT}, so a
 * build-time constant has to arrive as a call argument baked into that
 * string, the same way the original template literal interpolated it
 * directly into the script text.
 */
export function initMobileMenu(desktopMinWidthPx: number): void {
  /** Content made `inert` while a menu is open, so the page behind the
   * panel is out of the tab order and the a11y tree: siblings of the bar
   * and of each of its ancestors, except the bar and the panel. */
  let inerted: Element[] = []

  function setInert(bar: Element | null, panel: Element): void {
    inerted.forEach(function (el) {
      el.removeAttribute('inert')
    })
    inerted = []
    for (let node = bar; node && node !== document.body;) {
      const parent: Element | null = node.parentElement
      if (!parent) break
      for (const sib of Array.from(parent.children)) {
        if (sib === node || sib === panel || sib.hasAttribute('inert')) continue
        sib.setAttribute('inert', '')
        inerted.push(sib)
      }
      node = parent
    }
  }

  function closeMenu(
    toggle: HTMLElement,
    panel: Element,
    returnFocus: boolean,
  ): void {
    setInert(null, panel)
    panel.classList.remove('is-open')
    toggle.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
    document.documentElement.classList.remove('mobile-nav-open')
    if (returnFocus) toggle.focus()
  }

  function openMenu(toggle: HTMLElement, panel: Element): void {
    setInert(toggle.closest('.nav-bar'), panel)
    panel.classList.add('is-open')
    toggle.classList.add('is-open')
    toggle.setAttribute('aria-expanded', 'true')
    document.documentElement.classList.add('mobile-nav-open')
    const firstLink = panel.querySelector<HTMLElement>('.mobile-link')
    if (firstLink) firstLink.focus()
  }

  /** Wires one `.nav-bar`/`.mobile-nav-panel` pair once both have been
   * confirmed to exist, so the rest of this function never has to narrow
   * a possibly-null `toggle`/`panel` again. */
  function wireMenu(
    toggle: HTMLElement,
    panel: Element,
    desktopQuery: MediaQueryList,
  ): void {
    toggle.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) {
        closeMenu(toggle, panel, true)
      } else {
        openMenu(toggle, panel)
      }
    })

    panel.querySelectorAll('.mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu(toggle, panel, false)
      })
    })

    // On `document`, not the panel: the toggle sits outside the panel, so
    // Escape with focus on it (screen-reader virtual cursor) must close too.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) {
        event.preventDefault()
        closeMenu(toggle, panel, true)
      }
    })

    panel.addEventListener('keydown', function (event) {
      if (!(event instanceof KeyboardEvent)) return
      // Focus trap (#1760): the open panel covers the page, so wrap Tab
      // and Shift+Tab at its first/last focusable instead of leaking
      // behind it.
      if (event.key !== 'Tab') return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    })

    function closeIfDesktop(): void {
      if (desktopQuery.matches && panel.classList.contains('is-open')) {
        closeMenu(toggle, panel, false)
      }
    }

    desktopQuery.addEventListener('change', closeIfDesktop)

    let lastDesktopMatch = desktopQuery.matches
    window.addEventListener('resize', function () {
      if (desktopQuery.matches === lastDesktopMatch) return
      lastDesktopMatch = desktopQuery.matches
      closeIfDesktop()
    })
  }

  const desktopQuery = window.matchMedia(
    '(min-width: ' + desktopMinWidthPx + 'px)',
  )

  document.querySelectorAll('.nav-bar').forEach(function (bar) {
    const toggle = bar.querySelector<HTMLElement>('.menu-toggle')
    const panel = bar.nextElementSibling
    if (!toggle || !panel || !panel.classList.contains('mobile-nav-panel')) {
      return
    }
    wireMenu(toggle, panel, desktopQuery)
  })
}

/**
 * The script every page's `<script>` tag runs (nav.tsx's
 * `NavMobileMenuScript`) and the string `__tests__/demo-nav.test.ts` and
 * `__tests__/dom/nav-hydration.test.ts` `eval` against jsdom: the compact form
 * of {@link initMobileMenu} (mobile-menu-script.ts, generated at build time),
 * called with the desktop breakpoint. A generated string rather than `initMobileMenu.toString()` so the output
 * is the same whichever transformer built the page (tsx, Vite SSR).
 */
export const NAV_MOBILE_MENU_SCRIPT = `${MOBILE_MENU_SCRIPT_SOURCE}(${BREAKPOINTS.tablet + 1})`
