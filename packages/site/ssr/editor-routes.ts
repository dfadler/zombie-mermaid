/**
 * editor.html — the live editor (ported from the former packages/site/editor.ts;
 * see its history for the rationale of the three-script layout below).
 *
 * The three scripts MUST stay in this order: `editorClientScript` hydrates
 * `<EditorApp>` against pristine server-rendered markup before `appJs`'s legacy
 * `init.ts` mutates DOM inside that hydration boundary (initial textarea value,
 * line numbers, dark-mode icon state, first render). All three are
 * `type="module"`, so document order is execution order; EditorPage renders
 * them in exactly the order given here. See demo/components/editor-page.tsx
 * and demo/editor-client.tsx. Sourced from the repo by relative path rather than
 * the published package, deliberately (docs/decisions/editor-in-repo-module.md).
 */
import { readFile } from 'node:fs/promises'
import { createElement } from 'react'
import { THEMES } from '@zombie-mermaid/core'
import { EditorPage } from '../../../demo/components/editor-page.tsx'
import type { EditorThemeItem } from '../../../demo/components/editor-topbar.tsx'
import { chromeThemeColorsScript } from '../../../demo/chrome-theme-data.ts'
import { renderHtmlDocument } from '../../../demo/render-html.ts'
import { THEME_LABELS } from '../../../demo/theme-labels.ts'
import type { Clients, Routes } from './shared.ts'

const CSS_ORDER = [
  'variables',
  'topbar',
  'panels',
  'code-editor',
  'preview',
  'config-panel',
  'color-picker',
  'font-picker',
  'export',
  'misc',
]

export async function editorRoutes(c: Clients, out: Routes): Promise<void> {
  const css = (
    await Promise.all(
      CSS_ORDER.map((f) =>
        readFile(new URL(`../../../editor/css/${f}.css`, import.meta.url), 'utf-8'),
      ),
    )
  ).join('\n\n')

  const themes: EditorThemeItem[] = Object.keys(THEMES).map((key) => ({
    key,
    bg: THEMES[key]!.bg,
    label: THEME_LABELS[key] ?? key,
  }))

  // window.__themeColors: the bg/fg table editor-client.tsx's initChromeTheme()
  // needs to re-theme Nav/Footer/the hero. Other pages get it from
  // ThemePickerSection; the editor's theme control lives in EditorTopbar, so it
  // is embedded here ahead of the renderer bundle.
  out.set(
    'editor.html',
    renderHtmlDocument(
      createElement(EditorPage, {
        css,
        themes,
        rendererSetupJs: `${chromeThemeColorsScript()}\n\n${c['editor-browser']!}\n`,
        editorClientScript: c['editor-client']!,
        appJs: c['editor-app']!,
      }),
    ),
  )
}
