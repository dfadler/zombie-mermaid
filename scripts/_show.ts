import { readFileSync } from 'node:fs'
import { parseMermaid } from '../src/index.ts'
import { protoBoxes } from './_elk-proto.ts'
import { samples } from '../samples/samples-data.ts'
const refs = JSON.parse(readFileSync(process.env.SCORE_CACHE!, 'utf8'))
const extra = JSON.parse(readFileSync(process.env.EXTRA!, 'utf8'))
const t = process.argv[2]!
const src = [...extra, ...samples].find((s: any) => s.title === t)!.source
const p = protoBoxes(parseMermaid(src))
const c = (b: any) => `(${Math.round(b.x + b.w / 2)},${Math.round(b.y + b.h / 2)}) ${Math.round(b.w)}x${Math.round(b.h)}`
for (const id of Object.keys(refs[t].nodes)) console.log(id.padEnd(6), 'ref', c(refs[t].nodes[id]).padEnd(22), 'proto', p.nodes[id] ? c(p.nodes[id]) : '-')
for (const id of Object.keys(refs[t].groups)) console.log('G', id, 'ref', c(refs[t].groups[id]), 'proto', p.groups[id] ? c(p.groups[id]) : '-')
