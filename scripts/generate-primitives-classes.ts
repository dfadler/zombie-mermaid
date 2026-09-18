/**
 * Writes `demo/components/generated/primitives-classes.ts` — the hashed
 * `primitives.module.css` classes map (zombie-mermaid#969) as a plain,
 * dependency-free object literal that `primitives.tsx` can import safely
 * from a browser bundle.
 *
 * Why this needs to be generated rather than imported live: `primitives.tsx`
 * is shared between SSR (`*-page.tsx`) and browser-hydrated (`*-app.tsx`)
 * code, so it can never import `scripts/load-css-module.ts` directly — that
 * module calls Vite's `build()` API and therefore depends on Node built-ins
 * (`vite`, transitively `esbuild`/`child_process`) that break a browser
 * bundle (see `primitives-css.tsx`'s header comment, which hit this
 * empirically while opening the seam in #938). Before #969, that was moot:
 * classes were unhashed, so the literal strings in primitives.tsx and the
 * compiled CSS in primitives-css.tsx were guaranteed to match without
 * either file needing to import from the other. Now that
 * `primitives.module.css` is hashed, something has to compute the actual
 * hashed names — `loadCssModule` already does, deterministically, from the
 * file's own content — and hand them to primitives.tsx as plain data. This
 * script is that step, run once whenever `primitives.module.css` changes,
 * with its committed output checked for staleness by
 * `__tests__/css-module-classes-usage.test.ts`.
 */
import { writeFile } from 'node:fs/promises'
import { loadCssModule } from './load-css-module.ts'

export interface PrimitivesClasses {
  card: string
  pill: string
  'section-eyebrow': string
}

const PRIMITIVES_MODULE_CSS = new URL(
  '../demo/components/primitives.module.css',
  import.meta.url,
)

const OUTPUT_PATH = new URL(
  '../demo/components/generated/primitives-classes.ts',
  import.meta.url,
)

function generatedTsContent(classes: PrimitivesClasses): string {
  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with \`pnpm run generate:primitives-classes\`
 * (scripts/generate-primitives-classes.ts) whenever
 * demo/components/primitives.module.css changes — see that script's header
 * comment for why this exists instead of a live import.
 */

/** \`primitives.module.css\`'s source class name -> hashed output class
 * name, imported by primitives.tsx (browser-safe: no Node dependency). */
export const PRIMITIVES_CLASSES = ${JSON.stringify(classes, null, 2)} as const
`
}

async function main(): Promise<void> {
  const { classes } = await loadCssModule<PrimitivesClasses>(
    PRIMITIVES_MODULE_CSS,
  )
  const content = generatedTsContent(classes)
  await writeFile(OUTPUT_PATH, content, 'utf8')
  console.log(
    `Wrote ${content.length} bytes to demo/components/generated/primitives-classes.ts`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
