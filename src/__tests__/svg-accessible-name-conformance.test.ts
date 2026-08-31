/**
 * Standing conformance check for GitHub issue #294 ("Publish an
 * accessibility conformance statement + CI check for accessible SVG
 * names").
 *
 * `src/__tests__/svg-accessible-name.test.ts` already tests `svgOpenTag()`'s
 * unit behavior and spot-checks each diagram type individually (#215, #239).
 * This file exists to turn that spot-checked coverage into a standing
 * guarantee, per the issue: a check that keeps covering every diagram type
 * this library supports, including ones added after this file was written,
 * rather than a point-in-time list of `it()` blocks someone has to remember
 * to extend.
 *
 * Two things make that "standing" rather than "current":
 *
 *  1. `assertAccessibleRoot()` encodes the full accessible-name contract
 *     from `svgOpenTag()` (src/theme.ts) in one place, so every diagram
 *     type/option combination below is checked against the *same* rule
 *     instead of duplicated ad hoc expectations that could quietly drift
 *     apart per diagram type.
 *  2. `SAMPLE_BY_TYPE` is typed `Record<DiagramType, string>`. `DiagramType`
 *     (src/diagram-type.ts) is a closed union, so TypeScript's missing-
 *     property checking means adding a 6th diagram type without adding a
 *     sample here fails `tsc --noEmit` (the `typecheck` CI job, which also
 *     runs in the `test`/lint pipeline before publish) — this test cannot
 *     silently stop covering a new diagram type the way a hand-maintained
 *     list of `it()` blocks could.
 *
 * The accessible-name contract itself is *not* "every rendered SVG has a
 * name" — that's not what this library actually guarantees, and asserting
 * it here would make this test lie. The real, checkable contract is:
 *
 *  - No interactive `click`-based link on the diagram, not decorative:
 *    root always carries `role="img"`, plus `aria-labelledby` + a matching
 *    `<title id>` when `title` is supplied.
 *  - `decorative: true`, no interactive link: root carries
 *    `aria-hidden="true"` and no `role`/`aria-labelledby`.
 *  - Any node has a real, focusable `click`-based `<a href>`: root never
 *    carries `role="img"` or `aria-hidden` (both are unsafe on an ancestor
 *    of a focusable element — see #239) regardless of `decorative`, but
 *    `title` still produces `aria-labelledby` + `<title>` if supplied.
 *
 * See the docs/accessibility.md conformance statement for the doc-facing
 * version of this guarantee, and svgOpenTag()'s TSDoc for the canonical
 * prose description this test's logic must stay in sync with.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderMermaidSVG } from '../index.ts'
import { __resetSvgTitleIdCounterForTests } from '../theme.ts'
import { detectDiagramType } from '../diagram-type.ts'
import type { DiagramType } from '../diagram-type.ts'
import type { RenderOptions } from '../types.ts'

beforeEach(() => {
  __resetSvgTitleIdCounterForTests()
})

/**
 * One renderable sample per diagram type this library supports. Typed as
 * `Record<DiagramType, string>` deliberately — see file header. Keep each
 * sample minimal but real (parseable, renderable, at least one edge/entry)
 * so this test exercises the actual render pipeline, not a degenerate case.
 */
const SAMPLE_BY_TYPE: Record<DiagramType, string> = {
  flowchart: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]',
  sequence: 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
  class: 'classDiagram\n  class Animal {\n    +String name\n    +move()\n  }',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  xychart:
    'xychart-beta\n  x-axis [jan, feb]\n  y-axis "Revenue" 0 --> 120\n  bar [50, 60]',
}

/**
 * `stateDiagram-v2` is a distinct syntax a real caller might render, but it
 * routes through the same `'flowchart'` DiagramType and renderSvg() pipeline
 * as `graph TD` (see src/parser.ts) — it isn't a separate `DiagramType`
 * union member, so it isn't part of `SAMPLE_BY_TYPE`'s compile-time
 * exhaustiveness guarantee. Exercised separately below anyway, since "same
 * pipeline" is an implementation detail this test shouldn't assume without
 * checking.
 */
const STATE_DIAGRAM_SAMPLE =
  'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running\n  Running --> [*]'

/**
 * Diagram types/syntaxes that currently support `click`-based interactive
 * links (real, focusable `<a href>` elements — see #239). Today that's only
 * flowchart/state-diagram nodes (`NodeInteraction.href`, wired in
 * src/renderer.ts); sequence/class/er/xychart have no click-link support at
 * all, so `hasInteractiveLinks` is always `false` for them (confirmed by
 * grep across src/{sequence,class,er,xychart}: none reference `click`).
 *
 * Unlike `SAMPLE_BY_TYPE`, this isn't backed by a closed union — "which
 * diagram types support click links" isn't itself a TypeScript type — so if
 * a second diagram type grows click support, nothing here fails to compile
 * to force adding it. Add its sample manually when that happens.
 */
const CLICK_LINK_SAMPLES: Record<string, string> = {
  flowchart:
    'flowchart TD\n  A --> B\n  click A "https://example.com" "Go to A"',
}

const OPTION_SETS: Array<{ name: string; options: RenderOptions }> = [
  { name: 'default (no title, not decorative)', options: {} },
  { name: 'with a title', options: { title: 'A diagram' } },
  { name: 'decorative', options: { decorative: true } },
]

