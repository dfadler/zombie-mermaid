/**
 * HTML text helpers shared by the demo generators.
 *
 * Extracted from index.ts so they can be tested directly: index.ts writes its
 * output at module scope, so importing it from a test would run the whole
 * generator.
 */

/** Escape text for safe interpolation into HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Convert markdown-style backtick spans in description text to <code> tags.
 *
 * The text is escaped *first*, then the backtick spans become real tags.
 * Descriptions are prose about a renderer, so they quote markup — `<a href>`,
 * `<title>`, `<polyline class="edge">`. Emitting those unescaped injected real
 * elements into the page.
 *
 * `<title>` in body position is catastrophic rather than merely untidy: the
 * HTML parser switches to text mode and swallows the rest of the document,
 * including the module script that boots the gallery. The page then shows a
 * permanent loading spinner, with nothing in the console to explain it — the
 * script was never parsed, so it never ran and never threw.
 */
export function formatDescription(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}
