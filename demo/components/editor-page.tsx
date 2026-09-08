/** @jsxRuntime automatic */
/**
 * The live-editor page (editor.ts → editor.html) as React components.
 *
 * #423's pilot rendered only the document shell here and spliced the whole
 * `<body>` in as one raw HTML string, because editor/html/*.html weren't
 * component-shaped yet. #589 finished the port: the topbar and the two
 * panels are real components now
 * (demo/components/editor-topbar.tsx, demo/components/editor-panels.tsx),
 * `editor/html/` is gone, and the only thing still spliced in raw is the
 * inline `<script type="module">` carrying the bundled renderer plus every
 * editor/js/*.js module — which stays a separately bundled vanilla script
 * by design (see docs/decisions/react-site-migration-plan.md).
 *
 * The layout constraint that made this the hard page is preserved
 * structurally rather than by comment: `.topbar`, `.main`, and the toast are
 * direct children of `<body>` (whose `display: flex` column layout in
 * editor/css/variables.css depends on it), and `.panel-left`/`.panel-right`
 * are direct children of `.main`. No component here introduces a wrapper
 * element.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { ReactNode } from 'react'
import { SiteHead } from './site-head.tsx'
import { EditorTopbar } from './editor-topbar.tsx'
import { EditorLeftPanel, EditorRightPanel } from './editor-panels.tsx'

/**
 * Everything inside `<body>` except the inlined script: the topbar, the
 * two panels with the resize handle between them, and the toast.
 *
 * Exported so editor/__tests__/support/harness.ts can build its jsdom
 * document from the *same* component tree the generator ships, rather than
 * from a second, drifting copy of the markup (it used to read the
 * editor/html/*.html partials directly, which no longer exist).
 */
export function EditorChrome({ themeItems }: { themeItems: ReactNode }) {
  return (
    <>
      {/* Top bar */}
      <EditorTopbar themeItems={themeItems} />

      {/* Main */}
      <div className="main">
        {/* Left panel */}
        <EditorLeftPanel />

        {/* Resize handle */}
        <div className="resize-handle" id="resize-handle" />

        {/* Right panel */}
        <EditorRightPanel />
      </div>

      <div className="toast" id="toast" />
    </>
  )
}

export interface EditorPageProps {
  css: string
  /** The theme dropdown's entries (see editor.ts's `ThemeDropdownItems`). */
  themeItems: ReactNode
  /**
   * The bundled renderer plus every editor/js/*.js module, concatenated by
   * editor.ts exactly as before and inlined as one module script.
   */
  scriptJs: string
}

export function EditorPage({ css, themeItems, scriptJs }: EditorPageProps) {
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
      <body>
        <EditorChrome themeItems={themeItems} />

        {/* Bundled renderer */}
        <script
          type="module"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- this repo's own src/browser.ts bundle plus editor/js/*.js, both under version control and concatenated at build time; never live/runtime user input
          dangerouslySetInnerHTML={{ __html: scriptJs }}
        />
      </body>
    </html>
  )
}
