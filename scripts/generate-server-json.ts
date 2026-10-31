// Print the MCP Registry server.json for package.json's version (#2479). Logic: scripts/lib/mcp-server-json.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { buildServerJson, validateServerJson } from './lib/mcp-server-json.ts'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const server = buildServerJson(pkg)
const errors = validateServerJson(server, pkg)
if (errors.length) {
  for (const e of errors) console.error(`error: server.json: ${e}`)
  process.exit(1)
}
const out = process.argv[2] === '--out' ? process.argv[3] : undefined
const text = `${JSON.stringify(server, null, 2)}\n`
if (out) writeFileSync(out, text)
else process.stdout.write(text)
