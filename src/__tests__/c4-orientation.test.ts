import { describe, it, expect } from 'vitest'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

// `RenderOptions.direction` through the C4 renderers.
//
// SVG follows Mermaid's C4 renderer, which has no direction: shapes are placed
// in rows in declaration order, so the option changes nothing. What must hold
// in every direction is that each arrowhead sits on the right end of its
// relationship (`Rel` at `to`, `Rel_Back` at `from`, `BiRel` at both).
//
// ASCII keeps its own layout: top to bottom, `BT` flips it, and `LR`/`RL`
// render like `TB`.

const DIRECTIONS = ['TB', 'BT', 'LR', 'RL'] as const
type Dir = (typeof DIRECTIONS)[number]

const SOURCE = `C4Context
  Person(a, "A")
  Enterprise_Boundary(b0, "Bank") {
    System(b, "B")
    SystemDb(c, "C")
  }
  System_Ext(d, "D")
  Rel(a, b, "Uses", "HTTPS")
  Rel(b, c, "Reads from and writes to")
  Rel_Back(a, d, "Sends to")
  BiRel(b, d, "Syncs")`

const svgOf = (dir: Dir): string => renderMermaidSVG(SOURCE, { direction: dir })

interface Line {
  from: string
  to: string
  start: [number, number]
  end: [number, number]
}

/** Each relationship's end points, read from its path (`M sx,sy L|Q ... ex,ey`). */
function lines(svg: string): Line[] {
  return [
    ...svg.matchAll(
      /<path class="c4-relationship" data-from="([^"]+)" data-to="([^"]+)"[^>]* d="([^"]+)"/g,
    ),
  ].map((m) => {
    const nums = m[3]!.match(/-?[\d.]+/g)!.map(Number)
    return {
      from: m[1]!,
      to: m[2]!,
      start: [nums[0]!, nums[1]!],
      end: [nums[nums.length - 2]!, nums[nums.length - 1]!],
    }
  })
}

/** Arrowhead tips: the first vertex of each arrowhead polygon. */
function tips(svg: string): [number, number][] {
  return [
    ...svg.matchAll(
      /<polygon class="c4-arrowhead" points="(-?[\d.]+),(-?[\d.]+) /g,
    ),
  ].map((m) => [Number(m[1]), Number(m[2])])
}

const near = (p: [number, number], q: [number, number]): boolean =>
  Math.abs(p[0] - q[0]) < 1 && Math.abs(p[1] - q[1]) < 1

describe.each(DIRECTIONS)('C4 SVG, direction %s', (dir) => {
  const svg = svgOf(dir)
  const line = (from: string, to: string): Line => {
    const l = lines(svg).find((x) => x.from === from && x.to === to)
    if (!l) throw new Error(`no relationship ${from} -> ${to}`)
    return l
  }
  const headsAt = (p: [number, number]): number =>
    tips(svg).filter((t) => near(t, p)).length

  it('puts the arrowhead at "to" for Rel', () => {
    const l = line('a', 'b')
    expect(headsAt(l.end)).toBe(1)
    expect(headsAt(l.start)).toBe(0)
  })

  it('puts the arrowhead at "from" for Rel_Back', () => {
    const l = line('a', 'd')
    expect(headsAt(l.start)).toBe(1)
    expect(headsAt(l.end)).toBe(0)
  })

  it('puts an arrowhead at both ends for BiRel', () => {
    const l = line('b', 'd')
    expect(headsAt(l.start)).toBe(1)
    expect(headsAt(l.end)).toBe(1)
  })

  it('draws one arrowhead per Rel and two for BiRel', () => {
    expect(tips(svg)).toHaveLength(1 + 1 + 1 + 2)
  })

  it('is the same drawing in every direction', () => {
    const strip = (s: string) => s.replace(/zm-title-\d+/g, 'zm-title')
    expect(strip(svg)).toBe(strip(svgOf('TB')))
  })
})

describe('C4 ASCII orientations', () => {
  const ascii = (dir: Dir): string =>
    renderMermaidASCII(SOURCE, { direction: dir })

  it('draws arrowheads on the right ends in TB', () => {
    const out = ascii('TB')
    // Rel, Rel, and one end each of Rel_Back and BiRel point down; the
    // Rel_Back head and the other BiRel head point up.
    expect([...out].filter((c) => c === '▼')).toHaveLength(3)
    expect([...out].filter((c) => c === '▲')).toHaveLength(2)
  })

  it('reverses the rows and the arrowheads in BT', () => {
    const tb = ascii('TB')
    const bt = ascii('BT')
    expect([...bt].filter((c) => c === '▲')).toHaveLength(
      [...tb].filter((c) => c === '▼').length,
    )
    expect([...bt].filter((c) => c === '▼')).toHaveLength(
      [...tb].filter((c) => c === '▲').length,
    )
    expect(bt.indexOf('[Person]')).toBeGreaterThan(
      bt.indexOf('[Software System]'),
    )
  })

  it('flips the contents of a boundary too in BT', () => {
    const rows = ascii('BT').split('\n')
    const at = (re: RegExp) => rows.findIndex((l) => re.test(l))
    // B -> C flows upward, so C sits above B inside the frame.
    expect(at(/│ +C +│/)).toBeLessThan(at(/│ +B +│/))
  })

  it.each(['TB', 'BT'] as const)(
    'keeps every relationship label in %s, wrapped if it must be',
    (dir) => {
      const out = ascii(dir)
      for (const word of [
        'Uses',
        '[HTTPS]',
        'Reads',
        'from',
        'and',
        'writes',
        'to',
        'Sends',
        'Syncs',
      ]) {
        expect(out, word).toContain(word)
      }
    },
  )

  it('is top-to-bottom only: LR and RL render exactly like TB', () => {
    expect(ascii('LR')).toBe(ascii('TB'))
    expect(ascii('RL')).toBe(ascii('TB'))
  })
})
