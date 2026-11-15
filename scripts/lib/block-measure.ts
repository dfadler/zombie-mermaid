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

export async function scoreBlock(
  session: RealMermaidSession,
  filter?: string,
): Promise<BlockRun> {
  const wanted = [
    ...samples.filter((s) =>
      /^\s*(?:---[\s\S]*?---\s*)?block(?:-beta)?\b/.test(s.source),
    ),
    ...EXTRA_CASES,
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
