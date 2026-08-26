import { createRequire } from 'node:module'
import { parseArgs } from './cli/parse-args.ts'
import type { CliArgs } from './cli/parse-args.ts'
import { runRender } from './cli/render.ts'
import { THEMES } from './theme.ts'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

async function main() {
  const argv = process.argv.slice(2)

  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }

  switch (args.command) {
    case 'help':
      printHelp()
      break

    case 'version':
      console.log(`zombie-mermaid ${pkg.version}`)
      break

    case 'themes':
      console.log('Available themes:\n')
      for (const name of Object.keys(THEMES)) {
        console.log(`  ${name}`)
      }
      break

    case 'render':
      try {
        await runRender(args)
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(1)
      }
      break
  }
}

function printHelp() {
  console.log(
    `
zombie-mermaid — render Mermaid diagrams from the command line

Usage:
  zombie-mermaid render <file> --ascii              Render to ASCII in terminal
  zombie-mermaid render <file> --svg -o <out.svg>   Render to SVG file
  zombie-mermaid render <file> --ascii --svg -o <out.svg>   Both
  cat file.mmd | zombie-mermaid render --ascii      Read from stdin
  zombie-mermaid themes                             List available themes
  zombie-mermaid --help                             Show this help
  zombie-mermaid --version                          Show version

Options:
  --ascii          Print ASCII/Unicode diagram to terminal
  --svg            Render SVG (requires -o)
  -o, --output     Output file path for SVG
  --theme <name>   Apply a built-in theme (see 'themes' command)
  -h, --help       Show help
  -v, --version    Show version
`.trim(),
  )
}

main()
