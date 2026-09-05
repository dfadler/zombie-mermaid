/**
 * Class-diagram styling: `classDef`, `style`, `cssClass "A,B" name`,
 * `class A,B name`, and the `:::name` shorthand (issue #420, verified as
 * unsupported in #422).
 *
 * The parser feeds the same `StyleDirectives` cascade flowcharts use
 * (src/style-directives.ts); the SVG renderer applies the resolved style to
 * the class box; the ASCII renderer parses and ignores it, exactly like the
 * flowchart ASCII renderer does.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram } from '../class/parser.ts'
import { parseMermaid } from '../parser.ts'
import { renderMermaidSVG } from '../index.ts'
import { renderMermaidASCII } from '../ascii/index.ts'

/**
 * Escape regex metacharacters so a value can be interpolated into a
 * `RegExp` literally. Every call site in this file passes a class-diagram
 * identifier from a hardcoded test string, never untrusted input. Semgrep's
 * detect-non-literal-regexp rule flags any `new RegExp()` built from a
 * template literal regardless of escaping (it's a syntactic check, not a
 * taint one that would credit the escaping), so the call site below still
 * needs a scoped `nosemgrep` — this helper is what makes that suppression
 * actually sound rather than just quiet.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
import { splitStatements } from '../statements.ts'
import {
  parseStyleProps,
  resolveNodeStyle,
  sanitizeClassName,
  splitClassShorthand,
} from '../style-directives.ts'
import type { StyleDirectives } from '../style-directives.ts'

/** Parse through the same statement splitter index.ts uses. */
function parse(text: string) {
  return parseClassDiagram(splitStatements(text))
}

/** The `<g class="class-node ...">` opening tag for one class id. */
function classGroup(svg: string, id: string): string {
  // `id` is escaped below, so this can't misbehave as a regex even though
  // Semgrep's rule flags any RegExp built from a template literal
  // regardless of escaping. Every caller passes a hardcoded test-file
  // identifier, never untrusted input.
  const pattern = `<g class="class-node[^"]*" data-id="${escapeRegExp(id)}"[^>]*>`
  const match = svg.match(new RegExp(pattern)) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  expect(match, `no class-node group for ${id}`).not.toBeNull()
  return match![0]
}

/** The `<rect>` tags inside one class's group, in document order. */
function classRects(svg: string, id: string): string[] {
  const start = svg.indexOf(`data-id="${id}"`)
  expect(start, `no class-node group for ${id}`).toBeGreaterThan(-1)
  const end = svg.indexOf('</g>', start)
  return svg.slice(start, end).match(/<rect[^>]*>/g) ?? []
}

// ============================================================================
// Parser
// ============================================================================

describe('parseClassDiagram – classDef / style / cssClass / class assignment', () => {
  it('records a classDef with its properties', () => {
    const d = parse(`classDiagram
      class Animal
      classDef someclass fill:#f96,stroke:#333,stroke-width:4px;`)
    expect(d.classDefs.get('someclass')).toEqual({
      fill: '#f96',
      stroke: '#333',
      'stroke-width': '4px',
    })
  })

  it('applies a comma-separated classDef name list to every name', () => {
    const d = parse(`classDiagram
      classDef first,second font-size:12pt`)
    expect(d.classDefs.get('first')).toEqual({ 'font-size': '12pt' })
    expect(d.classDefs.get('second')).toEqual({ 'font-size': '12pt' })
  })

  it('records `style ClassName props`, merging repeated statements', () => {
    const d = parse(`classDiagram
      class Animal
      style Animal fill:#f9f,stroke:#333
      style Animal stroke-width:4px`)
    expect(d.nodeStyles.get('Animal')).toEqual({
      fill: '#f9f',
      stroke: '#333',
      'stroke-width': '4px',
    })
  })

  it('keeps a `stroke-dasharray: 5 5` value with an internal space intact', () => {
    const d = parse(`classDiagram
      class Mineral
      style Mineral fill:#bbf,stroke-dasharray: 5 5`)
    expect(d.nodeStyles.get('Mineral')).toEqual({
      fill: '#bbf',
      'stroke-dasharray': '5 5',
    })
  })

  it('attaches a class via `cssClass "A,B" name`', () => {
    const d = parse(`classDiagram
      class Animal
      class Mineral
      cssClass "Animal,Mineral" someclass`)
    expect(d.classAssignments.get('Animal')).toBe('someclass')
    expect(d.classAssignments.get('Mineral')).toBe('someclass')
    expect(d.classes.map((c) => c.id)).toEqual(['Animal', 'Mineral'])
  })

  it('attaches a class via the flowchart-style `class A,B name`', () => {
    const d = parse(`classDiagram
      class Animal
      class Mineral
      class Animal,Mineral someclass;`)
    expect(d.classAssignments.get('Animal')).toBe('someclass')
    expect(d.classAssignments.get('Mineral')).toBe('someclass')
    // The assignment must not be mistaken for a declaration of "Animal,Mineral"
    expect(d.classes.map((c) => c.id)).toEqual(['Animal', 'Mineral'])
  })

  it('does not mistake a plain declaration or a generic for an assignment', () => {
    const d = parse(`classDiagram
      class Animal
      class Box~T~`)
    expect(d.classAssignments.size).toBe(0)
    expect(d.classes.map((c) => c.id)).toEqual(['Animal', 'Box'])
    expect(d.classes[1]!.label).toBe('Box<T>')
  })
})

