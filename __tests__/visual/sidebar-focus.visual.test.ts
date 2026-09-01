/**
 * Visual regression test — sidebar link focus-visible ring.
 *
 * demo/styles.css's shared `a:focus-visible` ring (outline + outline-offset,
 * see zombie-mermaid#283/#316) draws outside the `<a>`'s border box. Before
 * zombie-mermaid#325, `.sidebar-list li` set `overflow: hidden` — originally
 * meant for text-truncation ellipsis that was never actually wired up (no
 * `white-space: nowrap` was ever paired with it; see the comment on
 * `.sidebar-list li` in demo/styles.css) — which clipped that ring down to
 * an almost-invisible ~2px sliver on sidebar sample links specifically,
 * defeating the keyboard-focus visibility #283/#316 were meant to guarantee
 * site-wide.
 *
 * This mounts the real sidebar markup (helpers/mount.ts#mountSidebarList),
 * Tab-focuses the first link exactly like a keyboard user would — a plain
 * script `.focus()` call doesn't reliably engage Chromium's
 * `:focus-visible` heuristic the way a real Tab keypress does — and
 * screenshots the `.sidebar` container (wide enough to include the ring's
 * outline-offset bleed past the link's own box) so a regression back to a
 * clipping ancestor shows up as a pixel diff. Nothing else in this suite
 * would catch it: the rest renders sample diagram output, never an
 * unfocused-vs-focused UI chrome state.
 *
 * Run with `pnpm test:visual`. Update the baseline after an intentional
 * change with `pnpm test:visual:update`.
 */
import { expect, test } from '@playwright/test'
import { buildHarnessScript } from './helpers/build-harness.ts'
import type {} from './helpers/harness-types.ts'

test('sidebar link focus-visible ring is not clipped by an ancestor', async ({
  page,
}) => {
  const harnessScript = await buildHarnessScript()
  await page.setContent('<!DOCTYPE html><html><body></body></html>')
  await page.addScriptTag({ content: harnessScript })

  await page.evaluate(() =>
    window.__harness.mountSidebarList([
      'Simple Flow',
      'Original Node Shapes',
      'Batch 1 Shapes',
    ]),
  )

  // Real keyboard navigation, not element.focus(): the mounted page has no
  // other focusable element, so the first Tab lands on the native
  // <summary> (itself focusable) and the second on the first sidebar link —
  // the same path a keyboard user tabbing into the sidebar takes, which is
  // what actually triggers :focus-visible.
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.locator('.sidebar-list a').first()).toBeFocused()

  await expect(page.locator('.sidebar')).toHaveScreenshot(
    'sidebar-link-focus-ring.png',
  )
})
