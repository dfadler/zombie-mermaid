/** Scores every block sample against real mermaid, for block-oracle.ts. */
import { samples } from '../../samples/samples-data.ts'
import { renderMermaidSVG } from '../../src/index.ts'
import {
  blockAgreement,
  blockBreaches,
  parseBlockSvg,
  type BlockAgreement,
} from './block-agreement.ts'
import {
  renderRealMermaidSvg,
  type RealMermaidSession,
} from './real-mermaid.ts'

export interface BlockRun {
  results: Record<string, BlockAgreement>
  errored: string[]
  breaches: string[]
}

/**
 * Cases scored next to the gallery samples. They are not samples because
 * every sample needs Linux and macOS visual baselines; these only need the oracle.
 */
export const EXTRA_CASES: { title: string; source: string }[] = [
  {
    title: 'Links',
    source: `block-beta
  columns 3
  a space b
  c space d
  a --> b
  a -- "label" --> d
  c ==> d
  b -.- d`,
  },
  {
    title: 'Link markers',
    source: `block-beta
  columns 3
  a space b
  c space d
  e space f
  a --> b
  c --x d
  e <--> f
  a --o e`,
  },
  {
    title: 'classDef, class and style',
    source: `block-beta
  columns 3
  a b c
  classDef blue fill:#66f,stroke:#33a,stroke-width:4px,color:#fff
  classDef warm fill:#fc0,color:#900
  classDef default fill:#0f0
  class a blue
  class b,c warm
  class c blue
  style b stroke:#f00,stroke-width:2px
  block:g
    d
  end
  style g fill:#eee,stroke:#f00
  style d color:#06c`,
  },
  {
    title: 'block.padding (front matter)',
    source: `---
config:
  block:
    padding: 20
---
block-beta
  columns 2
  a("round") b["two<br/>lines"]`,
  },
  {
    title: 'block.padding (init directive)',
    source: `%%{init: {"block": {"padding": 3}}}%%
block-beta
  columns 2
  a b:2
  block:g
    c d
  end`,
  },
  {
    title: 'Shapes in a grid',
    source: `block-beta
  columns 4
  a("round") b(["stadium"]) c[["sub"]] d[("db")]
  e(("circle")) f>"flag"] g{"choice"} h{{"hex"}}
  i[/"lean"/] j[\\"lean"\\] k[/"trap"\\] l[\\"trap"/]
  m((("double"))) n<["go"]>(right) o<["up"]>(up) p<["xy"]>(x, y)`,
  },
  {
    title: 'Shapes beside taller and wider blocks',
    source: `block-beta
  columns 3
  a{{"hex"}} b["two<br/>lines<br/>three"] c[("db")]
  d((("dc"))) e["a rather wide block"] f[["sub"]]
  g>"flag"] h(["stadium"]) i[/"lean"/]`,
  },
  {
    title: 'Redeclared ids change the first block',
    source: `block-beta
  columns 3
  a b c
  a{{"hex"}}
  b<["go"]>(right)
  c(["pill"])
  d<["x"]>(up)
  d((("dc")))`,
  },
  {
    title: 'Shapes spanning columns',
    source: `block-beta
  columns 3
  a{{"hex"}}:2 b
  c(["stadium"]):3
  d<["span"]>(right, left):2 e((("dc")))
  f[("db")]:2 g[["sub"]]`,
  },
  {
    title: 'Shapes in groups and with other padding',
    source: `%%{init: {"block": {"padding": 12}}}%%
block-beta
  columns 2
  block:g
    columns 1
    a{{"hex"}} b[("db")]
  end
  c((("dc"))) d<["arrow"]>(left, right)`,
  },
  {
    title: 'Links to and from shapes',
    source: `block-beta
  columns 3
  a(("circle")) space b[/"trap"\\]
  c[("db")] space d{{"hex"}}
  e((("double"))) space f[/"lean"/]
  g>"flag"] space h[["sub"]]
  a --> b
  c --> d
  e --> f
  g --> h
  a --> d
  c --> f
  e --> b
  h --> a`,
  },
  {
    title: 'Links to block arrows and stadiums',
    source: `block-beta
  columns 3
  a<["go"]>(right) space b(["stadium"])
  c<["up"]>(up, down) space d<["l"]>(left)
  a --> b
  c --> d
  a --> d
  b --> c`,
  },
  {
    title: 'Links between neighbours',
    source: `block-beta
  columns 3
  a b c
  block:g:2
    d e
  end
  f
  a --> b
  g -- "into group" --> f
  c --> a`,
  },
]