describe('parseClassDiagram – `:::` shorthand', () => {
  it('splits `class Animal:::someclass` into a bare id plus an assignment', () => {
    const d = parse(`classDiagram
      class Animal:::someclass
      classDef someclass fill:#f96`)
    expect(d.classes.map((c) => c.id)).toEqual(['Animal'])
    expect(d.classes[0]!.label).toBe('Animal')
    expect(d.classAssignments.get('Animal')).toBe('someclass')
  })

  it('handles the shorthand on a multi-line class body', () => {
    const d = parse(`classDiagram
      class Animal:::someclass {
        -int sizeInFeet
        -canEat()
      }
      classDef someclass fill:#f96`)
    expect(d.classes.map((c) => c.id)).toEqual(['Animal'])
    expect(d.classes[0]!.attributes.map((a) => a.name)).toEqual(['sizeInFeet'])
    expect(d.classes[0]!.methods.map((m) => m.name)).toEqual(['canEat'])
    expect(d.classAssignments.get('Animal')).toBe('someclass')
  })

  it('handles the shorthand on a single-line class body', () => {
    // Previously dropped outright: the block regex needed a bare `{` at end
    // of line, so the whole statement fell through unparsed (#422).
    const d = parse(`classDiagram
      class Animal:::someclass { -int sizeInFeet }`)
    expect(d.classes.map((c) => c.id)).toEqual(['Animal'])
    expect(d.classes[0]!.attributes.map((a) => a.name)).toEqual(['sizeInFeet'])
    expect(d.classAssignments.get('Animal')).toBe('someclass')
  })

  it('still parses the single-line annotation body and an empty body', () => {
    const d = parse(`classDiagram
      class Shape { <<abstract>> }
      class Empty {}`)
    expect(d.classes.map((c) => c.id)).toEqual(['Shape', 'Empty'])
    expect(d.classes[0]!.annotation).toBe('abstract')
    expect(d.classes[1]!.attributes).toHaveLength(0)
  })

  it('strips the shorthand from either end of a relationship', () => {
    const d = parse(`classDiagram
      Animal:::base <|-- Dog:::leaf`)
    expect(d.classes.map((c) => c.id)).toEqual(['Animal', 'Dog'])
    expect(d.relationships[0]).toMatchObject({ from: 'Animal', to: 'Dog' })
    expect(d.classAssignments.get('Animal')).toBe('base')
    expect(d.classAssignments.get('Dog')).toBe('leaf')
  })

  it('records a shorthand-declared class in the open namespace under its bare id', () => {
    const d = parse(`classDiagram
      namespace Zoo {
        class Animal:::someclass
      }`)
    expect(d.namespaces[0]!.classIds).toEqual(['Animal'])
  })
})

// ============================================================================
// Shared helpers (src/style-directives.ts)
// ============================================================================

