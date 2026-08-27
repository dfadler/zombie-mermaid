// ============================================================================
// zombie-mermaid — %%{init: ...}%% configuration directives
//
// Mermaid lets a diagram carry its own configuration inline:
//
//   %%{init: {"theme": "dark", "flowchart": {"curve": "basis"}}}%%
//   flowchart TD
//     A --> B
//
// The payload is JSON-ish: Mermaid accepts unquoted keys and single quotes,
// which strict JSON.parse rejects, so it is normalized before parsing.
//
// A directive only ever *supplies defaults*. Explicit render options passed
// by the caller win, because the caller is closer to the user's intent than
// text embedded in a diagram — and because a diagram from an untrusted source
// should not be able to override the host application's rendering choices.
// ============================================================================

import type { RenderOptions } from './types.ts'

/** How an edge path is interpolated between its routed points. */
export type CurveStyle =
  'linear' | 'basis' | 'natural' | 'step' | 'stepBefore' | 'stepAfter'

const CURVE_STYLES = new Set<CurveStyle>([
  'linear',
  'basis',
  'natural',
  'step',
  'stepBefore',
  'stepAfter',
])

/** Configuration a diagram can set for itself via `%%{init: ...}%%`. */
export interface InitConfig {
  theme?: string
  /** Flowchart edge interpolation. */
  curve?: CurveStyle
  /** Recognized but not acted on — see `IGNORED_KEYS`. */
  ignored: string[]
}

/**
 * Directive keys that are parsed and deliberately not acted on, with the
 * reason. Reported on the result so a caller can surface them rather than
 * having the setting vanish silently.
 */
const IGNORED_KEYS: Record<string, string> = {
  securitylevel:
    'this renderer emits static SVG and never executes diagram-supplied script, so there is no sandbox to configure',
  defaultrenderer:
    'ELK is the only layout engine; dagre/elk selection has no effect',
  fontfamily: 'use the `font` render option instead',
  htmllabels:
    'labels are always rendered as SVG text; there is no HTML label mode',
  maxtextsize: 'no text-size limit is enforced',
  startonload: 'not a browser auto-render integration',
}

/**
 * Matches a `%%{init: ... }%%` or `%%{initialize: ... }%%` directive.
 *
 * The body is captured lazily up to the closing `}%%` so a directive sharing
 * a line with other content does not swallow it.
 */
const INIT_DIRECTIVE = /^\s*%%\{\s*(?:init|initialize)\s*:\s*([\s\S]*?)\}%%/i

/** True if `line` is an init directive. */
export function isInitDirective(line: string): boolean {
  return INIT_DIRECTIVE.test(line)
}

/**
 * Turn Mermaid's relaxed JSON into strict JSON.
 *
 * Mermaid accepts `{theme: 'dark'}`; JSON.parse does not. Quoting is applied
 * only outside string literals so a value containing a colon, a brace, or an
 * apostrophe survives intact.
 */
function normalizeRelaxedJson(text: string): string {
  let out = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!

    if (quote !== null) {
      if (ch === '\\' && i + 1 < text.length) {
        /*
         * Consume the escape and its target together. Without this, the
         * backslash is emitted bare and the quote it protects reads as the
         * end of the string — so strict, valid JSON like {"theme": "a\"b"}
         * re-emits unbalanced and the whole directive is dropped.
         *
         * JSON has no \' escape, so a single-quoted string's \' becomes a
         * bare apostrophe. Every other escape passes through untouched.
         */
        const next = text[i + 1]!
        out += next === "'" ? "'" : `\\${next}`
        i++
      } else if (ch === quote) {
        quote = null
        out += '"'
      } else if (ch === '"') {
        // A double quote inside a single-quoted string must be escaped once
        // the string is re-emitted with double quotes.
        out += '\\"'
      } else {
        out += ch
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      quote = ch
      out += '"'
      continue
    }

    // Bare key: an identifier run followed (after spaces) by a colon.
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < text.length && /[\w$-]/.test(text[j]!)) j++
      const word = text.slice(i, j)
      let k = j
      while (k < text.length && /\s/.test(text[k]!)) k++

      if (text[k] === ':') {
        out += `"${word}"`
        i = j - 1
        continue
      }

      // A bare word in value position — `true`, `false`, `null` are already
      // valid JSON; anything else is quoted so it parses as a string.
      out += /^(true|false|null)$/i.test(word)
        ? word.toLowerCase()
        : `"${word}"`
      i = j - 1
      continue
    }

    out += ch
  }

  return out
}

/**
 * Parse an init directive's payload.
 *
 * Returns `undefined` when the line is not a directive or its payload cannot
 * be parsed. A malformed directive is ignored rather than fatal: Mermaid
 * treats config as advisory, and failing an entire diagram over a stray brace
 * in a comment-like construct would be a poor trade.
 */
export function parseInitDirective(line: string): InitConfig | undefined {
  const match = line.match(INIT_DIRECTIVE)
  if (!match) return undefined

  let payload: unknown
  try {
    payload = JSON.parse(normalizeRelaxedJson(match[1]!))
  } catch {
    return undefined
  }

  if (typeof payload !== 'object' || payload === null) return undefined

  const config: InitConfig = { ignored: [] }
  const record: Record<string, unknown> = { ...payload }

  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase()

    if (lower === 'theme' && typeof value === 'string') {
      config.theme = value
      continue
    }

    if (lower === 'flowchart' && typeof value === 'object' && value !== null) {
      const flowchart: Record<string, unknown> = { ...value }
      for (const [fk, fv] of Object.entries(flowchart)) {
        if (fk.toLowerCase() === 'curve' && typeof fv === 'string') {
          if (CURVE_STYLES.has(fv as CurveStyle)) {
            config.curve = fv as CurveStyle
          }
          continue
        }
        if (fk.toLowerCase() in IGNORED_KEYS) config.ignored.push(fk)
      }
      continue
    }

    if (lower in IGNORED_KEYS) config.ignored.push(key)
  }

  return config
}

/**
 * Scan a whole diagram for init directives and merge them.
 *
 * Later directives win over earlier ones, matching Mermaid, where a second
 * directive overrides the first.
 */
export function extractInitConfig(lines: string[]): InitConfig {
  const merged: InitConfig = { ignored: [] }

  for (const line of lines) {
    const config = parseInitDirective(line)
    if (!config) continue
    if (config.theme !== undefined) merged.theme = config.theme
    if (config.curve !== undefined) merged.curve = config.curve
    merged.ignored.push(...config.ignored)
  }

  return merged
}

/**
 * Fold an init config into render options.
 *
 * Caller-supplied options always win: a directive supplies a default, never
 * an override. See the module header for why.
 */
export function applyInitConfig(
  options: RenderOptions,
  config: InitConfig,
): RenderOptions {
  if (config.curve === undefined || options.curve !== undefined) return options
  return { ...options, curve: config.curve }
}

/** Human-readable note about directive keys that were parsed but not applied. */
export function describeIgnored(config: InitConfig): string[] {
  return [...new Set(config.ignored)].map(
    (key) => `${key}: ${IGNORED_KEYS[key.toLowerCase()] ?? 'not supported'}`,
  )
}
