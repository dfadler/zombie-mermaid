/**
 * #2724: mermaid 12.3.0 places each architecture service by the edge ports
 * (`a:R -- L:b` puts b right of a, `a:B -- T:b` puts b below a). ASCII honours
 * the same cells instead of laying the lowered edges out as a flowchart; SVG
 * already did (#2626), so its snapshot pins the agreement.
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. Placement was checked against mermaid@12.3.0 (gallery general-94).
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const GALLERY_94 = `architecture-beta
  service db(database)[Database]
  service disk(disk)[Disk]
  service server(server)[Server]
  service cloud(cloud)[Cloud]
  service web(internet)[Web]
  service mystery(not-a-real-icon)[Unknown Icon]
  service bare[No Icon]
  db:R -- L:server
  server:R --> L:cloud
  server:B -- T:disk
  cloud:T <-- B:web
  web:R <--> L:mystery
  disk:R -- L:bare`

const CHAIN = `architecture-beta
  service a[A]
  service b[B]
  service c[C]
  a:B -- T:b
  b:B -- T:c`

const CASES: [string, string][] = [
  ['general-94', GALLERY_94],
  ['vertical chain', CHAIN],
]

/** [row, centre column] of a label. */
function at(out: string, label: string): [number, number] {
  const lines = out.split('\n')
  const row = lines.findIndex((l) => l.includes(label))
  return [row, lines[row]!.indexOf(label) + label.length / 2]
}

describe('architecture side hints (#2724)', () => {
  it.each(CASES)('SVG: %s', (_n, src) => {
    expect(renderMermaidSVG(src)).toMatchSnapshot()
  })
  it.each(CASES)('ASCII: %s', (_n, src) => {
    expect(renderMermaidASCII(src)).toMatchSnapshot()
  })

  const out = renderMermaidASCII(GALLERY_94)

  it('puts Web above Cloud, Disk below Server, Database left of Server', () => {
    const [webRow, webCol] = at(out, 'Web')
    const [cloudRow, cloudCol] = at(out, 'Cloud')
    expect(webRow).toBeLessThan(cloudRow)
    expect(Math.abs(webCol - cloudCol)).toBeLessThanOrEqual(2)
    const [serverRow, serverCol] = at(out, 'Server')
    const [diskRow, diskCol] = at(out, 'Disk')
    expect(diskRow).toBeGreaterThan(serverRow)
    expect(Math.abs(diskCol - serverCol)).toBeLessThanOrEqual(2)
    expect(at(out, 'Database')[1]).toBeLessThan(serverCol)
    expect(at(out, 'Database')[0]).toBe(serverRow)
  })

  it('keeps Unknown Icon right of Web and No Icon right of Disk on their rows', () => {
    expect(at(out, 'Unknown Icon')[0]).toBe(at(out, 'Web')[0])
    expect(at(out, 'Unknown Icon')[1]).toBeGreaterThan(at(out, 'Web')[1])
    expect(at(out, 'No Icon')[0]).toBe(at(out, 'Disk')[0])
    expect(at(out, 'No Icon')[1]).toBeGreaterThan(at(out, 'Disk')[1])
  })

  it('stacks a vertical chain top to bottom', () => {
    const v = renderMermaidASCII(CHAIN)
    expect(at(v, 'A')[0]).toBeLessThan(at(v, 'B')[0])
    expect(at(v, 'B')[0]).toBeLessThan(at(v, 'C')[0])
  })
})