describe('style-directives helpers', () => {
  it('splitClassShorthand leaves an id without the shorthand alone', () => {
    expect(splitClassShorthand('Animal')).toEqual({ id: 'Animal' })
    expect(splitClassShorthand('Animal:::x')).toEqual({
      id: 'Animal',
      className: 'x',
    })
    expect(splitClassShorthand('Animal:::my-class')).toEqual({
      id: 'Animal',
      className: 'my-class',
    })
  })

  it('resolveNodeStyle cascades default → class → style', () => {
    const directives: StyleDirectives = {
      classDefs: new Map<string, Record<string, string>>([
        ['default', { fill: '#f96', color: 'red' }],
        ['pink', { color: '#f9f' }],
      ]),
      classAssignments: new Map([['Animal', 'pink']]),
      nodeStyles: new Map([['Animal', { stroke: '#000' }]]),
    }
    expect(resolveNodeStyle('Animal', directives)).toEqual({
      fill: '#f96',
      color: '#f9f',
      stroke: '#000',
    })
    expect(resolveNodeStyle('Mineral', directives)).toEqual({
      fill: '#f96',
      color: 'red',
    })
    expect(
      resolveNodeStyle('Nothing', {
        classDefs: new Map(),
        classAssignments: new Map(),
        nodeStyles: new Map(),
      }),
    ).toBeUndefined()
  })

  it('parseStyleProps tolerates a trailing semicolon and skips malformed pairs', () => {
    expect(parseStyleProps('fill:#f00,stroke:#333;')).toEqual({
      fill: '#f00',
      stroke: '#333',
    })
    expect(parseStyleProps('nonsense,fill:')).toEqual({})
  })

  it('sanitizeClassName drops anything that is not a CSS identifier', () => {
    expect(sanitizeClassName('someclass')).toBe('someclass')
    expect(sanitizeClassName('my-class_2')).toBe('my-class_2')
    expect(sanitizeClassName('1bad')).toBeUndefined()
    expect(sanitizeClassName('x"y')).toBeUndefined()
    expect(sanitizeClassName(undefined)).toBeUndefined()
  })
})

describe('flowchart parser still uses the shared style directives', () => {
  it('parses classDef / class / style exactly as before', () => {
    const g = parseMermaid(`graph TD
      A[Start] --> B[End]
      classDef hot fill:#f00,stroke:#900
      class A hot;
      style B fill:#0f0`)
    expect(g.classDefs.get('hot')).toEqual({ fill: '#f00', stroke: '#900' })
    expect(g.classAssignments.get('A')).toBe('hot')
    expect(g.nodeStyles.get('B')).toEqual({ fill: '#0f0' })
    // No stray "class"/"style"/"classDef" nodes
    expect([...g.nodes.keys()]).toEqual(['A', 'B'])
  })

  it('accepts a comma-separated classDef name list (Mermaid flowchart syntax)', () => {
    const g = parseMermaid(`graph TD
      A --> B
      classDef a,b fill:#f00`)
    expect(g.classDefs.get('a')).toEqual({ fill: '#f00' })
    expect(g.classDefs.get('b')).toEqual({ fill: '#f00' })
    expect([...g.nodes.keys()]).toEqual(['A', 'B'])
  })
})

// ============================================================================
// SVG
// ============================================================================

