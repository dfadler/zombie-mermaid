import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '@zombie-mermaid/mermaid-parser'
import { renderMermaidASCII } from '../../../../src/index.ts'
import { rankElements } from '../c4-diagram.ts'

function ranks(src: string): Record<string, number> {
  const d = parseC4Diagram(splitStatements(src))
  return Object.fromEntries(
    rankElements(
      d.elements.map((e) => e.alias),
      d.relationships,
    ),
  )
}

/** [column, row] of the first occurrence of `needle`. */
function find(out: string, needle: string): [number, number] {
  const lines = out.split('\n')
  for (const [row, line] of lines.entries()) {
    const col = line.indexOf(needle)
    if (col >= 0) return [col, row]
  }
  throw new Error(`"${needle}" not found in:\n${out}`)
}

describe('rankElements', () => {
  it('ranks along relationships and lets Rel_U reverse them', () => {
    expect(
      ranks(`C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel(a, b, "x")
  Rel_U(b, c, "up")`),
    ).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('puts Rel_R / Rel_L pairs in one rank', () => {
    expect(
      ranks(`C4Context
  System(a, "A")
  System(b, "B")
  System(c, "C")
  Rel(a, b, "x")
  Rel_R(b, c, "side")`),
    ).toEqual({ a: 0, b: 1, c: 1 })
  })

  it('survives cycles', () => {
    const r = ranks(`C4Context
  System(a, "A")
  System(b, "B")
  Rel(a, b, "x")
  Rel(b, a, "y")`)
    expect(r.a).toBe(0)
    expect(r.b).toBe(1)
  })

  it('ignores relationships to unknown or self endpoints', () => {
    expect(
      ranks('C4Context\nSystem(a, "A")\nRel(a, a, "loop")\nRel_R(a, a, "l")'),
    ).toEqual({ a: 0 })
  })
})

describe('C4 ASCII rendering', () => {
  const SRC = `C4Container
  title Shop
  Person(u, "User")
  System_Boundary(sys, "Shop") {
    Container(web, "Web App", "React", "Storefront")
    ContainerDb(db, "Database", "PostgreSQL")
    ContainerQueue(q, "Events", "Kafka")
  }
  System_Ext(pay, "Payments")
  Rel(u, web, "Browses", "HTTPS")
  Rel(web, db, "Reads", "SQL")
  BiRel(web, q, "Publishes")
  Rel(web, pay, "Charges")`

  it('draws a person glyph above the name', () => {
    const out = renderMermaidASCII(SRC)
    const [, glyphRow] = find(out, '/|\\')
    const [, nameRow] = find(out, 'User')
    expect(glyphRow).toBeLessThan(nameRow)
    expect(renderMermaidASCII('C4Context\nSystem(s, "S")')).not.toContain(
      '/|\\',
    )
  })

  it('draws the diagram title, boundary title, type lines and technology text', () => {
    const out = renderMermaidASCII(SRC)
    for (const t of [
      'Shop',
      '[Person]',
      '[Container: React]',
      '[Container: PostgreSQL]',
      '[Software System]',
      '[HTTPS]',
      '[SQL]',
      'Storefront',
    ]) {
      expect(out).toContain(t)
    }
    // The diagram title is the first text row, above everything else.
    expect(find(out, 'Shop')[1]).toBeLessThan(find(out, 'User')[1])
  })

  it('flows top to bottom and BT reverses the rows', () => {
    const src = 'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nRel(a, b, "x")'
    const td = renderMermaidASCII(src)
    expect(find(td, 'Aaa')[1]).toBeLessThan(find(td, 'Bbb')[1])
    const bt = renderMermaidASCII(src, { direction: 'BT' })
    expect(find(bt, 'Bbb')[1]).toBeLessThan(find(bt, 'Aaa')[1])
    // Arrowhead points at the target in both.
    expect(td).toContain('▼')
  })

  it('honors Rel_R: same row, source on the left, label between', () => {
    const out = renderMermaidASCII(
      'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nRel_R(a, b, "sends to")',
    )
    const [ax, ay] = find(out, 'Aaa')
    const [bx, by] = find(out, 'Bbb')
    expect(ay).toBe(by)
    expect(ax).toBeLessThan(bx)
    const [lx] = find(out, 'sends to')
    expect(lx).toBeGreaterThan(ax)
    expect(lx).toBeLessThan(bx)
    expect(out).toContain('►')
  })

  it('honors Rel_L and Rel_U', () => {
    const l = renderMermaidASCII(
      'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nRel_L(a, b, "x")',
    )
    expect(find(l, 'Bbb')[0]).toBeLessThan(find(l, 'Aaa')[0])
    const u = renderMermaidASCII(
      'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nRel_U(a, b, "x")',
    )
    expect(find(u, 'Bbb')[1]).toBeLessThan(find(u, 'Aaa')[1])
  })

  it('draws BiRel arrowheads at both ends', () => {
    const out = renderMermaidASCII(
      'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nBiRel(a, b, "x")',
    )
    expect(out).toContain('▼')
    expect(out).toContain('▲')
  })

  it('uses only ASCII characters with useAscii', () => {
    const out = renderMermaidASCII(SRC, { useAscii: true })
    expect(out).toMatch(/^[\x00-\x7f]*$/)
    expect(out).toContain('/|\\')
    expect(out).toContain('v')
  })

  it('marks external elements with a dashed border and queues with parentheses', () => {
    const out = renderMermaidASCII(SRC)
    expect(out).toContain('┄')
    expect(out).toMatch(/\( +Events +\)/)
  })

  it('draws a cylinder cap for databases', () => {
    const out = renderMermaidASCII(SRC)
    expect(out).toMatch(/├─+┤/)
  })

  it('keeps every element box intact (no route runs through one)', () => {
    const out = renderMermaidASCII(SRC)
    const lines = out.split('\n')
    for (const l of lines.filter((l) => l.includes('Web App'))) {
      expect(l).toMatch(/│ +Web App +│/)
    }
    for (const name of ['Database', 'Events', 'Payments']) {
      const row = lines.find((l) => l.includes(name))!
      expect(row).toMatch(new RegExp(`[│(┆] +${name} +[│)┆]`))
    }
  })

  it('nests boundaries and routes to a boundary', () => {
    const out = renderMermaidASCII(`C4Deployment
  Deployment_Node(dc, "DC", "Ubuntu") {
    Deployment_Node(k, "K8s", "Kubernetes") {
      Container(app, "App", "Java")
    }
  }
  Deployment_Node(empty, "Empty", "x")
  ContainerDb(db, "DB", "Pg")
  Rel(app, db, "reads")
  Rel(db, empty, "to empty")`)
    expect(out).toContain('[Ubuntu]')
    expect(out).toContain('[Kubernetes]')
    const [, dcRow] = find(out, 'DC')
    const [, k8sRow] = find(out, 'K8s')
    const [, appRow] = find(out, 'App')
    expect(dcRow).toBeLessThan(k8sRow)
    expect(k8sRow).toBeLessThan(appRow)
    // The empty node ranks below the database that points at it.
    expect(find(out, 'DB')[1]).toBeLessThan(find(out, 'Empty')[1])
  })

  it('renders a lone element, empty input and self relationships', () => {
    expect(renderMermaidASCII('C4Context\nSystem(a, "Solo")')).toContain('Solo')
    expect(renderMermaidASCII('C4Context')).toBe('')
    expect(
      renderMermaidASCII('C4Context\nSystem(a, "A")\nRel(a, a, "self")'),
    ).toContain('A')
  })

  it('wraps long names and descriptions', () => {
    const out = renderMermaidASCII(
      'C4Context\nSystem(a, "A very long system name that must wrap", "and an equally long description that also wraps")',
    )
    const longest = Math.max(...out.split('\n').map((l) => l.length))
    expect(longest).toBeLessThan(40)
  })

  it('emits ANSI color when asked', () => {
    const out = renderMermaidASCII(SRC, { colorMode: 'ansi16' })
    expect(out).toMatch(/\x1b\[/)
  })

  it('is deterministic', () => {
    expect(renderMermaidASCII(SRC)).toBe(renderMermaidASCII(SRC))
  })
})

describe('relationship labels stay readable', () => {
  /** The rows between the box holding `upper` and the next box below it. */
  function between(out: string, upper: string): string[] {
    const lines = out.split('\n')
    const top = lines.findIndex((l) => l.includes(upper))
    const bottom = lines.findIndex((l, i) => i > top && /└─/.test(l))
    const next = lines.findIndex((l, i) => i > bottom && /┌─/.test(l))
    return lines.slice(bottom + 1, next)
  }

  const DYNAMIC = `C4Dynamic
  Person(u, "User")
  System(a, "App")
  System(b, "Backend")
  Rel(u, a, "Clicks")
  Rel(a, b, "Requests")
  Rel_Back(b, a, "Responds")
  BiRel(u, b, "Streams")`

  it('gives every label on a crowded gap its own room and leaves the routes whole', () => {
    const out = renderMermaidASCII(DYNAMIC)
    for (const word of [
      '1:',
      'Clicks',
      '2:',
      'Requests',
      '3:',
      'Responds',
      '4:',
      'Streams',
    ]) {
      expect(out, word).toContain(word)
    }
    // Two routes run side by side from App to Backend; a label drawn over
    // either would break the pair on its row (arrowhead rows excepted).
    const gap = between(out, 'App')
    expect(gap.length).toBeGreaterThanOrEqual(6)
    for (const row of gap.filter((l) => !/[▼▲]/.test(l))) {
      expect(row, row).toContain('││')
    }
  })

  it('wraps a long label beside its route instead of drawing it over the route', () => {
    const out = renderMermaidASCII(`C4Container
  Container(w, "Web", "React")
  Container(a, "API", "Node")
  Rel(w, a, "Calls the API with a long label", "JSON/HTTPS")`)
    for (const word of [
      'Calls',
      'the',
      'API',
      'with',
      'a',
      'long',
      'label',
      '[JSON/HTTPS]',
    ]) {
      expect(out, word).toContain(word)
    }
    // The route is one unbroken vertical line between the boxes: its column
    // (where the arrowhead lands) holds a line or the arrowhead on every row.
    const gap = between(out, 'Web').filter((l) => l.trim() !== '')
    const col = gap.map((l) => l.indexOf('▼')).find((c) => c >= 0)!
    expect(col).toBeGreaterThanOrEqual(0)
    for (const row of gap) expect('│▼').toContain(row[col] ?? ' ')
  })

  it('grows a gap with the labels that cross it', () => {
    const rows = (labels: number): number => {
      const rels = Array.from(
        { length: labels },
        (_, i) => `Rel(a, b, "label ${i}")`,
      )
      const out = renderMermaidASCII(
        `C4Context\n  System(a, "A")\n  System(b, "B")\n  ${rels.join('\n  ')}`,
      )
      return between(out, 'A').length
    }
    expect(rows(4)).toBeGreaterThan(rows(1))
  })
})
