/**
 * Regenerates the committed API reports (`etc/api/*.api.md`, #1870) from each
 * entry's built, rolled `.d.ts`. Run `pnpm run build` first. Report-only:
 * always writes; CI (`api-report` job) diffs the result against the commit.
 *
 * Usage: pnpm run build && pnpm run api:report
 */
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ENTRIES: Record<string, string> = {
  'zombie-mermaid': 'dist/index.d.ts',
  'zombie-mermaid-ascii': 'dist/ascii.d.ts',
  'zombie-mermaid-mcp': 'dist/mcp.d.ts',
  core: 'packages/core/dist/index.d.ts',
  'mermaid-parser': 'packages/mermaid-parser/dist/index.d.ts',
  'svg-renderer': 'packages/svg-renderer/dist/index.d.ts',
  'ascii-renderer': 'packages/ascii-renderer/dist/index.d.ts',
  'packages-mcp': 'packages/mcp/dist/index.d.ts',
}

let failed = false
for (const [name, dts] of Object.entries(ENTRIES)) {
  if (process.argv[2] && process.argv[2] !== name) continue
  const config = ExtractorConfig.prepare({
    configObject: {
      projectFolder: ROOT,
      mainEntryPointFilePath: resolve(ROOT, dts),
      // No tsconfig `paths` (they point at src/): resolve cross-package imports
      // to the built, published d.ts through node_modules, like a consumer.
      compiler: {
        overrideTsconfig: {
          compilerOptions: {
            target: 'ESNext',
            module: 'ESNext',
            moduleResolution: 'bundler',
            skipLibCheck: true,
            types: ['node'],
            lib: ['ESNext'],
          },
        },
      },
      apiReport: {
        enabled: true,
        reportFileName: `${name}.api.md`,
        reportFolder: resolve(ROOT, 'etc/api'),
        reportTempFolder: resolve(ROOT, 'temp/api'),
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: {
        extractorMessageReporting: {
          default: { logLevel: 'none' },
        },
        tsdocMessageReporting: { default: { logLevel: 'none' } },
      },
    },
    configObjectFullPath: resolve(ROOT, 'api-extractor.json'),
    packageJsonFullPath: resolve(ROOT, 'package.json'),
  })
  const result = Extractor.invoke(config, { localBuild: true })
  if (!result.succeeded) failed = true
}
process.exit(failed ? 1 : 0)
