import { describe, it, expect } from 'vitest'
import { splitStatements, detectDiagramType } from '@zombie-mermaid/core'
import {
  parseArchitecture,
  architectureToGraph,
} from '@zombie-mermaid/mermaid-parser'
import { renderMermaidSVG, renderMermaidASCII } from '../index.ts'

const parse = (src: string) => parseArchitecture(splitStatements(src))
const lower = (src: string) => architectureToGraph(parse(src))

const DOC = `architecture-beta
  group api(cloud)[API]
  group edge(internet)[Edge] in api
  service db(database)[Database] in api
  service server(server)[Server] in api
  service gw[Gateway] in edge
  junction j in api
  service client(internet)[Client]
  db:L -- R:server
  server:T <--> B:j
  gw{group}:R --> L:client
  align row db server`

describe('architecture-beta parsing', () => {
  it('detects both header spellings', () => {
    expect(detectDiagramType('architecture-beta\nservice a')).toBe(
      'architecture',
    )
    expect(detectDiagramType('architecture\nservice a')).toBe('architecture')
  })

  it('parses groups, nesting, services, junctions and edges', () => {
    const d = parse(DOC)
    expect(d.groups.map((g) => [g.id, g.title, g.parent])).toEqual([
      ['api', 'API', undefined],
      ['edge', 'Edge', 'api'],
    ])
    expect(d.services.find((s) => s.id === 'db')).toMatchObject({
      icon: 'database',
      title: 'Database',
      parent: 'api',
    })
    expect(d.services.find((s) => s.id === 'gw')?.icon).toBeUndefined()
    expect(d.junctions).toEqual([{ id: 'j', parent: 'api' }])
    expect(d.edges).toHaveLength(3)
    expect(d.edges[1]).toMatchObject({ arrowStart: true, arrowEnd: true })
    expect(d.edges[2]).toMatchObject({ sourceGroup: true, arrowEnd: true })
  })

  it('titles default to the id', () => {
    expect(parse('architecture-beta\nservice a').services[0]?.title).toBe('a')
  })

  it.each([
    ['service a\nservice a', /line 3.*duplicate id "a"/s],
    ['service a in nope', /line 2.*must name a declared group/s],
    ['group g in g', /line 2.*inside itself/s],
    ['group a in b\ngroup b in a', /nested inside itself/],
    ['service a\na:R -- L:zzz', /line 3.*unknown id "zzz"/s],
    ['group g\nservice a\na:R -- L:g', /line 4.*not the group/s],
    ['service a\nservice b\na{group}:R -- L:b', /needs "a" to be declared/],
    ['service a\nbogus line', /line 3.*unrecognized/s],
  ])('rejects %j', (body, message) => {
    expect(() => parse(`architecture-beta\n${body}`)).toThrow(message)
  })
})

describe('architecture-beta lowering', () => {
  it('maps groups to nested subgraphs and icons to shapes', () => {
    const g = lower(DOC)
    expect(g.subgraphs).toHaveLength(1)
    const api = g.subgraphs[0]!
    expect(api.id).toBe('api')
    expect(api.nodeIds).toEqual(['db', 'server', 'j'])
    expect(api.children.map((c) => [c.id, c.nodeIds])).toEqual([
      ['edge', ['gw']],
    ])
    expect(g.nodes.get('db')?.shape).toBe('cylinder')
    expect(g.nodes.get('server')?.shape).toBe('rectangle')
    expect(g.nodes.get('j')).toMatchObject({
      shape: 'filled-circle',
      label: '',
    })
  })

  it('attaches {group} ends to the enclosing group', () => {
    const e = lower(DOC).edges[2]!
    expect(e).toMatchObject({ source: 'edge', target: 'client' })
  })

  it('picks the flow axis from the ports', () => {
    expect(
      lower('architecture-beta\nservice a\nservice b\na:R -- L:b').direction,
    ).toBe('LR')
    expect(
      lower('architecture-beta\nservice a\nservice b\na:B -- T:b').direction,
    ).toBe('TB')
  })

  it('reverses edges that run against the flow, keeping arrowheads on the true ends', () => {
    // `a:L --> R:b` puts a to the right of b, arrow pointing at b.
    const [e] = lower(
      'architecture-beta\nservice a\nservice b\na:L --> R:b\n',
    ).edges
    expect(e).toMatchObject({
      source: 'b',
      target: 'a',
      hasArrowStart: true,
      hasArrowEnd: false,
    })
  })
})

