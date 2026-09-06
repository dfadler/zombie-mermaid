/**
 * Renders a page's root React element (an `<html>` element) to the
 * complete static document a generator writes to disk.
 *
 * `renderToStaticMarkup`, not `renderToString`: these pages are never
 * hydrated — every generator emits self-contained HTML that the static
 * site and the dev server serve as-is, and any interactivity comes from a
 * separately bundled vanilla script (see vite.config.ts's header). Static
 * markup also omits the `<!-- -->` text-boundary comments and `data-react*`
 * attributes hydration would need, keeping the output equivalent to the
 * hand-written template it replaces. It does not emit the doctype, hence
 * the prefix here.
 */
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

export function renderHtmlDocument(page: ReactElement): string {
  return `<!DOCTYPE html>\n${renderToStaticMarkup(page)}`
}
