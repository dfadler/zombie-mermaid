/** @jsxRuntime automatic */
/**
 * `<EditorApp>`'s hydration island (zombie-mermaid#806): `editor-page.tsx`
 * renders {@link EditorAppIsland} in place of the old bare
 * `<EditorChrome themeItems={...} />`, and gets back both the
 * pre-rendered markup React needs a stable container for, and the
 * `<script type="application/json">` `demo/editor-client.tsx` reads on the
 * client to re-render the *same* `<EditorApp>` tree via `hydrateRoot()`.
 * Mirrors `demo/components/nav-island.tsx`/`dashboard-page.tsx`'s
 * identical pattern (see either's header comment for the full rationale).
 *
 * Server-only: this file imports `react-dom/server`, so — exactly like
 * `nav-island.tsx` — nothing that ends up in a browser bundle may import
 * *this* file. `demo/editor-client.tsx` imports `EditorApp` and the id
 * constants directly from `editor-app.tsx` instead, never from here.
 *
 * The `renderToString`-into-`dangerouslySetInnerHTML` splice (not plain
 * JSX nesting) is required for the same reason `nav-island.tsx`/
 * `dashboard-page.tsx` need it: `editor-page.tsx`'s outer document still
 * goes through `render-html.ts`'s `renderToStaticMarkup`, which never
 * emits the `<!-- -->` text-boundary comments `hydrateRoot()` needs.
 * `renderToString`, called here just for this island, produces them.
 */
import { renderToString } from 'react-dom/server'
import {
  EDITOR_PROPS_ELEMENT_ID,
  EDITOR_ROOT_ID,
  EditorApp,
  type EditorAppProps,
} from './editor-app.tsx'
import { escapeJsonForScriptTag } from '../format.ts'

/**
 * Renders `<EditorApp>` as a hydratable island: the pre-rendered markup
 * inside {@link EDITOR_ROOT_ID}, plus the {@link EDITOR_PROPS_ELEMENT_ID}
 * JSON blob `demo/editor-client.tsx`'s hydration entry reads to hydrate it.
 * `themes` is already a plain, JSON-serializable array (see
 * `editor.ts`'s `generateEditorHtml()`), so it round-trips through
 * `JSON.stringify`/`JSON.parse` with no reconstruction step needed on the
 * client (unlike `NavIsland`'s `installSlot`, which is a `ReactNode` and
 * needs one).
 */
export function EditorAppIsland({ themes }: EditorAppProps) {
  return (
    <>
      <div
        id={EDITOR_ROOT_ID}
        // display: contents -- this hydration container is real DOM (a
        // hydrateRoot() target needs a real node), but .editor-tool-shell
        // is display:flex;flex-direction:column and expects .topbar/.main/
        // .toast as its direct flex items (see editor-app.tsx's
        // EditorChromeMarkup doc comment: "No wrapper <div> is introduced
        // anywhere in this subtree"). Without this, the wrapper's own
        // display:block box sizes to its children's natural content
        // height instead of stretching, so .main's flex:1 has no effect
        // (flex properties only apply to a flex container's *direct*
        // children) -- confirmed via getBoundingClientRect while building
        // the fullscreen toggle: harmless in the normal card (a ~32px gap
        // hidden by overflow:hidden and no bottom-of-card content nearby),
        // but glaring once .editor-tool-shell:fullscreen makes the card
        // fill the whole viewport instead of ~720px (a ~200px dead band
        // below the status bar). display: contents removes this element's
        // own box while keeping it in the DOM, exactly the same fix
        // editor-page.tsx already uses for .zm-shell's sticky-nav wrapper.
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this page's own EditorApp component tree rendered via renderToString (see the module doc comment); never user input
          __html: renderToString(<EditorApp themes={themes} />),
        }}
      />
      <script
        type="application/json"
        id={EDITOR_PROPS_ELEMENT_ID}
        dangerouslySetInnerHTML={{
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- build-time JSON from this page's own EditorAppProps, escaped with escapeJsonForScriptTag; never user input
          __html: escapeJsonForScriptTag(
            JSON.stringify({ themes } satisfies EditorAppProps),
          ),
        }}
      />
    </>
  )
}