/** Every shape and block arrow, in the delimiters Mermaid reads them by. */
const SHAPES: [string, string][] = [
  ['round', 'a("Label")'],
  ['stadium', 'a(["Label"])'],
  ['subroutine', 'a[["Label"]]'],
  ['cylinder', 'a[("Label")]'],
  ['circle', 'a(("Label"))'],
  ['asymmetric', 'a>"Label"]'],
  ['diamond', 'a{"Label"}'],
  ['hexagon', 'a{{"Label"}}'],
  ['lean right', 'a[/"Label"/]'],
  ['lean left', 'a[\\"Label"\\]'],
  ['trapezoid', 'a[/"Label"\\]'],
  ['inverted trapezoid', 'a[\\"Label"/]'],
  ['double circle', 'a((("Label")))'],
  ['arrow right', 'a<["Label"]>(right)'],
  ['arrow left', 'a<["Label"]>(left)'],
  ['arrow up', 'a<["Label"]>(up)'],
  ['arrow down', 'a<["Label"]>(down)'],
  ['arrow x', 'a<["Label"]>(x)'],
  ['arrow y', 'a<["Label"]>(y)'],
  ['arrow right, down', 'a<["Label"]>(right, down)'],
  ['arrow left, up', 'a<["Label"]>(left, up)'],
  ['arrow right, left, up', 'a<["Label"]>(right, left, up)'],
  ['arrow right, up, down', 'a<["Label"]>(right, up, down)'],
  ['arrow left, up, down', 'a<["Label"]>(left, up, down)'],
  ['arrow right, left, down', 'a<["Label"]>(right, left, down)'],
  ['arrow all four', 'a<["Label"]>(right, left, up, down)'],
  ['arrow right, up', 'a<["Label"]>(right, up)'],
  ['arrow left, down', 'a<["Label"]>(left, down)'],
  ['arrow with a stray space', 'a<["Label"]>(right down)'],
]

/** Each shape alone, beside a wider block (its cell stretches) and on two lines. */
const SHAPE_CASES = SHAPES.flatMap(([name, decl]) => [
  { title: `Shape: ${name}`, source: `block-beta\n  columns 1\n  ${decl}` },
  {
    title: `Shape: ${name}, in a wider cell`,
    source: `block-beta\n  columns 1\n  ${decl}\n  b["a much wider block here"]`,
  },
  {
    title: `Shape: ${name}, two lines`,
    source: `block-beta\n  columns 1\n  ${decl.replace('Label', 'Two<br/>lines')}`,
  },
])

export async function scoreBlock(
  session: RealMermaidSession,
  filter?: string,
): Promise<BlockRun> {
  const wanted = [
    ...samples.filter((s) =>
      /^\s*(?:---[\s\S]*?---\s*)?block(?:-beta)?\b/.test(s.source),
    ),
    ...EXTRA_CASES,
    ...SHAPE_CASES,
  ].filter(
    (s) => !filter || s.title.toLowerCase().includes(filter.toLowerCase()),
  )
  const results: Record<string, BlockAgreement> = {}
  const errored: string[] = []
  for (const [i, { title, source }] of wanted.entries()) {
    try {
      const official = await renderRealMermaidSvg(session, `block_${i}`, source)
      results[title] = blockAgreement(
        parseBlockSvg(official),
        parseBlockSvg(renderMermaidSVG(source)),
      )
    } catch (err) {
      console.error(`ERR  ${title}: ${(err as Error).message.split('\n')[0]}`)
      errored.push(title)
    }
  }
  return { results, errored, breaches: blockBreaches(results, errored) }
}
