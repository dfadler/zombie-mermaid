/**
 * #2564: a group's icon reaches the positioned group in every layout path
 * (ELK, the nested ELK arrangement, and `layout: 'simple'`), and a group
 * without one carries none.
 */
import { describe, expect, it } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import type { PositionedGroup } from '@zombie-mermaid/core'
import {
  architectureToGraph,
  parseArchitecture,
} from '@zombie-mermaid/mermaid-parser'
import { layoutFlowchartSync } from '../index.ts'

const SOURCE = `architecture-beta
  group a(server)[A]
  group b[B]
  service s(cloud)[S] in a
  service t(cloud)[T] in b
  s:R -- L:t`
const graph = () =>
  architectureToGraph(parseArchitecture(splitStatements(SOURCE)))
const byId = (groups: PositionedGroup[], id: string) =>
  groups.find((g) => g.id === id)!

describe('group icon through each layout (#2564)', () => {
  it.each([['default'], ['simple']] as const)('%s layout', (layout) => {
    const g = layoutFlowchartSync(
      graph(),
      layout === 'simple' ? { layout } : {},
    )
    expect(byId(g.groups, 'a').icon).toBe('server')
    expect(byId(g.groups, 'b').icon).toBeUndefined()
  })
})
