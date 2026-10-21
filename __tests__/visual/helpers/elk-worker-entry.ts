// Module Worker entry for elk-module-worker-2219.visual.test.ts.
import ELK from 'elkjs/lib/elk.bundled.js'
import { registerElk, renderMermaidSVG } from '@zombie-mermaid/svg-renderer'

registerElk(ELK)

self.onmessage = () => {
  try {
    const svg = renderMermaidSVG(
      'graph TD\n A[Start] --> B{Ok?}\n B -->|yes| C[Done]\n B -->|no| A',
    )
    self.postMessage({ ok: true, svg })
  } catch (e) {
    self.postMessage({ ok: false, msg: String((e as Error).message) })
  }
}
