/**
 * zombie-mermaid#809: the Code/Config tab buttons, their `.active` class,
 * and the two panels' visibility all moved to React -- see
 * `demo/components/editor-tabs.ts`'s `useEditorTabs`. What's left here is
 * the one thing that hook can't do itself: calling `refreshAllColorUIs()`
 * (`config-panel.ts`, not migrated to React until #808) whenever the
 * Config tab becomes active. `demo/components/*.tsx` doesn't import from
 * `editor/js/*.ts` (see `demo/components/editor-app.tsx`'s
 * `requireEditorElement` doc comment), so this subscribes to
 * `window.__editorTabsState` (registered by `useEditorTabs`) instead.
 */
import { refreshAllColorUIs } from './config-panel.ts'

window.__editorTabsState.subscribe((panel) => {
  if (panel === 'config') refreshAllColorUIs()
})
