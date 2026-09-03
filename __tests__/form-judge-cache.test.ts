import { describe, it, expect } from 'vitest'
import {
  normalizeSvgForHash,
  computeContentHash,
  renderIdFor,
  parseCacheFile,
  rewriteVerdictId,
  buildReducedSetAndSeededResults,
  finalizeCache,
  type CacheFile,
} from '../scripts/lib/form-judge-cache.ts'
import type { IndexEntry, SampleFile } from '../scripts/form-facts.ts'

function makeIndexEntry(overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    id: 'form-5-state-basic-state-diagram',
    category: 'State',
    title: 'State: Basic State Diagram',
    path: '/tmp/form-5-state-basic-state-diagram.json',
    judgeable: true,
    mermaidError: null,
    asciiError: null,
    ...overrides,
  }
}

function makeSampleFile(overrides: Partial<SampleFile> = {}): SampleFile {
  return {
    id: 'form-5-state-basic-state-diagram',
    category: 'State',
    title: 'State: Basic State Diagram',
    source: 'stateDiagram-v2\n  [*] --> Idle',
    trimmedSvg:
      '<svg id="form_5_state_basic_state_diagram"><g id="form_5_state_basic_state_diagram-Idle-1"></g></svg>',
    mermaidError: null,
    asciiText: '+------+\n| Idle |\n+------+',
    asciiError: null,
    ...overrides,
  }
}

describe('renderIdFor', () => {
  it('mirrors form-facts.ts: hyphens become underscores', () => {
    expect(renderIdFor('form-5-state-basic-state-diagram')).toBe(
      'form_5_state_basic_state_diagram',
    )
  })
})

describe('normalizeSvgForHash', () => {
  it('strips every occurrence of renderId out of the svg', () => {
    const svg = '<svg id="form_5_x"><g id="form_5_x-edge0"/></svg>'
    expect(normalizeSvgForHash(svg, 'form_5_x')).toBe(
      '<svg id=" RENDER_ID "><g id=" RENDER_ID -edge0"/></svg>',
    )
  })

  it('returns the svg unchanged when renderId is empty', () => {
    const svg = '<svg id="x"></svg>'
    expect(normalizeSvgForHash(svg, '')).toBe(svg)
  })
})

describe('computeContentHash', () => {
  it('is stable across a renderId shift for identical diagram content (the bug this exists to prevent)', () => {
    // Simulates an unrelated sample being inserted earlier in
    // samples-data.ts, which shifts this sample's array-index-derived id
    // and therefore its mermaid-embedded renderId, with zero actual change
    // to the diagram content being compared.
    const asciiText = '+------+\n| Idle |\n+------+'
    const svgA = '<svg id="form_29_x"><g id="form_29_x-Idle-1"/></svg>'
    const svgB = '<svg id="form_30_x"><g id="form_30_x-Idle-1"/></svg>'

    const hashA = computeContentHash(svgA, asciiText, 'form_29_x')
    const hashB = computeContentHash(svgB, asciiText, 'form_30_x')

    expect(hashA).toBe(hashB)
  })

  it('changes when the diagram content genuinely changes', () => {
    const renderId = 'form_5_x'
    const svg = '<svg id="form_5_x"></svg>'
    const hashBefore = computeContentHash(svg, 'before', renderId)
    const hashAfter = computeContentHash(svg, 'after', renderId)
    expect(hashBefore).not.toBe(hashAfter)
  })

  it('does not overcorrect: different content under the same renderId still differs', () => {
    const renderId = 'form_5_x'
    const svgA = '<svg id="form_5_x"><g id="form_5_x-Idle-1"/></svg>'
    const svgB =
      '<svg id="form_5_x"><g id="form_5_x-Idle-1"/><g id="form_5_x-Running-2"/></svg>'
    expect(computeContentHash(svgA, 'ascii', renderId)).not.toBe(
      computeContentHash(svgB, 'ascii', renderId),
    )
  })
})

describe('parseCacheFile', () => {
  it('returns an empty object for null input', () => {
    expect(parseCacheFile(null)).toEqual({})
  })

  it('returns an empty object for malformed JSON without throwing', () => {
    expect(() => parseCacheFile('{not json')).not.toThrow()
    expect(parseCacheFile('{not json')).toEqual({})
  })

  it('returns an empty object when the JSON is not a plain object (e.g. an array)', () => {
    expect(parseCacheFile('[1,2,3]')).toEqual({})
  })

  it('parses a valid cache file', () => {
    const raw = JSON.stringify({
      'State: Basic': { hash: 'abc', verdictLine: '{}' },
    })
    expect(parseCacheFile(raw)).toEqual({
      'State: Basic': { hash: 'abc', verdictLine: '{}' },
    })
  })
})

describe('rewriteVerdictId', () => {
  it('replaces the id field on a valid verdict line', () => {
    const line = JSON.stringify({
      id: 'old-id',
      title: 'X',
      faithful: true,
      findings: [],
    })
    const rewritten = rewriteVerdictId(line, 'new-id')
    expect(JSON.parse(rewritten)).toEqual({
      id: 'new-id',
      title: 'X',
      faithful: true,
      findings: [],
    })
  })

  it('returns the line unchanged if it is not valid JSON', () => {
    expect(rewriteVerdictId('not json', 'new-id')).toBe('not json')
  })
})

