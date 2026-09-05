/**
 * HTML/JSON-LD helpers shared by the demo generators.
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

/**
 * Make a JSON payload safe to embed in a `<script>` element.
 *
 * An HTML parser ends a script element at the first `</script`, wherever it
 * appears — including inside a JSON string. A sample whose Mermaid source
 * contained that sequence would truncate the page. JSON.stringify does not
 * escape `<`, so the sequence is broken up here.
 */
export function escapeJsonForScriptTag(json: string): string {
  return json.replace(/<\/(script)/gi, '<\\/$1')
}

/** The subset of package.json fields {@link buildSoftwareApplicationJsonLd} reads. */
export interface SoftwareApplicationPackageInfo {
  description: string
  version: string
  license: string
  repository: { url: string }
}

/**
 * Build the `SoftwareApplication` JSON-LD object for the demo site's `<head>`.
 *
 * Values are pulled from package.json rather than hardcoded so the block
 * can't drift from the published package (name/description/version/license
 * all come from there; `sameAs`/`license` are derived from the repository
 * URL). Deliberately omits `aggregateRating`/`review`/`offers` — Google's
 * Software App rich-result eligibility requires one of those, but this repo
 * has no real ratings or reviews to report, and fabricating one would be a
 * Search Console webspam violation. This block is valid, accurate structured
 * data; it just won't win the rich-result carousel on its own.
 *
 * Pure and synchronous — the caller is responsible for reading package.json
 * (see `buildJsonLd` in index.ts), which keeps this half testable without
 * touching the filesystem.
 */
export function buildSoftwareApplicationJsonLd(
  pkg: SoftwareApplicationPackageInfo,
): Record<string, unknown> {
  const repositoryUrl = pkg.repository.url

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Zombie Mermaid',
    description: pkg.description,
    softwareVersion: pkg.version,
    applicationCategory: 'DeveloperApplication',
    license: `${repositoryUrl}/blob/main/LICENSE`,
    url: 'https://dfadler.github.io/zombie-mermaid/',
    sameAs: repositoryUrl,
  }
}
