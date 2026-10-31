/**
 * Build and validate the MCP Registry `server.json` for the current release (#2479).
 *
 * Sources: https://modelcontextprotocol.io/registry/quickstart (shape, `name` must equal
 * `mcpName`), https://modelcontextprotocol.io/registry/package-types (npm: `registryType`
 * "npm", ownership via `mcpName`). The schema is the dated, immutable copy the `$schema`
 * URL names, vendored in `mcp-registry-server.schema.json`, so validation is hermetic.
 */
import { readFileSync } from 'node:fs'
import Ajv from 'ajv'

export const SCHEMA_URL =
  'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json'

// package.json's description is longer than the schema's maxLength of 100.
export const DESCRIPTION =
  'Render Mermaid diagrams to SVG or ASCII art, validate syntax, and fix sequence activations.'

export interface PkgJson {
  name?: string
  version?: string
  mcpName?: string
  repository?: { url?: string }
}

export function buildServerJson(pkg: PkgJson): Record<string, unknown> {
  const { name, version, mcpName, repository } = pkg
  if (!name || !version || !mcpName || !repository?.url) {
    throw new Error(
      'package.json needs name, version, mcpName and repository.url',
    )
  }
  return {
    $schema: SCHEMA_URL,
    name: mcpName,
    description: DESCRIPTION,
    repository: {
      url: repository.url.replace(/\.git$/, ''),
      source: 'github',
    },
    version,
    packages: [
      {
        registryType: 'npm',
        identifier: name,
        version,
        transport: { type: 'stdio' },
        // src/cli.ts `case 'mcp'` starts the stdio server; bare `zombie-mermaid` does not.
        packageArguments: [{ type: 'positional', value: 'mcp' }],
      },
    ],
  }
}

/** Schema errors plus the cross-field rules the schema cannot express. Empty = valid. */
export function validateServerJson(
  server: unknown,
  pkg: PkgJson,
  schema: object = JSON.parse(
    readFileSync(
      new URL('./mcp-registry-server.schema.json', import.meta.url),
      'utf8',
    ),
  ),
): string[] {
  // Formats ("uri") are skipped: the registry's own checks are the authority there.
  const validate = new Ajv({ strict: false, validateFormats: false }).compile(
    schema,
  )
  const errors: string[] = validate(server)
    ? []
    : (validate.errors ?? []).map(
        (e) => `${e.instancePath || '/'} ${e.message}`,
      )
  const s = (server ?? {}) as {
    name?: string
    version?: string
    packages?: { identifier?: string; version?: string }[]
  }
  if (s.name !== pkg.mcpName)
    errors.push(`name ${s.name} != package.json mcpName ${pkg.mcpName}`)
  if (s.version !== pkg.version)
    errors.push(`version ${s.version} != package.json ${pkg.version}`)
  const p = s.packages?.[0]
  if (p?.identifier !== pkg.name)
    errors.push(`packages[0].identifier ${p?.identifier} != ${pkg.name}`)
  if (p?.version !== pkg.version)
    errors.push(`packages[0].version ${p?.version} != ${pkg.version}`)
  return errors
}