describe('buildReducedSetAndSeededResults', () => {
  it('resolves a non-judgeable entry deterministically without any hash or LLM involvement', () => {
    const index = [
      makeIndexEntry({
        judgeable: false,
        mermaidError: 'Parse error on line 2',
      }),
    ]
    const result = buildReducedSetAndSeededResults(index, new Map(), {})

    expect(result.combinedData).toEqual([])
    expect(result.hashSideFile).toEqual({})
    expect(JSON.parse(result.seededResultLines[0]!)).toEqual({
      id: 'form-5-state-basic-state-diagram',
      title: 'State: Basic State Diagram',
      skipped: true,
      reason: 'Parse error on line 2',
    })
  })

  it('includes a judgeable cache-miss in the reduced set, not the seeded results', () => {
    const entry = makeIndexEntry()
    const facts = makeSampleFile()
    const index = [entry]
    const factsById = new Map([[entry.id, facts]])

    const result = buildReducedSetAndSeededResults(index, factsById, {})

    expect(result.seededResultLines).toEqual([])
    expect(result.combinedData).toEqual([
      {
        id: facts.id,
        title: facts.title,
        source: facts.source,
        trimmedSvg: facts.trimmedSvg,
        asciiText: facts.asciiText,
      },
    ])
    expect(result.hashSideFile[entry.title]).toBeTruthy()
  })

  it('excludes a judgeable cache-hit from the reduced set and seeds its verdict with the current id', () => {
    const entry = makeIndexEntry()
    const facts = makeSampleFile()
    const renderId = renderIdFor(entry.id)
    const hash = computeContentHash(
      facts.trimmedSvg!,
      facts.asciiText!,
      renderId,
    )
    const cache: CacheFile = {
      [entry.title]: {
        hash,
        verdictLine: JSON.stringify({
          id: 'stale-id-from-last-week',
          title: entry.title,
          faithful: true,
          findings: [],
        }),
      },
    }
    const factsById = new Map([[entry.id, facts]])

    const result = buildReducedSetAndSeededResults([entry], factsById, cache)

    expect(result.combinedData).toEqual([])
    expect(JSON.parse(result.seededResultLines[0]!)).toEqual({
      id: entry.id, // rewritten to this run's id, not the stale cached one
      title: entry.title,
      faithful: true,
      findings: [],
    })
  })

  it('treats a stale hash (content changed) as a cache miss, not a hit', () => {
    const entry = makeIndexEntry()
    const facts = makeSampleFile()
    const cache: CacheFile = {
      [entry.title]: {
        hash: 'a-hash-from-different-content',
        verdictLine: JSON.stringify({
          id: 'old',
          title: entry.title,
          faithful: true,
          findings: [],
        }),
      },
    }
    const factsById = new Map([[entry.id, facts]])

    const result = buildReducedSetAndSeededResults([entry], factsById, cache)

    expect(result.combinedData).toHaveLength(1)
    expect(result.seededResultLines).toEqual([])
  })
})

describe('finalizeCache', () => {
  it('caches a fresh verdict line using its recorded hash', () => {
    const line = JSON.stringify({
      id: 'x',
      title: 'State: Basic',
      faithful: true,
      findings: [],
    })
    const hashSideFile = { 'State: Basic': 'the-hash' }

    const cache = finalizeCache([line], hashSideFile)

    expect(cache).toEqual({
      'State: Basic': { hash: 'the-hash', verdictLine: line },
    })
  })

  it('never caches a skipped verdict', () => {
    const line = JSON.stringify({
      id: 'x',
      title: 'State: Basic',
      skipped: true,
      reason: 'boom',
    })
    const cache = finalizeCache([line], { 'State: Basic': 'the-hash' })
    expect(cache).toEqual({})
  })

  it('drops a title with no recorded hash (never cache something we cannot verify next run)', () => {
    const line = JSON.stringify({
      id: 'x',
      title: 'Untracked',
      faithful: true,
      findings: [],
    })
    const cache = finalizeCache([line], {})
    expect(cache).toEqual({})
  })

  it('drops entries with no verdict line at all — the timeout-mid-batch case', () => {
    // Two samples were hashed this run (both cache misses), but only one
    // made it into the final results before the run was cut off.
    const hashSideFile = { Judged: 'hash-1', NeverWritten: 'hash-2' }
    const finalLines = [
      JSON.stringify({
        id: 'a',
        title: 'Judged',
        faithful: true,
        findings: [],
      }),
    ]

    const cache = finalizeCache(finalLines, hashSideFile)

    expect(Object.keys(cache)).toEqual(['Judged'])
    expect(cache['NeverWritten']).toBeUndefined()
  })

  it('skips a malformed line without throwing', () => {
    expect(() => finalizeCache(['not json', ''], {})).not.toThrow()
    expect(finalizeCache(['not json', ''], {})).toEqual({})
  })
})
