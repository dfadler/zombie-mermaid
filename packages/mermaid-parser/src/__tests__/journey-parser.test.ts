/**
 * Journey parser. Expectations follow Mermaid's own jison lexer and journeyDb
 * (mermaid@12.3.0, diagrams/user-journey).
 */
import { describe, it, expect } from 'vitest'
import { MermaidParseError } from '@zombie-mermaid/core'
import { parseJourney } from '../journey/parser.ts'

describe('parseJourney', () => {
  it('parses title, sections, scores and actors', () => {
    const j = parseJourney(`journey
    title My day
    section Work
      Make tea: 5: Me
      Do work: 1: Me, Cat
    section Home
      Sit: 3`)
    expect(j.title).toBe('My day')
    expect(j.sections).toEqual(['Work', 'Home'])
    expect(j.tasks).toEqual([
      { section: 'Work', name: 'Make tea', score: 5, actors: ['Me'] },
      { section: 'Work', name: 'Do work', score: 1, actors: ['Me', 'Cat'] },
      { section: 'Home', name: 'Sit', score: 3, actors: [] },
    ])
    expect(j.actors).toEqual(['Cat', 'Me'])
  })

  it('keeps a non-numeric score as NaN and ignores a third piece', () => {
    const j = parseJourney('journey\na: x: Me: ignored\nb: 7.5: ')
    expect(j.tasks[0]!.score).toBeNaN()
    expect(j.tasks[0]!.actors).toEqual(['Me'])
    expect(j.tasks[1]!.score).toBe(7.5)
    expect(j.tasks[1]!.actors).toEqual([''])
  })

  it('allows tasks before any section, with section ""', () => {
    const j = parseJourney('journey\nA: 1: X\nsection S\nB: 2: X')
    expect(j.tasks.map((t) => t.section)).toEqual(['', 'S'])
  })

  it('treats # as a comment, case-insensitive keywords, and %% lines', () => {
    const j = parseJourney(
      'JOURNEY\n%% note\nTITLE T # c\nSECTION S\nA: 2: B # c',
    )
    expect(j.title).toBe('T')
    expect(j.sections).toEqual(['S'])
    expect(j.tasks[0]).toMatchObject({ name: 'A', score: 2, actors: ['B'] })
  })

  it('keeps the last title and lets a bare journey be valid', () => {
    expect(parseJourney('journey\ntitle A\ntitle B').title).toBe('B')
    expect(parseJourney('journey').tasks).toEqual([])
  })

  it('removes %%{init}%% directives', () => {
    expect(
      parseJourney('%%{init: {"theme":"dark"}}%%\njourney\nA: 1').tasks,
    ).toHaveLength(1)
  })

  it('sorts actors with Array.sort order', () => {
    const j = parseJourney('journey\nA: 1: b, B, a')
    expect(j.actors).toEqual(['B', 'a', 'b'])
  })

  it.each([
    ['no header', 'section S'],
    ['missing score', 'journey\nTask only'],
    ['semicolon', 'journey\nA: 1: Me; B: 2'],
    ['second header', 'journey\njourney'],
    ['leading colon', 'journey\n: 3'],
    ['score on next line', 'journey\nA\n: 3'],
  ])('rejects %s', (_n, src) => {
    expect(() => parseJourney(src)).toThrow(MermaidParseError)
  })

  it('reports the line of a task missing its score', () => {
    expect(() => parseJourney('journey\n\nA')).toThrow(/Line 3/)
  })
})