describe('architecture-beta rendering', () => {
  it('renders SVG with group titles and service labels', () => {
    const svg = renderMermaidSVG(DOC)
    for (const label of [
      'API',
      'Edge',
      'Database',
      'Server',
      'Gateway',
      'Client',
    ]) {
      expect(svg).toContain(label)
    }
  })

  it('renders ASCII', () => {
    const out = renderMermaidASCII(
      'architecture-beta\n  service a[Alpha]\n  service b[Beta]\n  a:R --> L:b',
    )
    expect(out).toContain('Alpha')
    expect(out).toContain('Beta')
  })
})

const NESTED = `architecture-beta
  group api(cloud)[API]
  group inner(cloud)[Inner] in api
  service a[Alpha] in inner
  service b[Beta] in api
  junction j in api
  a:R -- L:j
  j:R --> L:b`

describe('architecture-beta nested groups and junctions', () => {
  it('SVG draws nested groups and a junction dot', () => {
    const svg = renderMermaidSVG(NESTED)
    expect(svg).toContain('data-id="api" data-label="API"')
    expect(svg).toContain('data-id="inner" data-label="Inner"')
    expect(svg).toContain(
      'data-id="j" data-label="" data-shape="filled-circle"',
    )
    expect(svg.match(/class="subgraph"/g)).toHaveLength(2)
    expect(svg.match(/class="edge"/g)).toHaveLength(2)
    // The inner group is drawn after (on top of) its parent.
    expect(svg.indexOf('data-id="api"')).toBeLessThan(
      svg.indexOf('data-id="inner"'),
    )
  })

  it('ASCII draws the inner group inside the outer one', () => {
    const lines = renderMermaidASCII(NESTED).split('\n')
    const find = (s: string) => lines.find((l) => l.includes(s))!
    // The outer border encloses the inner box: both its left and right
    // borders flank the inner group's own title row.
    expect(find('API')).toMatch(/^│\s+API\s+│$/)
    expect(find('Inner')).toMatch(/^│\s*│\s+Inner\s+│/)
    expect(find('Inner')).toMatch(/│$/)
    expect(find('Alpha')).toMatch(/^│\s*│\s*│\s+Alpha/)
    expect(find('Beta')).toMatch(/^│.*Beta.*│$/)
  })

  it('ASCII draws a junction as a small box and keeps its edge arrow', () => {
    const out = renderMermaidASCII(NESTED)
    expect(out).toContain('●')
    expect(out).toContain('►')
  })

  it('SVG and ASCII both render {group} edges', () => {
    const src = `architecture-beta
  group g(cloud)[Group]
  service a[Alpha] in g
  service b[Beta]
  a{group}:R --> L:b`
    expect(renderMermaidSVG(src)).toContain('data-id="g"')
    const out = renderMermaidASCII(src)
    expect(out).toContain('Group')
    expect(out).toContain('Beta')
  })

  it('SVG reversed edges still render', () => {
    const svg = renderMermaidSVG(
      'architecture-beta\nservice a[Alpha]\nservice b[Beta]\na:L --> R:b',
    )
    expect(svg).toContain('data-id="a"')
    expect(svg.match(/class="edge"/g)).toHaveLength(1)
  })

  // https://github.com/dfadler/zombie-mermaid/issues/1197: a back-edge across
  // sibling groups used to throw in the ASCII grid layout.
  it('ASCII renders a back-edge across sibling groups (#1197)', () => {
    const out = renderMermaidASCII(`architecture-beta
  group g1(cloud)[G1]
  group g2(cloud)[G2]
  group g3(cloud)[G3]
  service a(server)[A] in g1
  service b(server)[B] in g2
  service c(server)[C] in g3
  a:R --> L:b
  b:R --> L:c
  c:B --> B:a`)
    for (const g of ['G1', 'G2', 'G3']) expect(out).toContain(g)
  })
})
