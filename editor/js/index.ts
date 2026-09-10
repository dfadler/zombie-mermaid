/**
 * Entry point for the live editor's client-side bundle.
 *
 * This is the real-imports replacement for the fixed-order concatenation
 * `editor.ts`'s `readJsFiles()` used to perform by hand (zombie-mermaid#766,
 * following up on #744's documentation-only pass over the same load-order
 * graph). Every module below still runs its own top-level side effects
 * (DOM lookups and `addEventListener` registration) exactly as it did when
 * concatenated by hand -- the only thing that changed is that each file now
 * says what it needs via `import`, instead of relying on a hand-maintained
 * order array and implicit global scope. `tsc`/ESLint can now verify the
 * graph statically; a wrong reorder here is a compile error, not a
 * `ReferenceError` at runtime.
 *
 * zombie-mermaid#807/#808/#809 removed zoom.ts/pan.ts/resize.ts,
 * config-panel.ts/color-picker.ts/font-picker.ts, and
 * buttons.ts/export.ts/toast.ts/tabs.ts from this list -- that state and
 * DOM wiring now lives in React (demo/components/editor-viewport.ts,
 * editor-config.tsx, editor-buttons.ts, editor-export.ts, editor-toast.ts,
 * editor-tabs.ts). zombie-mermaid#810 -- the last editor sub-issue --
 * removed everything else except `elements.ts`/`editor-helpers.ts`:
 * `helpers.ts`, `state.ts`, `sharing.ts`, `rendering.ts`, `theme-button.ts`,
 * and `dark-mode.ts` are all gone, moved to React
 * (demo/components/editor-sharing.ts, editor-rendering.ts, editor-theme.ts)
 * or (`helpers.ts`) deleted outright once its last caller
 * (`rendering.ts`) went with it. `editor/js/*.ts` is now just the two
 * files React genuinely can't absorb -- the code-editor textarea's own
 * `input`/`keydown`/`keyup`/`scroll` wiring has no React state to drive it
 * (see `editor-rendering.ts`'s header comment for why) -- rather than a
 * parallel program shadowing most of `<EditorApp>`'s own concerns.
 */
import './elements.ts'
import './editor-helpers.ts'
