/**
 * Shared type for `window.__harness`, the API the bundled browser harness
 * (harness-entry.ts) exposes. Importing this file — even just its types —
 * pulls in the `declare global` augmentation below, which is what lets test
 * files reference `window.__harness` inside `page.evaluate()` callbacks
 * without a type assertion.
 */
import type {
  mountAsciiPanel,
  mountSidebarList,
  mountSvgPanel,
  unmount,
} from './mount.ts'
import type { buildTerminalPanel } from './terminal-panel.ts'

export interface HarnessApi {
  mountSvgPanel: typeof mountSvgPanel
  mountAsciiPanel: typeof mountAsciiPanel
  mountSidebarList: typeof mountSidebarList
  unmount: typeof unmount
  buildTerminalPanel: typeof buildTerminalPanel
}

declare global {
  interface Window {
    __harness: HarnessApi
  }
}
