/**
 * Guards `scripts/load-css-module.ts`, the CSS Modules seam #938 opens
 * behind `demo/components/primitives.tsx`'s `primitivesCss()` (part of the
 * #931 umbrella).
 *
 * Runs against the real `demo/components/primitives.module.css` rather
 * than a throwaway fixture — a real `.module.css` file already exists for
 * this repo's one converted `*Css()` function, and using it directly means
 * this test also catches a regression in the file it's actually meant to
 * protect, not just in a synthetic stand-in that could drift from it.
 */
import { describe, expect, it } from 'vitest'
import { loadCssModule } from '../scripts/load-css-module.ts'

const PRIMITIVES_MODULE_CSS = new URL(
  '../demo/components/primitives.module.css',
  import.meta.url,
)

describe('loadCssModule', () => {
  it('resolves hashed class names and the compiled stylesheet text', async () => {
    const { css, classes } = await loadCssModule<{
      card: string
      pill: string
      'section-eyebrow': string
    }>(PRIMITIVES_MODULE_CSS)

    // Hashed: primitives.module.css is in load-css-module.ts's
    // HASHED_MODULE_CSS_BASENAMES (zombie-mermaid#969) — every consumer
    // migrated to importing this classes map, so the output class name is
    // no longer required to equal the source selector. Each still starts
    // with `<name>_` followed by six hex characters (see
    // `hashedScopedName`'s doc comment).
    for (const [name, output] of Object.entries(classes)) {
      expect(output).toMatch(new RegExp(`^${name}_[0-9a-f]{6}$`))
    }
    expect(css).toContain(`.${classes.card} {`)
    expect(css).toContain('background: var(--panel);')
    // .mono isn't part of this file anymore — see primitives.module.css's
    // own comment and tokens.tsx's designBaseCss(). (The compiled output
    // still mentions ".mono" in that explanatory comment, so this checks
    // for an actual rule rather than the substring.)
    expect(css).not.toMatch(/\.mono\s*\{/)
  })

  it('serves a second call from the on-disk cache with an identical result', async () => {
    const first = await loadCssModule(PRIMITIVES_MODULE_CSS)
    const t0 = performance.now()
    const second = await loadCssModule(PRIMITIVES_MODULE_CSS)
    const elapsedMs = performance.now() - t0

    expect(second).toEqual(first)
    // A cache hit is a readFile + JSON.parse; a cold call spins up a real
    // Vite build (~100ms+, see load-css-module.ts's header comment). 50ms
    // is generous headroom above a cache hit while still well under a
    // real rebuild, so this fails if caching silently stops working
    // without being so tight it flakes on a loaded CI runner.
    expect(elapsedMs).toBeLessThan(50)
  })

  it('rejects a nonexistent .module.css file instead of silently returning empty output', async () => {
    const missing = new URL('./does-not-exist.module.css', import.meta.url)
    await expect(loadCssModule(missing)).rejects.toThrow()
  })
})

// Deliberately does not delete .css-modules-cache/ afterward: it's a
// content-addressed, gitignored cache (see .gitignore) meant to persist
// across runs — cleaning it up here would defeat the second test's own
// point on every subsequent run.
