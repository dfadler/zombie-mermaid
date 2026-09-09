/**
 * Entry point for the live editor's client-side bundle.
 *
 * This is the real-imports replacement for the fixed-order concatenation
 * `editor.ts`'s `readJsFiles()` used to perform by hand (zombie-mermaid#766,
 * following up on #744's documentation-only pass over the same load-order
 * graph). Every module below still runs its own top-level side effects
 * (DOM lookups, `addEventListener` registration, and a few immediate calls
 * like config-panel.ts's `refreshAllColorUIs()`) exactly as it did when
 * concatenated by hand -- the only thing that changed is that each file now
 * says what it needs via `import`, instead of relying on a hand-maintained
 * order array and implicit global scope. `tsc`/ESLint can now verify the
 * graph statically; a wrong reorder here is a compile error, not a
 * `ReferenceError` at runtime.
 *
 * These imports are ordered to match the original `order` array for ease
 * of comparison, but (unlike the old concatenation) the order here no
 * longer has any runtime significance for cross-module references --
 * each file's actual dependencies are its own `import` statements, which
 * ES module evaluation order (and this program's circular-import handling;
 * see theme-button.ts's header comment) already resolves correctly
 * regardless of this list's sequence. Only side-effect-only imports below need to run
 * at all -- most of them are also depended on directly by name elsewhere in
 * the graph, so this list mainly exists to guarantee every module (even
 * one nothing else imports for its exports) is actually included in the
 * bundle.
 */
import './helpers.ts'
import './state.ts'
import './elements.ts'
import './sharing.ts'
import './rendering.ts'
import './editor-helpers.ts'
import './config-panel.ts'
import './color-picker.ts'
import './font-picker.ts'
// zombie-mermaid#809: buttons.ts/export.ts/toast.ts moved to React state
// entirely (demo/components/editor-buttons.ts, editor-export.ts,
// editor-toast.ts) and no longer exist as editor/js/*.ts modules -- see
// tabs.ts's and dark-mode.ts's own header comments for why those two are
// still imported below, just much smaller than before.
import './tabs.ts'
import './theme-button.ts'
import './dark-mode.ts'
import './init.ts'
