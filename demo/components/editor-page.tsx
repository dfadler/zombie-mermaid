/** @jsxRuntime automatic */
/**
 * The live-editor page (editor.ts → editor.html) as a React component —
 * step two of the #423 site-generator migration, after the dashboard.ts
 * pilot (demo/components/dashboard-page.tsx). See
 * docs/decisions/react-site-migration-plan.md for the full plan this
 * belongs to.
 *
 * Unlike dashboard.ts, editor.ts's content isn't component-shaped yet:
 * editor/html/{topbar,left-panel,right-panel}.html are hand-written markup
 * fragments (each a single root element, styled by body's `display: flex`
 * layout in editor/css/variables.css — wrapping any one of them in an
 * extra JSX container element would insert an unstyled flex item and
 * visibly break the panel layout), and the browser bundle plus every
 * editor/js/*.js module are spliced into one inline
 * `<script type="module">` verbatim. Turning every one of those into a
 * real JSX tree (each fragment its own component, the bundled script as a
 * `<script dangerouslySetInnerHTML>` element) is real, separate work —
 * out of scope for this pilot step, and tracked as the specific
 * remaining risk in the migration plan doc referenced above.
 *
 * What this component *does* prove: the document shell (doctype, `<head>`,
 * `SiteHead` reuse, the two favicon links `SiteHead` doesn't cover) renders
 * through `renderToStaticMarkup`, and the body's entire existing raw
 * content — including the inlined `<script type="module">` tag carrying
 * the bundled renderer JS — survives a `dangerouslySetInnerHTML` round
 * trip unescaped and byte-identical. That is the specific risk this page
 * was chosen to derisk (see the plan's "risks the dashboard pilot didn't
 * have to solve" section): raw script content spliced into
 * React-rendered output, not just static data-driven markup dashboard.ts
 * already proved out.
 *
 * `bodyHtml` is built by the caller (editor.ts) using the *exact* same
 * template-literal assembly the pre-React generator used for its `<body>`
 * region, deliberately unchanged — so the only thing this component
 * changes is how the surrounding document is produced, not what is inside
 * the body. `__tests__/editor-equivalence.test.ts` proves the full
 * document is unchanged (modulo DOM-normalisation) against the pre-React
 * generator's real output.
 */
import { SiteHead } from './site-head.tsx'

export interface EditorPageProps {
  css: string
  /**
   * The pre-existing `<body>...</body>` inner content, assembled by
   * editor.ts exactly as the pre-React generator assembled it (topbar +
   * main panels + toast + the inlined bundle script). Spliced in raw
   * because it is not yet component-shaped — see the file header.
   */
  bodyHtml: string
}

export function EditorPage({ css, bodyHtml }: EditorPageProps) {
  return (
    <html lang="en">
      <head>
        <SiteHead title="zombie-mermaid — Live Editor" css={css} />
        {/* SiteHead only emits the SVG favicon (first shaped around
            dashboard.ts, which needs nothing else). The original template
            also links a .ico fallback and an apple-touch-icon; kept here as
            siblings rather than growing SiteHead's props for one consumer. */}
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
      </head>
      <body dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </html>
  )
}
