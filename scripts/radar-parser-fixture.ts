/**
 * Writes __tests__/fixtures/radar-parser-official-12.3.0.json (#2814): for each
 * source below, what Mermaid's own radar parser (`@mermaid-js/parser`, the
 * Langium grammar mermaid 12.3.0 ships) and database make of it, so
 * __tests__/radar-parser-agreement.test.ts can check `parseRadar` against it.
 * The database step (labels default to names, reference entries in axis
 * order, ticks capped at 32) is copied from mermaid's `diagrams/radar/db.ts`.
 *
 * Usage: RADAR_PARSER=<dir with node_modules/@mermaid-js/parser 12.3.0> \
 *        tsx scripts/radar-parser-fixture.ts <output.json>
 * (`npm install mermaid@12.3.0` in an empty scratch directory provides it.)
 */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { RADAR_PARSER_SOURCES } from './lib/radar-parser-sources.ts'

interface Ast {
  title?: string
  axes: Array<{ name: string; label?: string }>
  curves: Array<{
    name: string
    label?: string
    entries: Array<{ value: number; axis?: { $refText: string } }>
  }>
  options: Array<{ name: string; value: unknown }>
}

const dir = process.env.RADAR_PARSER
const out = process.argv[2]
if (!dir || !out) {
  console.error(
    'usage: RADAR_PARSER=<dir> tsx scripts/radar-parser-fixture.ts <output.json>',
  )
  process.exit(2)
}
const { parse } = (await import(
  pathToFileURL(
    join(dir, 'node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs'),
  ).href
)) as { parse: (type: 'radar', text: string) => Promise<Ast> }

function model(ast: Ast) {
  const axes = ast.axes.map((a) => ({ name: a.name, label: a.label ?? a.name }))
  const curves = ast.curves.map((c) => {
    let entries: number[]
    if (c.entries[0]!.axis === undefined)
      entries = c.entries.map((e) => e.value)
    else {
      if (axes.length === 0)
        throw new Error('Axes must be populated before curves')
      entries = axes.map((axis) => {
        const e = c.entries.find((x) => x.axis?.$refText === axis.name)
        if (!e) throw new Error(`Missing entry for axis ${axis.label}`)
        return e.value
      })
    }
    return { name: c.name, label: c.label ?? c.name, entries }
  })
  const opt = Object.fromEntries(ast.options.map((o) => [o.name, o.value]))
  const ticks = (opt.ticks as number | undefined) ?? 5
  return {
    ...(ast.title ? { title: ast.title } : {}),
    axes,
    curves,
    options: {
      showLegend: (opt.showLegend as boolean | undefined) ?? true,
      ticks: Math.min(ticks, 32),
      max: (opt.max as number | undefined) ?? null,
      min: (opt.min as number | undefined) ?? 0,
      graticule: (opt.graticule as string | undefined) ?? 'circle',
    },
  }
}

const fixture: Record<
  string,
  { source: string; radar?: unknown; error?: true }
> = {}
for (const [name, source] of Object.entries(RADAR_PARSER_SOURCES)) {
  try {
    fixture[name] = { source, radar: model(await parse('radar', source)) }
  } catch {
    fixture[name] = { source, error: true }
  }
}
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n')
console.log(`wrote ${Object.keys(fixture).length} cases to ${out}`)
