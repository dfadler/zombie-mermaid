/**
 * Browser-side entry point for the visual regression suite's Playwright
 * Test harness. Bundled by build-harness.ts (esbuild) into a single script
 * and injected into a blank page via page.setContent(); the test file (Node
 * side) then drives it through page.evaluate() calls against
 * `window.__harness`.
 *
 * Playwright Test runs entirely in Node — there is no browser-side RPC
 * bridge like Vitest's browser mode has, which is the whole point (see
 * vitest-dev/vitest#10791 / zombie-mermaid#299). Rendering itself
 * (renderMermaidSVG/renderMermaidASCII) already happens in Node, in the
 * test file; only DOM mounting needs to run in the browser, which is all
 * this file and the modules it re-exports do.
 */
import {
  mountAsciiPanel,
  mountSidebarList,
  mountSvgPanel,
  unmount,
} from './mount.ts'
import { buildTerminalPanel } from './terminal-panel.ts'
import type {} from './harness-types.ts'

window.__harness = {
  mountSvgPanel,
  mountAsciiPanel,
  mountSidebarList,
  unmount,
  buildTerminalPanel,
}
