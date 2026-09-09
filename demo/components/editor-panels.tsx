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
import type { ReactNode } from 'react'

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

/** One color row in the Config tab's Colors section. */
function ColorField({ label, cfg }: { label: string; cfg: string }) {
  return (
    <div className="color-field">
      <span className="color-field-label">{label}</span>
      <button className="color-edit-btn" data-cfg={cfg}>
        <span className="cfg-hex-label" id={`cfg-${cfg}-label`}>
          —
        </span>
        <span className="color-swatch" id={`cfg-${cfg}-swatch`} />
      </button>
    </div>
  )
}

/** One numeric setting in the Config tab's Layout section: field + slider. */
function PaddingField({
  label,
  id,
  min,
  max,
  step,
  value,
}: {
  label: string
  id: string
  min: string
  max: string
  step?: string
  value: string
}) {
  return (
    <div className="padding-field">
      <div className="padding-row">
        <label>{label}</label>
        <input
          className="padding-num"
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
        />
      </div>
      <input
        className="padding-slider"
        id={`${id}-slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
      />
    </div>
  )
}

/** The editor's left panel: the source textarea, Config tab, and popups. */
export function EditorLeftPanel() {
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
        {/*
          `dangerouslySetInnerHTML`, not plain JSX text -- as of
          zombie-mermaid#806, this element is inside EditorApp's hydrated
          tree, and `editor/js/editor-helpers.ts`'s `updateLineNumbers()`
          overwrites this exact textContent synchronously as soon as
          `editor/js/init.ts` sets the editor's initial source (before a
          real user has typed anything). A plain-JSX child there is
          diffed during hydration; `dangerouslySetInnerHTML` makes this
          node an opaque leaf React never compares, so that startup
          mutation can never race a hydration-mismatch check -- caught for
          real in a browser during #806's development (a live SVG
          preview, not just this counter, mismatched the same way; see
          the preview-inner div below for that one). Content is otherwise
          unchanged: still the literal "1" a fresh, empty editor starts
          with.
        */}
        <div
          className="line-numbers"
          id="line-numbers"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- a fixed literal ("1"), never user input; see the comment above for why this needs to be an opaque hydration leaf
          dangerouslySetInnerHTML={{ __html: '1' }}
        />
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

      {/* Config view */}
      <div className="config-panel" id="config-view">
        {/* Colors section */}
        <div className="config-section">
          <div className="config-section-title">Colors</div>
          <ColorField label="Background" cfg="bg" />
          <ColorField label="Foreground" cfg="fg" />
          <ColorField label="Accent" cfg="accent" />
          <ColorField label="Line" cfg="line" />
          <ColorField label="Muted" cfg="muted" />
          <ColorField label="Surface" cfg="surface" />
        </div>

        {/* Font section */}
        <div className="config-section">
          <div className="config-section-title">Typography</div>
          <div className="font-field">
            <span className="font-field-label">Font family</span>
            <button className="font-select-btn" id="font-select-btn">
              <span id="font-select-label">Default</span>
              <span className="font-select-caret">▼</span>
            </button>
          </div>
        </div>

        {/* Layout section */}
        <div className="config-section">
          <div className="config-section-title">Layout</div>
          <PaddingField
            label="Padding"
            id="cfg-padding"
            min="0"
            max="120"
            value="24"
          />
          <PaddingField
            label="Edge stroke"
            id="cfg-edge-stroke"
            min="0.25"
            max="6"
            step="0.25"
            value="1"
          />
          <PaddingField
            label="Node border"
            id="cfg-node-stroke"
            min="0.25"
            max="6"
            step="0.25"
            value="1"
          />
        </div>
      </div>

      {/* Color picker popup (shared) */}
      <div className="color-popup" id="color-popup">
        <div className="color-popup-header">
          <span className="color-popup-title" id="color-popup-title">
            Color
          </span>
          <button className="color-popup-close" id="color-popup-close">
            ×
          </button>
        </div>
        <div className="color-hex-row">
          <input
            type="color"
            className="color-native"
            id="color-native-input"
          />
          <input
            type="text"
            className="color-hex-input"
            id="color-hex-input"
            placeholder="#rrggbb"
            maxLength={9}
          />
          <button className="color-clear-btn" id="color-clear-btn">
            Clear
          </button>
        </div>
        <div className="color-palette-title">Presets</div>
        <div className="color-palette" id="color-palette" />
      </div>

      {/* Font picker popup */}
      <div className="font-popup" id="font-popup">
        <div className="font-search-wrap">
          <StrokeIcon className="font-search-icon" width="13" height="13">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </StrokeIcon>
          <input
            className="font-search"
            id="font-search"
            placeholder="Quick search"
          />
        </div>
        <div className="font-list" id="font-list" />
      </div>

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
        {/*
          `dangerouslySetInnerHTML`, not plain JSX children -- see
          `#line-numbers`'s identical comment above for the general
          reasoning; this element is the one that actually surfaced the
          real hydration-mismatch error during #806's development.
          `editor/js/init.ts` calls `scheduleRender(0)` on page load
          (rendering `DEFAULT_SOURCE` or a shared URL hash's diagram), and
          `editor/js/rendering.ts`'s `doRender()` replaces this node's
          entire innerHTML with the rendered SVG well before a real user
          has interacted with anything -- a plain-JSX placeholder child
          here gets diffed during hydration and can lose that race.
        */}
        <div
          className="preview-inner"
          id="preview-inner"
          // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- a fixed literal placeholder, never user input; see the comment above for why this needs to be an opaque hydration leaf
          dangerouslySetInnerHTML={{
            __html:
              '<div class="preview-placeholder" id="preview-placeholder">Start typing to render your diagram</div>',
          }}
        />
      </div>

      <div className="preview-footer">
        <span id="render-time" />
        <span>zombie-mermaid</span>
      </div>
    </div>
  )
}
