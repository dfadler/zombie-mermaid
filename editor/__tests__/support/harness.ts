// Test harness for the live editor's vanilla-JS modules (editor/js/*.js).
//
// The editor is NOT written as ES modules — editor.ts concatenates the files
// in editor/js/ in a fixed order and inlines them into a single <script
// type="module"> in the generated editor.html, relying on `var`/`function`
// declarations sharing one top-level scope across file boundaries.
//
// To exercise the *real* source files (rather than reimplementing their
// logic in test-only copies), this harness builds a jsdom document using the
// actual HTML partials from editor/html/, stubs the handful of browser APIs
// jsdom doesn't implement, and evaluates the real js/*.js files against that
// document in the same order editor.ts bundles them in. Tests then interact
// with the resulting `window` exactly like a user/script would in a browser.
//
// NOTE: JS_FILES below must be kept in sync with the `order` array in
// readJsFiles() in editor.ts. It's duplicated here (rather than imported)
// because editor.ts performs side effects (esbuild bundling + writing
// editor.html) as soon as it's imported.
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { vi } from 'vitest'
import { THEMES } from '../../../src/theme.ts'

const EDITOR_DIR = new URL('../../', import.meta.url)

const JS_FILES = [
  'js/helpers.js',
  'js/state.js',
  'js/elements.js',
  'js/sharing.js',
  'js/rendering.js',
  'js/zoom.js',
  'js/pan.js',
  'js/editor-helpers.js',
  'js/config-panel.js',
  'js/color-picker.js',
  'js/font-picker.js',
  'js/tabs.js',
  'js/buttons.js',
  'js/export.js',
  'js/resize.js',
  'js/toast.js',
  'js/dark-mode.js',
  'js/init.js',
]

function readEditorFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, EDITOR_DIR), 'utf-8')
}

function buildThemeItems(): string {
  return [
    `<button class="theme-dropdown-item active" data-theme="">Default</button>`,
    ...Object.keys(THEMES).map(
      (key) =>
        `<button class="theme-dropdown-item" data-theme="${key}">${key}</button>`,
    ),
  ].join('\n')
}

function buildBodyHtml(): string {
  const topbar = readEditorFile('html/topbar.html').replace(
    '{{THEME_ITEMS}}',
    buildThemeItems(),
  )
  const leftPanel = readEditorFile('html/left-panel.html')
  const rightPanel = readEditorFile('html/right-panel.html')
  // Mirrors the shell editor.ts wraps the partials in (see generateEditorHtml).
  return `
${topbar}
<div class="main">
${leftPanel}
<div class="resize-handle" id="resize-handle"></div>
${rightPanel}
</div>
<div class="toast" id="toast"></div>
`
}

export interface EditorEnv {
  window: InstanceType<typeof JSDOM>['window']
  document: Document
  renderMermaidSVGAsync: ReturnType<typeof vi.fn>
}

export interface CreateEditorEnvOptions {
  /** Override the mocked renderer. Defaults to resolving a canned SVG string. */
  renderImpl?: (
    source: string,
    options: Record<string, unknown>,
  ) => Promise<string>
}

/**
 * Builds a fresh jsdom environment with the real editor/js/*.js files loaded
 * against the real editor/html/*.html partials, and a mocked
 * window.__mermaid.renderMermaidSVGAsync (the one DOM-external dependency
 * the editor scripts pull in from the bundled renderer).
 */
export function createEditorEnv(
  options: CreateEditorEnvOptions = {},
): EditorEnv {
  const dom = new JSDOM(
    `<!doctype html><html><body>${buildBodyHtml()}</body></html>`,
    {
      url: 'https://editor.example/editor.html',
      runScripts: 'outside-only',
    },
  )
  const { window } = dom

  // jsdom doesn't implement the Blob object URL registry or the Clipboard API.
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  window.URL.revokeObjectURL = vi.fn()
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(() => Promise.resolve()),
      write: vi.fn(() => Promise.resolve()),
    },
  })

  const renderMermaidSVGAsync = vi.fn(
    options.renderImpl ?? (async () => '<svg data-mock-render="1"></svg>'),
  )
  ;(window as unknown as { __mermaid: unknown }).__mermaid = {
    THEMES,
    renderMermaidSVGAsync,
  }

  for (const file of JS_FILES) {
    window.eval(readEditorFile(file))
  }

  return { window, document: window.document, renderMermaidSVGAsync }
}

/** Waits for the debounced/scheduled render (setTimeout-based) to settle. */
export function flushRenderTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20))
}
