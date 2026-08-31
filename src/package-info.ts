// ============================================================================
// zombie-mermaid — package.json version lookup
//
// Shared by anything that needs to report its own version at runtime (the
// CLI's `--version`/`-v`, the MCP server's `Implementation.version`). Reads
// package.json via createRequire rather than importing it as JSON, since
// this file is consumed by both the ESM CLI build and (via src/mcp) the
// dual ESM/CJS library build.
// ============================================================================

import { createRequire } from 'node:module'

/**
 * Read the running package's version from package.json, next to this file
 * at both source (`src/`) and build (`dist/`) depth — one directory up in
 * both locations.
 *
 * @returns The version string, or `'unknown'` if package.json is missing
 *   the field or isn't shaped as expected.
 */
export function getPackageVersion(): string {
  const require = createRequire(import.meta.url)
  const pkg: unknown = require('../package.json')
  return typeof pkg === 'object' &&
    pkg !== null &&
    'version' in pkg &&
    typeof pkg.version === 'string'
    ? pkg.version
    : 'unknown'
}
