// Imported first by cli.ts: ESM evaluates imports in order, so this runs
// before heavier modules that may fail to load on an old Node.
import { nodeVersionError } from './node-version.ts'

const message = nodeVersionError(process.versions.node)
if (message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}
