import { cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stampFile } from '../../../scripts/build-stamp.ts'

/** Import the built render module, loop its route table, write files, copy `public/`. */
export async function prerender(
  ssrDir: string,
  clients: Record<string, string>,
  outDir: string,
) {
  const { renderSite } = await import(
    pathToFileURL(join(ssrDir, 'entry-server.js')).href
  )
  const routes: Map<string, string> = await renderSite(clients)
  await Promise.all(
    [...routes].map(async ([path, content]) => {
      const file = join(outDir, path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, stampFile(pathToFileURL(file), content), 'utf8')
    }),
  )
  await cp('public', outDir, { recursive: true })
  console.log(`prerendered ${routes.size} files to ${outDir}`)
}
