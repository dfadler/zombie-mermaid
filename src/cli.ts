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
  zombie-mermaid render <file> --svg                Render to <file stem>.svg
  zombie-mermaid render <file> --svg -o <out.svg>   Render to a named SVG file
  zombie-mermaid render <file> -o out.svg           Format inferred from the extension
  zombie-mermaid render <file> --svg -o -           Write SVG to stdout
  zombie-mermaid render <file> --ascii --svg -o <out.svg>   Both (ASCII to terminal)
  zombie-mermaid render <file> --html               Self-contained pan/zoom HTML viewer
  cat file.mmd | zombie-mermaid render --ascii      Read from stdin
  zombie-mermaid themes                             List available themes
  zombie-mermaid web [--port <n>]                   Start a local web UI (default port: 3000)
  zombie-mermaid mcp                                Start an MCP server on stdio (render tools)
  zombie-mermaid --help                             Show this help
  zombie-mermaid --version                          Show version

Options:
  --ascii              Print ASCII/Unicode diagram to terminal, or to -o <file.txt>
                       when it is the only format
  --svg                Render SVG to -o <path> (default: <input stem>.svg;
                       stdin input must give -o)
  --html               Render a self-contained HTML pan/zoom viewer to -o
                       <path> (default: <input stem>.html). Embeds the SVG;
                       no server, no network, opens from disk. Cannot be
                       combined with --svg (different content, same slot).
  -o, --output <path>  Output file for the SVG/HTML (or for ASCII when
                       neither is given). '-' writes to stdout. A .svg,
                       .html, or .txt extension selects the format when no
                       --svg/--html/--ascii flag is given; one that
                       contradicts the flags is an error. Existing files
                       are never overwritten without --force.
  -f, --force          Overwrite an existing output file
  --theme <name>       Apply a built-in theme (see 'themes' command)
  --direction <dir>    Override the diagram's layout direction: TD, TB, BT, LR, or RL
                       (flowchart, state, and ER diagrams; nested subgraph
                       directions still apply on top of it)
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