describe('renderMermaidSVG – class diagram styling', () => {
  it('leaves an unstyled class on the theme variables', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal`)
    const rects = classRects(svg, 'Animal')
    expect(rects[0]).toContain('fill="var(--_node-fill)"')
    expect(rects[0]).toContain('stroke="var(--_node-stroke)"')
    expect(rects[1]).toContain('fill="var(--_group-hdr)"')
    expect(classGroup(svg, 'Animal')).toContain('class="class-node"')
  })

  it('applies `style` fill/stroke/stroke-width to the class box and header', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal
      class Mineral
      style Animal fill:#f9f,stroke:#333,stroke-width:4px`)
    const animal = classRects(svg, 'Animal')
    expect(animal[0]).toContain('fill="#f9f"')
    expect(animal[0]).toContain('stroke="#333"')
    expect(animal[0]).toContain('stroke-width="4px"')
    // Mermaid paints the whole box one color — the header band follows the fill
    expect(animal[1]).toContain('fill="#f9f"')
    // The other class is untouched
    expect(classRects(svg, 'Mineral')[0]).toContain('fill="var(--_node-fill)"')
  })

  it('applies a classDef through cssClass, and emits the class name on the group', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal
      class Mineral
      classDef someclass fill:#f96,stroke:#333
      cssClass "Animal,Mineral" someclass`)
    for (const id of ['Animal', 'Mineral']) {
      expect(classRects(svg, id)[0]).toContain('fill="#f96"')
      expect(classGroup(svg, id)).toContain('class="class-node someclass"')
    }
  })

  it('applies a classDef through the `:::` shorthand on a declaration', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal:::someclass {
        -int sizeInFeet
      }
      classDef someclass fill:#f96`)
    expect(svg).toContain('data-id="Animal"')
    expect(svg).not.toContain('Animal:::someclass')
    expect(classRects(svg, 'Animal')[0]).toContain('fill="#f96"')
  })

  it('cascades classDef default → class → style', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal:::pink
      class Mineral
      class Rock
      classDef default fill:#f96,color:red
      classDef pink color:#f9f
      style Rock fill:#00f`)
    // default fill everywhere it isn't overridden
    expect(classRects(svg, 'Animal')[0]).toContain('fill="#f96"')
    expect(classRects(svg, 'Mineral')[0]).toContain('fill="#f96"')
    // explicit style beats default
    expect(classRects(svg, 'Rock')[0]).toContain('fill="#00f"')
    // the class's own color beats default's color; default's still applies elsewhere
    const animalName = svg.slice(
      svg.indexOf('data-id="Animal"'),
      svg.indexOf('</g>', svg.indexOf('data-id="Animal"')),
    )
    expect(animalName).toContain('fill="#f9f"')
    const mineral = svg.slice(
      svg.indexOf('data-id="Mineral"'),
      svg.indexOf('</g>', svg.indexOf('data-id="Mineral"')),
    )
    expect(mineral).toContain('fill="red"')
  })

  it('picks a readable text color for a concrete custom fill', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Dark {
        +int id
      }
      class Light {
        +int id
      }
      style Dark fill:#000000
      style Light fill:#ffffff`)
    const dark = svg.slice(
      svg.indexOf('data-id="Dark"'),
      svg.indexOf('</g>', svg.indexOf('data-id="Dark"')),
    )
    const light = svg.slice(
      svg.indexOf('data-id="Light"'),
      svg.indexOf('</g>', svg.indexOf('data-id="Light"')),
    )
    // Name and every member tspan follow the computed color
    expect(dark).toContain('fill="#FFFFFF"')
    expect(dark).not.toContain('var(--_text-sec)')
    expect(light).toContain('fill="#000000"')
    expect(light).not.toContain('var(--_text-sec)')
  })

  it('keeps syntax-tinted members when only stroke is customized', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal {
        +int id
      }
      style Animal stroke:#f00`)
    const animal = svg.slice(
      svg.indexOf('data-id="Animal"'),
      svg.indexOf('</g>', svg.indexOf('data-id="Animal"')),
    )
    expect(animal).toContain('stroke="#f00"')
    expect(animal).toContain('var(--_text-sec)')
    expect(animal).toContain('fill="var(--_node-fill)"')
  })

  it('escapes a hostile style value rather than emitting it raw', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal
      style Animal fill:#f00"onload="alert(1)`)
    expect(svg).not.toContain('"onload="')
    expect(svg).toContain('&quot;onload=&quot;')
  })

  it('drops a class name that is not a valid CSS identifier from the class attribute', () => {
    const svg = renderMermaidSVG(`classDiagram
      class Animal
      cssClass "Animal" 1bad`)
    expect(classGroup(svg, 'Animal')).toContain('class="class-node"')
  })
})

// ============================================================================
// ASCII — parsed and ignored, like flowchart styling
// ============================================================================

describe('renderMermaidASCII – class diagram styling', () => {
  it('renders the bare id for a `:::` declaration', () => {
    const ascii = renderMermaidASCII(`classDiagram
      class Animal:::someclass
      classDef someclass fill:#f96`)
    expect(ascii).toContain('Animal')
    expect(ascii).not.toContain(':::')
  })

  it('produces byte-identical output with and without styling statements', () => {
    const plain = renderMermaidASCII(`classDiagram
      class Animal {
        +int age
      }
      Animal <|-- Dog`)
    const styled = renderMermaidASCII(`classDiagram
      class Animal:::hot {
        +int age
      }
      Animal <|-- Dog:::cold
      classDef hot fill:#f00
      classDef cold fill:#00f
      style Dog stroke:#333
      cssClass "Animal" hot`)
    expect(styled).toBe(plain)
  })
})
