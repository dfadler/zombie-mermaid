/** @jsxRuntime automatic */
import { footerCss } from './footer.tsx'
import { navCss } from './nav-css.ts'
import { primitivesCss } from './primitives.tsx'
import { designBaseCss } from './tokens.tsx'

/**
 * The four shared stylesheet functions every site-generator page composes,
 * joined in the cascade order the design system requires: tokens.tsx's
 * `designBaseCss()` (custom properties and base elements), then
 * primitives.tsx's `primitivesCss()` (`.card`/`.pill`/`.section-eyebrow`),
 * then nav-css.ts's `navCss()` and footer.tsx's `footerCss()` (each layer's
 * responsive rules assume the ones before it are already in scope). `extra`,
 * when given, is spliced in last as the page's own stylesheet.
 *
 * All five site generators — blog.ts, dashboard.ts, fork-fixes.ts,
 * `DiagramTypePage`/`DiagramHubPage`, and `IndexPage` — compose exactly
 * these four calls in exactly this order; this is the one place that
 * ordering requirement lives, instead of a comment restated at each call
 * site (zombie-mermaid#751).
 *
 * Lives in its own module rather than alongside `designBaseCss` in
 * tokens.tsx: tokens.tsx is the base of this dependency graph (primitives.tsx,
 * nav-css.ts, and footer.tsx all import from it), so having it import
 * `primitivesCss`/`navCss`/`footerCss` back would create a circular import —
 * which breaks at runtime (a `ReferenceError` from a `const` accessed before
 * its owning module finishes initializing), not just at lint time. This
 * module sits above all four, so it can depend on each without a cycle.
 * (nav-constants.ts, split out of nav.tsx alongside nav-css.ts for exactly
 * this reason, is the same pattern one level down — see that file's own
 * doc comment.)
 */
export function sharedPageCss(extra?: string): string {
  return [designBaseCss(), primitivesCss(), navCss(), footerCss(), extra]
    .filter((css): css is string => Boolean(css))
    .join('\n\n')
}

/**
 * The same four calls {@link sharedPageCss} joins, each in its own `<style>`
 * element, for a React page's `<head>`.
 *
 * Deliberately four separate tags rather than `<style>{sharedPageCss()}</style>`
 * — this is a byte-for-byte replacement for the four `<style>` tags every
 * `DiagramTypePage`/`DiagramHubPage`/`IndexPage` call site used to write out
 * individually, so it produces identical markup (verified by
 * `__tests__/site-equivalence.test.ts`'s golden snapshots) rather than
 * merely visually-identical output.
 */
export function SharedPageStyles() {
  return (
    <>
      <style>{designBaseCss()}</style>
      <style>{primitivesCss()}</style>
      <style>{navCss()}</style>
      <style>{footerCss()}</style>
    </>
  )
}
