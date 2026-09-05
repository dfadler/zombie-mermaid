import { parseArgs } from './cli/parse-args.ts'
import type { CliArgs } from './cli/parse-args.ts'
import { runRender } from './cli/render.ts'
import { runWeb } from './cli/web.ts'
import { runMcp } from './cli/mcp.ts'
import { THEMES } from './theme.ts'
import { getPackageVersion } from './package-info.ts'

const pkgVersion = getPackageVersion()

export async function main() {
  const argv = process.argv.slice(2)

  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  switch (args.command) {
    case 'help':
      printHelp()
      break

    case 'version':
      console.log(`zombie-mermaid ${pkgVersion}`)
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
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        )
        process.exit(1)
      }
      break

    case 'web':
      try {
        await runWeb(args)
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        )
        process.exit(1)
      }
      break

    case 'mcp':
      try {
        await runMcp()
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        )
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
  zombie-mermaid web [--port <n>]                   Start a local web UI (default port: 3000)
  zombie-mermaid mcp                                Start an MCP server on stdio (render tools)
  zombie-mermaid --help                             Show this help
  zombie-mermaid --version                          Show version

Options:
  --ascii              Print ASCII/Unicode diagram to terminal
  --svg                Render SVG (requires -o)
  --resolve-colors     Replace CSS var()/color-mix() in the SVG with computed
                       sRGB values, for rasterizers and other non-browser SVG
                       consumers (resvg, librsvg, Inkscape) that don't
                       evaluate them. The default output stays a live function
                       of its CSS variables. Requires --svg.
  -o, --output         Output file path for SVG
  --theme <name>       Apply a built-in theme (see 'themes' command)
  -x, --paddingX <n>   Horizontal spacing between nodes (ASCII, default: 5)
  -y, --paddingY <n>   Vertical spacing between nodes (ASCII, default: 5)
  -p, --borderPadding <n>  Padding inside node boxes (ASCII, default: 1)
  --coords             Overlay row/column index rulers (ASCII, debug layout)
  -w, --max-width <n|auto>  Fit ASCII output within this many columns
                       ('auto' detects the terminal width): applies compact
                       spacing automatically when needed, and warns on
                       stderr if it still doesn't fit (no label wrapping or
                       direction-flip — see issue #335).
  --port <n>           Port for the 'web' command (default: 3000)
  -h, --help           Show help
  -v, --version        Show version
`.trim(),
  )
}

main()
