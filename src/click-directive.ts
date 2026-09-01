import type { NodeInteraction } from './types.ts'

// ============================================================================
// Shared `click` directive parsing and href sanitization.
//
// Every diagram type that recognizes Mermaid's `click` statement (flowchart/
// state via src/parser.ts, class diagrams via src/class/parser.ts) shares
// this exact grammar and the same href-safety rules — pulled out here so
// neither copy can drift from the other. See
// docs/decisions/no-script-interactivity.md for the tier model this
// implements: an `href` becomes a real `<a>` link (tier 2), a tooltip
// becomes a `<title>` (tier 1), and a `call`/`callback` binding is recorded
// as data but never executed (tier 3 stays unimplemented, permanently).
// ============================================================================

/**
 * Parse a `click <id> ...` statement and record the resulting
 * {@link NodeInteraction} in `interactions`, keyed by whatever id scheme the
 * caller's diagram type uses (flowchart/state node id, class diagram class
 * id, ...).
 *
 * Supported forms:
 *   click id "url" ["tooltip"] [_blank|_self|_parent|_top]
 *   click id href "url" ["tooltip"] [_blank|_self|_parent|_top]
 *   click id call fn() ["tooltip"]
 *   click id callback fn() ["tooltip"]
 *
 * A line that doesn't match `click <id> ...` at all is a no-op — callers are
 * expected to have already gated on a leading `click` keyword before calling
 * this (see the `/^click\s+/i` checks at each call site) purely so this
 * function's own regex can stay anchored to the id capture.
 */
export function applyClickStatement(
  line: string,
  interactions: Map<string, NodeInteraction>,
): void {
  const match = line.match(/^click\s+([\w\p{L}-]+)\s+(.*)$/iu)
  if (!match) return

  const nodeId = match[1]!
  let rest = match[2]!.trim()

  const interaction: NodeInteraction = { ...interactions.get(nodeId) }

  // `call fn()` / `callback fn()` — a script binding.
  const callMatch = rest.match(/^(?:call|callback)\s+(.+?)\s*$/i)
  if (callMatch) {
    // A trailing quoted tooltip may follow the callback expression.
    const withTooltip = callMatch[1]!.match(/^(.*?\))\s+"([^"]*)"\s*$/)
    if (withTooltip) {
      interaction.callback = withTooltip[1]!.trim()
      interaction.tooltip = withTooltip[2]
    } else {
      interaction.callback = callMatch[1]!.trim()
    }
    interactions.set(nodeId, interaction)
    return
  }

  // Optional explicit `href` keyword.
  rest = rest.replace(/^href\s+/i, '')

  // Remaining tokens: "url" ["tooltip"] [_target]
  const quoted = [...rest.matchAll(/"([^"]*)"/g)].map((m) => m[1]!)
  if (quoted.length > 0) interaction.href = quoted[0]
  if (quoted.length > 1) interaction.tooltip = quoted[1]

  const targetMatch = rest.match(/(_blank|_self|_parent|_top)\s*$/i)
  if (targetMatch) interaction.target = targetMatch[1]!.toLowerCase()

  if (interaction.href !== undefined || interaction.tooltip !== undefined) {
    interactions.set(nodeId, interaction)
  }
}

/**
 * Accept only link schemes that cannot execute script.
 *
 * A `click` target comes from diagram text, which may be untrusted. An
 * `href` of `javascript:...` (or a `data:` URL containing markup) would turn
 * a rendered diagram into an XSS vector for any page that inlines the SVG, so
 * anything but http/https/mailto and same-document or relative references is
 * dropped rather than emitted.
 *
 * C0 controls are rejected outright, before any other check. The URL parser
 * strips tab and newline from *anywhere* in a URL, so `java\tscript:` reaches
 * a browser as `javascript:` — while the scheme match below sees `java\t…`,
 * finds no scheme, and waves it through as a relative reference. Splitting a
 * blocked scheme with a control character is the whole bypass; there is no
 * legitimate URL with a raw control in it, so the entire range goes.
 */
export function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined

  if (/[\x00-\x1F\x7F]/.test(href)) return undefined

  const trimmed = href.trim()
  // Relative, absolute-path, and fragment references carry no scheme.
  if (/^[./#?]/.test(trimmed)) return trimmed

  const scheme = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)?.[1]
  if (scheme === undefined) return trimmed

  return /^(https?|mailto)$/i.test(scheme) ? trimmed : undefined
}
