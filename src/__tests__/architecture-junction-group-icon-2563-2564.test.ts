/**
 * #2563 / #2564: mermaid 12.2.0 and 12.3.0 (the pin and npm latest when
 * written) draw an architecture junction as an invisible join (an 80x80 rect
 * with fill-opacity 0) and put a group's icon, a 30px tile, in its header.
 * ASCII has no icons and draws the junction as a plain line join (#2725).
 */
// Provenance (#2679): the .snap is this renderer's own output, accepted once when the test was written. It does not claim to match mermaid.js.
// Mermaid 12.3.0 verdict (#2708): matches (label level, 2 sources); SVG viewBox within 26px of mermaid (649x463 vs 640x460, 574x345 vs 600x340), not analysed further.
import { describe, expect, it } from 'vitest'
import { renderMermaidASCII, renderMermaidSVG } from '../index.ts'

const CASES: [string, string][] = [
  [
    'junction',
    `architecture-beta
  group cloud(cloud)[Cloud]
  service gw(internet)[Gateway] in cloud
  service db(database)[Primary DB] in cloud
  service replica(disk)[Replica] in cloud
  junction fan in cloud
  gw:R -- L:fan
  fan:R --> L:db
  fan:B --> T:replica`,
  ],
  [
    'group icons',
    `architecture-beta
  group cloud(cloud)[Cloud]
  group api(server)[API Tier] in cloud
  group data(database)[Data Tier] in cloud
  service gw(internet)[Gateway] in api
  service db(database)[Primary DB] in data
  gw:R --> L:db`,
  ],
]

describe('architecture junction and group icons (#2563, #2564)', () => {
  it.each(CASES)('SVG: %s', (_n, source) => {
    expect(renderMermaidSVG(source)).toMatchSnapshot()
  })
  it.each(CASES)('ASCII: %s', (_n, source) => {
    expect(renderMermaidASCII(source)).toMatchSnapshot()
  })
})
