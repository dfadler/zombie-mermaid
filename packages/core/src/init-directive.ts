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

import { isValidCssColor } from './css-color.ts'
import type { RenderOptions } from './types.ts'

/** How an edge path is interpolated between its routed points. */
export type CurveStyle =
  | 'linear'
  | 'basis'
  | 'natural'
  | 'step'
  | 'stepBefore'
  | 'stepAfter'

const CURVE_STYLES = new Set<CurveStyle>([
  'linear',
  'basis',
  'natural',
  'step',
  'stepBefore',
  'stepAfter',
])

const PIE_LEGEND_POSITIONS = new Set([
  'left',
  'right',
  'top',
  'bottom',
  'center',
])

/**
 * The `themeVariables` subset this renderer can map onto its own colour
 * tokens (see `RenderOptions.honorThemeVariables`). Every value has passed
 * `isValidCssColor` and a stricter safe-character check; invalid ones are
 * dropped, never thrown.
 */
export interface ThemeVariables {
  /** → `surface` (node fill). Mermaid reads it under `theme: base` only. */
  primaryColor?: string
  /** → `border`. Mermaid reads it under `theme: base` only. */
  primaryBorderColor?: string
  /** → `fg`. Mermaid reads it under `theme: base` only. */
  primaryTextColor?: string
  /** → `line`. Mermaid reads it under every theme. */
  lineColor?: string
  /** `pie1`..`pie12` by slot (0..11). Mermaid reads them under every theme. */
  pieColors?: Record<number, string>
  /** The `quadrant*` colour variables by Mermaid's name. Read under every theme. */
  quadrant?: Partial<Record<QuadrantColorVariable, string>>
}

/** `quadrantChart` keys that take a number. */
const QUADRANT_NUMBER_KEYS = [
  'chartWidth',
  'chartHeight',
  'titleFontSize',
  'titlePadding',
  'quadrantPadding',
  'xAxisLabelPadding',
  'yAxisLabelPadding',
  'xAxisLabelFontSize',
  'yAxisLabelFontSize',
  'quadrantLabelFontSize',
  'quadrantTextTopPadding',
  'pointTextPadding',
  'pointLabelFontSize',
  'pointRadius',
  'quadrantInternalBorderStrokeWidth',
  'quadrantExternalBorderStrokeWidth',
] as const

/** The `quadrant*` theme variables Mermaid reads. */
const QUADRANT_COLOR_VARIABLES = [
  'quadrant1Fill',
  'quadrant2Fill',
  'quadrant3Fill',
  'quadrant4Fill',
  'quadrant1TextFill',
  'quadrant2TextFill',
  'quadrant3TextFill',
  'quadrant4TextFill',
  'quadrantPointFill',
  'quadrantPointTextFill',
  'quadrantXAxisTextFill',
  'quadrantYAxisTextFill',
  'quadrantTitleFill',
  'quadrantInternalBorderStrokeFill',
  'quadrantExternalBorderStrokeFill',
] as const

export type QuadrantColorVariable = (typeof QUADRANT_COLOR_VARIABLES)[number]

/** `quadrantChart` config a diagram can set (Mermaid's names and units). */
export type QuadrantConfig = Partial<
  Record<(typeof QUADRANT_NUMBER_KEYS)[number], number>
> & {
  xAxisPosition?: 'top' | 'bottom'
  yAxisPosition?: 'left' | 'right'
}

const BASE_ONLY_VARIABLES = [
  'primaryColor',
  'primaryBorderColor',
  'primaryTextColor',
] as const
const ANY_THEME_VARIABLES = ['lineColor'] as const
const PIE_VARIABLE = /^pie([1-9]|1[0-2])$/

/**
 * A directive colour comes from diagram text, which may be untrusted, and
 * lands in a `style` attribute: beyond `isValidCssColor`, allow only the
 * characters a colour literal needs and no `url()`/`var()`/`env()`/`calc()`.
 */
function directiveColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  return v.length <= 100 &&
    /^[#\w\s(),.%/+-]+$/.test(v) &&
    !/\b(?:url|var|env|calc)\s*\(/i.test(v) &&
    isValidCssColor(v)
    ? v
    : undefined
}

/** Configuration a diagram can set for itself via `%%{init: ...}%%`. */
export interface InitConfig {
  theme?: string
  /** Flowchart edge interpolation. */
  curve?: CurveStyle
  /** `pie.textPosition`: slice label distance as a fraction of the radius. */
  pieTextPosition?: number
  /** `pie.donutHole`: inner radius as a fraction of the radius. */
  pieDonutHole?: number
  /** `pie.legendPosition`; a value Mermaid does not know is stored as `right`. */
  pieLegendPosition?: 'left' | 'right' | 'top' | 'bottom' | 'center'
  /** `pie.highlightSlice`: label of the slice to emphasise. */
  pieHighlightSlice?: string
  /** The `quadrantChart` block; a bad or negative number, or unknown position, is dropped. */
  quadrant?: QuadrantConfig
  /**
   * `themeVariables` the renderer can map, applied only when the caller opts
   * in with `RenderOptions.honorThemeVariables`. `primaryColor`,
   * `primaryBorderColor` and `primaryTextColor` are present only when the
   * merged config says `theme: base`, as in Mermaid.
   */
  themeVariables?: ThemeVariables
  /** Recognized but not acted on — see `IGNORED_KEYS`. */
  ignored: string[]
}

/**
 * Directive keys that are parsed and deliberately not acted on, with the
 * reason. Reported on the result so a caller can surface them rather than
 * having the setting vanish silently.
 */
const IGNORED_KEYS: Record<string, string> = {
  theme:
    "colors come from the caller's bg/fg render options, which are usually CSS variables so a diagram inherits the host page's light/dark. A diagram-supplied theme would hard-code colors that fight it (it is read only as the `base` gate for themeVariables when `honorThemeVariables` is set). Mermaid's theme names (default/dark/forest/neutral) also have no equivalent in this renderer's palettes — pass `bg`/`fg`, or a THEMES entry, instead",
  securitylevel:
    'this renderer emits static SVG and never executes diagram-supplied script, so there is no sandbox to configure',
  defaultrenderer:
    'ELK is the only layout engine; dagre/elk selection has no effect',
  fontfamily: 'use the `font` render option instead',
  htmllabels:
    'labels are always rendered as SVG text; there is no HTML label mode',
  maxtextsize: 'no text-size limit is enforced',
  startonload: 'not a browser auto-render integration',
  themevariables:
    "only primaryColor, primaryBorderColor, primaryTextColor, lineColor, pie1..pie12 and the quadrant* colours are mapped, and only when the caller sets `honorThemeVariables`; every other variable (secondary/tertiary colours, fontFamily, background, per-diagram variables) is not read, and Mermaid's colours derived from primaryColor are not computed",
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
      /*
       * Kept on the result as metadata for a caller that wants to act on it,
       * but listed as ignored: it is parsed and deliberately not applied. See
       * IGNORED_KEYS for why.
       */
      config.theme = value
      config.ignored.push(key)
      continue
    }

    if (lower === 'themevariables' && typeof value === 'object' && value) {
      const tv: ThemeVariables = {}
      for (const [vk, vv] of Object.entries({ ...value })) {
        const color = directiveColor(vv)
        if ((QUADRANT_COLOR_VARIABLES as readonly string[]).includes(vk)) {
          if (color) (tv.quadrant ??= {})[vk as QuadrantColorVariable] = color
        } else if (PIE_VARIABLE.test(vk)) {
          if (color) (tv.pieColors ??= {})[Number(vk.slice(3)) - 1] = color
        } else if (
          (BASE_ONLY_VARIABLES as readonly string[]).includes(vk) ||
          (ANY_THEME_VARIABLES as readonly string[]).includes(vk)
        ) {
          if (color) tv[vk as 'lineColor'] = color
        } else {
          config.ignored.push(`${key}.${vk}`)
        }
      }
      config.themeVariables = tv
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

    if (
      lower === 'quadrantchart' &&
      typeof value === 'object' &&
      value !== null
    ) {
      const q: QuadrantConfig = {}
      const rec: Record<string, unknown> = { ...value }
      for (const k of QUADRANT_NUMBER_KEYS) {
        const v = rec[k]
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) q[k] = v
      }
      const x = rec.xAxisPosition
      if (x === 'top' || x === 'bottom') q.xAxisPosition = x
      const y = rec.yAxisPosition
      if (y === 'left' || y === 'right') q.yAxisPosition = y
      config.quadrant = q
      continue
    }

    if (lower === 'pie' && typeof value === 'object' && value !== null) {
      for (const [pk, pv] of Object.entries({ ...value })) {
        const pl = pk.toLowerCase()
        if (typeof pv === 'string') {
          if (pl === 'legendposition') {
            config.pieLegendPosition = PIE_LEGEND_POSITIONS.has(pv)
              ? (pv as InitConfig['pieLegendPosition'])
              : 'right'
          } else if (pl === 'highlightslice') config.pieHighlightSlice = pv
          continue
        }
        if (typeof pv !== 'number' || !Number.isFinite(pv)) continue
        if (pl === 'textposition') config.pieTextPosition = pv
        else if (pl === 'donuthole') config.pieDonutHole = pv
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
    if (config.pieTextPosition !== undefined) {
      merged.pieTextPosition = config.pieTextPosition
    }
    if (config.pieDonutHole !== undefined) {
      merged.pieDonutHole = config.pieDonutHole
    }
    if (config.pieLegendPosition !== undefined) {
      merged.pieLegendPosition = config.pieLegendPosition
    }
    if (config.pieHighlightSlice !== undefined) {
      merged.pieHighlightSlice = config.pieHighlightSlice
    }
    if (config.quadrant)
      merged.quadrant = { ...merged.quadrant, ...config.quadrant }
    if (config.themeVariables) {
      const { pieColors, quadrant, ...rest } = config.themeVariables
      const mergedTv = (merged.themeVariables ??= {})
      Object.assign(mergedTv, rest)
      if (quadrant) mergedTv.quadrant = { ...mergedTv.quadrant, ...quadrant }
      if (pieColors)
        mergedTv.pieColors = { ...mergedTv.pieColors, ...pieColors }
    }
    merged.ignored.push(...config.ignored)
  }

  // Mermaid reads the primary* variables under `theme: base` only.
  if (merged.themeVariables && merged.theme !== 'base') {
    for (const k of BASE_ONLY_VARIABLES) delete merged.themeVariables[k]
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

/**
 * Fold the honoured `themeVariables` into render options, for a caller that
 * opted in with `honorThemeVariables`. Like `applyInitConfig`, a directive
 * only fills what the caller left unset: `bg`/`fg`/`line`/`surface`/`border`
 * passed in `options` always win.
 */
export function applyThemeVariables(
  options: RenderOptions,
  config: InitConfig | undefined,
): RenderOptions {
  const tv = config?.themeVariables
  if (!tv) return options
  const out = { ...options }
  out.surface ??= tv.primaryColor
  out.border ??= tv.primaryBorderColor
  out.fg ??= tv.primaryTextColor
  out.line ??= tv.lineColor
  return out
}

/** Human-readable note about directive keys that were parsed but not applied. */
export function describeIgnored(config: InitConfig): string[] {
  return [...new Set(config.ignored)].map(
    (key) =>
      `${key}: ${IGNORED_KEYS[key.toLowerCase()] ?? IGNORED_KEYS[key.split('.')[0]!.toLowerCase()] ?? 'not supported'}`,
  )
}
