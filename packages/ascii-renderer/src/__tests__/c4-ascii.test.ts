import { describe, it, expect } from 'vitest'
import { renderMermaidASCII } from '../../../../src/index.ts'
import { samples } from '../../../../samples/samples-data.ts'

/** [column, row] of the first occurrence of `needle`. */
function find(out: string, needle: string): [number, number] {
  const lines = out.split('\n')
  for (const [row, line] of lines.entries()) {
    const col = line.indexOf(needle)
    if (col >= 0) return [col, row]
  }
  throw new Error(`"${needle}" not found in:\n${out}`)
}

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

  it('places shapes in declaration order and ignores the direction', () => {
    const src = 'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nRel(a, b, "x")'
    const td = renderMermaidASCII(src)
    // Mermaid puts both in one row, however the relationship points.
    expect(find(td, 'Aaa')[1]).toBe(find(td, 'Bbb')[1])
    expect(find(td, 'Aaa')[0]).toBeLessThan(find(td, 'Bbb')[0])
    expect(renderMermaidASCII(src, { direction: 'BT' })).toBe(td)
    // Arrowhead points at the target.
    expect(td).toContain('►')
  })

  it('wraps a fifth shape onto a second row, as mermaid does', () => {
    const out = renderMermaidASCII(
      'C4Context\n' +
        ['A1', 'B2', 'C3', 'D4', 'E5']
          .map((n) => `System(${n}, "${n}")`)
          .join('\n'),
    )
    expect(find(out, 'D4')[1]).toBe(find(out, 'A1')[1])
    expect(find(out, 'E5')[1]).toBeGreaterThan(find(out, 'A1')[1])
    expect(find(out, 'E5')[0]).toBe(find(out, 'A1')[0])
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

  it('does not move shapes for Rel_L or Rel_U, as in mermaid', () => {
    for (const rel of ['Rel_L', 'Rel_U']) {
      const out = renderMermaidASCII(
        `C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\n${rel}(a, b, "x")`,
      )
      expect(find(out, 'Aaa')[1]).toBe(find(out, 'Bbb')[1])
      expect(find(out, 'Aaa')[0]).toBeLessThan(find(out, 'Bbb')[0])
    }
  })

  it('draws BiRel arrowheads at both ends', () => {
    const out = renderMermaidASCII(
      'C4Context\nSystem(a, "Aaa")\nSystem(b, "Bbb")\nBiRel(a, b, "x")',
    )
    expect(out).toContain('►')
    expect(out).toContain('◄')
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

  // Mermaid wraps after four shapes, so the fifth sits in a row of its own.
  const DYNAMIC = `C4Dynamic
  Person(u, "User")
  System(a, "App")
  System(f2, "F2")
  System(f3, "F3")
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
  System(f1, "F1")
  System(f2, "F2")
  System(f3, "F3")
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
        `C4Context\n  System(a, "A")\n  System(f1, "F1")\n  System(f2, "F2")\n  System(f3, "F3")\n  System(b, "B")\n  ${rels.join('\n  ')}`,
      )
      return between(out, 'A').length
    }
    expect(rows(4)).toBeGreaterThan(rows(1))
  })
})

describe('routes keep off box sides (#2723)', () => {
  it('does not run a stroke along another box border', () => {
    const src = samples.find((s) =>
      s.title.includes('Container With Boundary'),
    )!
    const out = renderMermaidASCII(src.source)
    // `│├` / `┤│` and the like: a route on the column next to a box side.
    expect(out).not.toMatch(/[│┐┘][├┤╭╮╰╯│]{1}[│├]|│[╭├╰]|[╮┤╯]│/)
  })
})

describe('arrowheads are fed by a stroke (#2026)', () => {
  // The cell behind a head (opposite its direction) must carry a stroke that
  // runs along the head's axis, never a side arm or nothing.
  const HEADS: Record<string, [number, number, RegExp]> = {
    '▲': [0, 1, /[│└┘├┤┴┼]/],
    '▼': [0, -1, /[│┌┐├┤┬┼]/],
    '►': [-1, 0, /[─┌└├┬┴┼]/],
    '◄': [1, 0, /[─┐┘┤┬┴┼]/],
  }
  const c4 = samples.filter((s) => s.source.trimStart().startsWith('C4'))

  it('has C4 samples to check', () => {
    expect(c4.length).toBeGreaterThan(0)
  })

  it.each(c4.map((s) => [s.title, s.source]))('%s', (_t, source) => {
    const grid = renderMermaidASCII(source!).split('\n')
    const bad: string[] = []
    grid.forEach((line, y) =>
      [...line].forEach((ch, x) => {
        const h = HEADS[ch]
        if (!h) return
        const behind = [...(grid[y + h[1]] ?? '')][x + h[0]] ?? ' '
        if (!h[2].test(behind))
          bad.push(`${ch} at ${x},${y} behind "${behind}"`)
      }),
    )
    expect(bad).toEqual([])
  })
})

// Mermaid 12.3.0 draws accTitle in the title slot, over any `title` (#2696).
describe('C4 accTitle', () => {
  const body = `  Person(u, "User")\n  System(s, "System")\n  Rel(u, s, "uses")`
  const lines = (src: string) =>
    renderMermaidASCII(src, { colorMode: 'none' }).split('\n')

  it('draws accTitle centred above the diagram, like title', () => {
    const out = lines(`C4Context\n  accTitle: Accessible title\n${body}`)
    const row = out.findIndex((l) => l.includes('Accessible title'))
    expect(row).toBe(
      lines(`C4Context\n  title Accessible title\n${body}`).findIndex((l) =>
        l.includes('Accessible title'),
      ),
    )
    expect(row).toBeLessThan(out.findIndex((l) => l.includes('User')))
  })

  it('lets accTitle win over title, and does not print accDescr', () => {
    const out = renderMermaidASCII(
      `C4Context\n  title Shown\n  accTitle: Accessible\n  accDescr: Hidden words\n${body}`,
      { colorMode: 'none' },
    )
    expect(out).toContain('Accessible')
    expect(out).not.toContain('Shown')
    expect(out).not.toContain('Hidden words')
  })

  it('still draws a plain title and widens for a long accTitle', () => {
    expect(lines(`C4Context\n  title Shown\n${body}`).join('\n')).toContain(
      'Shown',
    )
    const long = 'x'.repeat(60)
    const out = lines(`C4Context\n  accTitle: ${long}\n${body}`)
    expect(out.some((l) => l.includes(long))).toBe(true)
  })
})
