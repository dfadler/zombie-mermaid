// ============================================================================
// zombie-mermaid/remark — browserless build-time Mermaid for unified (#1875).
//
// `remarkMermaid` (mdast) and `rehypeMermaid` (hast) replace ```mermaid code
// blocks with the rendered SVG, with no Playwright/Chromium. Dependency-free:
// the tree shapes are declared structurally, so `unified` is not required here.
//
// The SVG is emitted as raw HTML (mdast `html`, hast `raw`), so the pipeline
// must allow it: `remark-rehype` `{ allowDangerousHtml: true }`, and
// `rehype-raw` (or `rehype-stringify` `{ allowDangerousHtml: true }`).
// The SVG is renderer output, but diagram text is untrusted input: sanitize
// downstream if the Markdown itself is untrusted.
//
// ponytail: sync `renderMermaidSVG` only. Diagrams that need ELK require the
// caller to `registerElk()` once before the pipeline runs.
// ============================================================================

import { renderMermaidSVG } from '@zombie-mermaid/svg-renderer'
import type { RenderOptions } from '@zombie-mermaid/core'

export interface RemarkMermaidOptions {
  /** Passed to `renderMermaidSVG`. */
  render?: RenderOptions
}

interface Node {
  type: string
  value?: string
  lang?: string | null
  tagName?: string
  properties?: { className?: unknown }
  children?: Node[]
}

function walk(node: Node, replace: (n: Node) => Node | undefined): void {
  const kids = node.children
  if (!kids) return
  for (let i = 0; i < kids.length; i++) {
    const next = replace(kids[i]!)
    if (next) kids[i] = next
    else walk(kids[i]!, replace)
  }
}

/** Remark: mdast `code` nodes with `lang: mermaid` become `html` nodes. */
export function remarkMermaid(options: RemarkMermaidOptions = {}) {
  return (tree: Node): void =>
    walk(tree, (n) =>
      n.type === 'code' && n.lang === 'mermaid'
        ? {
            type: 'html',
            value: renderMermaidSVG(n.value ?? '', options.render),
          }
        : undefined,
    )
}

function mermaidCode(pre: Node): Node | undefined {
  const [code, ...rest] = (pre.children ?? []).filter(
    (c) => c.type !== 'text' || c.value?.trim(),
  )
  const cls = code?.properties?.className
  return pre.tagName === 'pre' &&
    !rest.length &&
    code?.tagName === 'code' &&
    Array.isArray(cls) &&
    cls.includes('language-mermaid')
    ? code
    : undefined
}

function textOf(node: Node): string {
  return node.value ?? (node.children ?? []).map(textOf).join('')
}

/** Rehype: `<pre><code class="language-mermaid">` becomes a `raw` SVG node. */
export function rehypeMermaid(options: RemarkMermaidOptions = {}) {
  return (tree: Node): void =>
    walk(tree, (n) => {
      const code = mermaidCode(n)
      return code
        ? { type: 'raw', value: renderMermaidSVG(textOf(code), options.render) }
        : undefined
    })
}