interface AccessibilityExpectation {
  title?: string
  decorative?: boolean
  hasInteractiveLinks?: boolean
}

/**
 * Encodes the full accessible-name contract from `svgOpenTag()`
 * (src/theme.ts) as a single reusable assertion — see the file header for
 * the prose version. Keep the two in sync if either changes.
 */
function assertAccessibleRoot(
  svg: string,
  { title, decorative, hasInteractiveLinks }: AccessibilityExpectation,
): void {
  const rootTagEnd = svg.indexOf('>')
  expect(rootTagEnd).toBeGreaterThan(-1)
  const rootTag = svg.slice(0, rootTagEnd + 1)

  if (hasInteractiveLinks) {
    // A real, focusable <a href> descendant means role="img"/aria-hidden
    // would hide it from assistive tech while leaving it Tab-reachable —
    // neither may appear on the root, regardless of title/decorative.
    expect(rootTag).not.toMatch(/\brole="img"/)
    expect(rootTag).not.toMatch(/\baria-hidden/)
    if (title) {
      expectNamedVia(svg, rootTag, title)
    } else {
      expect(rootTag).not.toMatch(/\baria-labelledby/)
    }
    return
  }

  if (decorative) {
    expect(rootTag).toMatch(/\baria-hidden="true"/)
    expect(rootTag).not.toMatch(/\brole="img"/)
    expect(rootTag).not.toMatch(/\baria-labelledby/)
    return
  }

  // Plain case: always at least role="img", so assistive tech never treats
  // the SVG as an unnamed group of individually-announced node/edge labels
  // (the core #215 bug) — with a real computed name layered on when `title`
  // is supplied.
  expect(rootTag).toMatch(/\brole="img"/)
  if (title) {
    expectNamedVia(svg, rootTag, title)
  } else {
    expect(rootTag).not.toMatch(/\baria-labelledby/)
  }
}

/**
 * Asserts the root's `aria-labelledby` resolves to a `<title id>` whose text
 * matches exactly. Titles used in this file are plain text (no XML-special
 * characters) so a literal substring check is sufficient — escaping
 * behavior itself is covered by svg-accessible-name.test.ts.
 */
function expectNamedVia(svg: string, rootTag: string, title: string): void {
  const labelledbyMatch = rootTag.match(/aria-labelledby="([^"]+)"/)
  expect(labelledbyMatch).not.toBeNull()
  const id = labelledbyMatch?.[1]
  const titleOpenTag = `<title id="${id}">`
  const start = svg.indexOf(titleOpenTag)
  expect(start).toBeGreaterThan(-1)
  const end = svg.indexOf('</title>', start)
  expect(end).toBeGreaterThan(start)
  const titleText = svg.slice(start + titleOpenTag.length, end)
  expect(titleText).toBe(title)
}

describe('accessible-name conformance — every diagram type (#294)', () => {
  it('SAMPLE_BY_TYPE samples each detect as their own claimed diagram type', () => {
    // Redundant with the Record<DiagramType, string> compile-time
    // exhaustiveness check above, but proves it at runtime too — and would
    // catch a copy-paste mistake where a sample's header doesn't actually
    // route to the type it's keyed under.
    for (const [claimedType, source] of Object.entries(SAMPLE_BY_TYPE)) {
      expect(detectDiagramType(source)).toBe(claimedType as DiagramType)
    }
  })

  for (const diagramType of Object.keys(SAMPLE_BY_TYPE) as DiagramType[]) {
    const source = SAMPLE_BY_TYPE[diagramType]
    for (const { name, options } of OPTION_SETS) {
      it(`${diagramType}: ${name}`, () => {
        const svg = renderMermaidSVG(source, options)
        assertAccessibleRoot(svg, {
          title: options.title,
          decorative: options.decorative,
          hasInteractiveLinks: false,
        })
      })
    }
  }

  for (const { name, options } of OPTION_SETS) {
    it(`stateDiagram-v2: ${name}`, () => {
      const svg = renderMermaidSVG(STATE_DIAGRAM_SAMPLE, options)
      assertAccessibleRoot(svg, {
        title: options.title,
        decorative: options.decorative,
        hasInteractiveLinks: false,
      })
    })
  }
})

describe('accessible-name conformance — with click/interaction directives (#294)', () => {
  it('CLICK_LINK_SAMPLES is not accidentally empty', () => {
    // If this ever hits 0, every test in this describe block silently
    // becomes a no-op loop — this guards against that self-defeating state.
    expect(Object.keys(CLICK_LINK_SAMPLES).length).toBeGreaterThan(0)
  })

  for (const [diagramType, source] of Object.entries(CLICK_LINK_SAMPLES)) {
    for (const { name, options } of OPTION_SETS) {
      it(`${diagramType} with a click link: ${name}`, () => {
        const svg = renderMermaidSVG(source, options)
        // Sanity check the sample actually renders the interactive link
        // this test claims to exercise, so a parser regression that quietly
        // drops the `click` directive can't produce a false pass below.
        expect(svg).toContain('<a href="https://example.com">')
        assertAccessibleRoot(svg, {
          title: options.title,
          decorative: options.decorative,
          hasInteractiveLinks: true,
        })
      })
    }
  }
})
