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

export async function scoreBlock(
  session: RealMermaidSession,
  filter?: string,
): Promise<BlockRun> {
  const wanted = samples
    .filter((s) => /^\s*(?:---[\s\S]*?---\s*)?block(?:-beta)?\b/.test(s.source))
    .filter(
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
