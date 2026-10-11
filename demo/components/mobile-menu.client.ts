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
 * (zombie-mermaid#933) — tsc/eslint/prettier all now check this logic like
 * any other module instead of treating it as opaque text. It stops short
 * of pages.ts/blog.ts/dashboard.ts's own `bundleForBrowser()`-based
 * pattern for their client scripts: those bundles get threaded through
 * every page generator and page component as an async prop, which for this
 * script would mean touching all six site generators and every page
 * component that renders `<NavMobileMenuScript>` — a far larger blast
 * radius than splitting nav.tsx, and one that would collide with the
 * concurrent #932/#935 work on exactly those page components. Instead,
 * nav.tsx derives `NAV_MOBILE_MENU_SCRIPT` by serializing {@link
 * initMobileMenu} via `Function.prototype.toString()` (see that constant's
 * doc comment) — real, checked TypeScript in this file, a synchronous
 * string at every existing call site, identical runtime behavior.
 *
 * Pairs each `.nav-bar` with the `.mobile-nav-panel` that follows it —
 * `MobileNavPanel`'s own doc comment explains why that panel renders as
 * `Nav`'s sibling rather than nested inside the bar, which is what makes
 * `nextElementSibling` the right (and simplest) way to find it, with no
 * `id`/`aria-controls` pair needed and nothing to collide if a future page
 * ever renders more than one `Nav`.
 *
 * Behavior: click toggles; tapping a link or pressing Escape closes and
 * (for Escape) returns focus to the toggle; opening moves focus to the
 * first link and locks background scroll via the `mobile-nav-open` class
 * nav-css.ts's `navCss()` keys off. What this does *not* do —
 * deliberately, to keep a first version scoped — is trap Tab/Shift+Tab
 * inside the open panel; revisit if that turns out to matter in practice.
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
  function closeMenu(
    toggle: HTMLElement,
    panel: Element,
    returnFocus: boolean,
  ): void {
    panel.classList.remove('is-open')
    toggle.classList.remove('is-open')
    toggle.setAttribute('aria-expanded', 'false')
    document.documentElement.classList.remove('mobile-nav-open')
    if (returnFocus) toggle.focus()
  }

  function openMenu(toggle: HTMLElement, panel: Element): void {
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

    panel.addEventListener('keydown', function (event) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        event.preventDefault()
        closeMenu(toggle, panel, true)
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
 * Strips `__name(fn, "fn")` calls out of a function's serialized source.
 *
 * `tsx` — what every site generator (`dashboard.ts`, `index.ts`, …) runs
 * under — compiles this file with esbuild's `keepNames` transform option
 * on, which wraps every named function declaration in a call to a `__name`
 * helper so `.name` survives whatever renaming a later minify pass might
 * do. That helper is defined once in *this module's own* compiled output,
 * not inside {@link initMobileMenu} itself, so it never appears in that
 * function's own `Function.prototype.toString()` text — but the *calls*
 * to it, injected directly into the function bodies, do. Left in, every
 * page's embedded `<script>` would throw `__name is not defined` the
 * instant a browser ran it, since no such global exists there. (Vitest's
 * own esbuild transform — what runs this repo's test suite, including the
 * `eval(NAV_MOBILE_MENU_SCRIPT)` tests — doesn't set that option, which is
 * exactly why this went unnoticed by any test until the real generator
 * output was diffed against `main`: see this issue's PR description.)
 *
 * The pattern is safe to strip unconditionally: `__name` is esbuild's own
 * reserved helper name, never one real code would define or call, and its
 * two arguments (an identifier, a string literal) never contain parens of
 * their own.
 */
function stripEsbuildKeepNamesHelperCalls(source: string): string {
  return source.replace(/__name\([^()]*\);?/g, '')
}

/**
 * `initMobileMenu`, serialized as an immediately-invoked function
 * expression — the literal string every page's `<script>` tag runs
 * (nav.tsx's `NavMobileMenuScript`), and the same string
 * `__tests__/demo-nav.test.ts`/`__tests__/dom/nav-hydration.test.ts` `eval`
 * directly to exercise this behavior against jsdom.
 *
 * `Function.prototype.toString()` returns a function's own source text as
 * it exists at runtime — by the time this module has finished loading
 * (under `tsx`, or bundled by Vite/esbuild for a test run), TypeScript's
 * type annotations on {@link initMobileMenu} are already stripped, so this
 * produces plain, directly-`eval`-able JavaScript with no build step of
 * its own, the same way the pre-#933 template literal did — modulo
 * {@link stripEsbuildKeepNamesHelperCalls}'s cleanup, see that function's
 * doc comment.
 */
export const NAV_MOBILE_MENU_SCRIPT = `(${stripEsbuildKeepNamesHelperCalls(initMobileMenu.toString())})(${BREAKPOINTS.tablet + 1})`
