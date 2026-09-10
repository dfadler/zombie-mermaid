/** @jsxRuntime automatic */
/**
 * The live editor's two panels — the source/config panel (was
 * editor/html/left-panel.html) and the preview panel (was
 * editor/html/right-panel.html) — as React components.
 *
 * Part of #589, finishing what #423's prototype deferred. Each panel keeps
 * `.panel-left` / `.panel-right` as its single root element: they are direct
 * flex children of `.main` (editor/css/variables.css), so an extra wrapper
 * would become the flex item instead and visibly break the layout. That is
 * the exact hazard docs/decisions/react-site-migration-plan.md recorded for
 * this page, and why the fragments had to become real components rather than
 * per-fragment `dangerouslySetInnerHTML` splices.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json.
 */
import type { Dispatch, ReactNode } from 'react'
import { ConfigPanel } from './editor-config.tsx'
import type { EditorAction, EditorState } from './editor-app.tsx'

/** The stroke-style icon shape shared by both panels' toolbar buttons. */
function StrokeIcon({
  children,
  className,
  width,
  height,
}: {
  children: ReactNode
  className?: string
  width?: string
  height?: string
}) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export interface EditorLeftPanelProps {
  /**
   * Threaded from `<EditorApp>`'s own body (via `EditorChromeMarkup`), not
   * read through `EditorStateContext`/`EditorDispatchContext` here --
   * `editor-config.tsx`'s `ConfigPanel` (rendered below, zombie-mermaid#808)
   * needs both, and this file already gets imported *by* `editor-app.tsx`
   * (for `EditorLeftPanel`/`EditorRightPanel` themselves), so importing
   * `useEditorState`/`useEditorDispatch` back from there would be a real
   * runtime circular import, not just a type-level one -- plain props avoid
   * it entirely, the same tradeoff `editor-app.tsx`'s own header comment
   * describes for why {@link useEditorRefs} doesn't thread through props
   * either (there, nothing consumed it yet; here, `ConfigPanel` does, so
   * threading is the smaller change).
   */
  state: EditorState
  dispatch: Dispatch<EditorAction>
}

/** The editor's left panel: the source textarea, Config tab, and popups. */
export function EditorLeftPanel({ state, dispatch }: EditorLeftPanelProps) {
  return (
    <div className="panel-left" id="panel-left">
      {/* Source toolbar — floating label + actions */}
      <div className="source-toolbar" id="source-toolbar">
        <span className="source-label">Source</span>
        <div className="toolbar-spacer" />
        <div className="source-actions">
          <button
            className="toolbar-btn"
            id="copy-source-btn"
            title="Copy source"
          >
            <StrokeIcon>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </StrokeIcon>
          </button>
          <button className="toolbar-btn" id="clear-btn" title="Clear editor">
            <StrokeIcon>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </StrokeIcon>
          </button>
        </div>
      </div>

      {/* Code editor view */}
      <div className="editor-wrap" id="editor-view">
        <div className="line-numbers" id="line-numbers">
          1
        </div>
        <textarea
          className="code-editor"
          id="code-editor"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Enter mermaid diagram syntax here…"
          defaultValue=""
        />
      </div>

      {/* Config view, color popup, and font popup -- zombie-mermaid#808,
          all three now one live React component (editor-config.tsx's
          ConfigPanel) instead of static markup wired up imperatively by
          editor/js/config-panel.ts/color-picker.ts/font-picker.ts. */}
      <ConfigPanel state={state} dispatch={dispatch} />

      <div className="status-bar">
        <div className="status-left">
          <span className="status-dot" id="status-dot" />
          <span id="status-text">Ready</span>
        </div>
        <div className="status-right">
          <span id="cursor-pos">Ln 1, Col 1</span>
        </div>
      </div>
    </div>
  )
}

/** The editor's right panel: zoom/pan toolbar and the live preview. */
export function EditorRightPanel() {
  return (
    <div className="panel-right" id="panel-right">
      <div className="preview-toolbar">
        <span className="preview-label">Preview</span>
        <div className="toolbar-spacer" />
        <div className="zoom-controls">
          <button className="toolbar-btn" id="zoom-out-btn" title="Zoom out">
            <StrokeIcon>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </StrokeIcon>
          </button>
          <span className="zoom-label" id="zoom-label">
            100%
          </span>
          <button className="toolbar-btn" id="zoom-in-btn" title="Zoom in">
            <StrokeIcon>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </StrokeIcon>
          </button>
          <button className="toolbar-btn" id="zoom-fit-btn" title="Fit to view">
            <StrokeIcon>
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </StrokeIcon>
          </button>
          <button
            className="toolbar-btn"
            id="pan-btn"
            title="Pan (hold to drag)"
          >
            <StrokeIcon>
              <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
              <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
              <path d="M10 10.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1.5" />
              <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2a8 8 0 0 1-7.4-5" />
              <path d="M6 14v-3a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5" />
            </StrokeIcon>
          </button>
        </div>
      </div>

      <div className="preview-body" id="preview-body">
        <div className="render-spinner" id="render-spinner" />
        <div className="preview-inner" id="preview-inner">
          <div className="preview-placeholder" id="preview-placeholder">
            Start typing to render your diagram
          </div>
        </div>
      </div>

      <div className="preview-footer">
        <span id="render-time" />
        <span>ZombieMermaid</span>
      </div>
    </div>
  )
}
