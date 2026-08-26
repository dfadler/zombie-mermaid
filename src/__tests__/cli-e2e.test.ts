import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'

// ============================================================================
// Constants
// ============================================================================

// bun:test exposed `import.meta.dir` for this; Node's ESM equivalent is
// deriving the directory from `import.meta.url`.
const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const CLI = join(REPO_ROOT, 'dist/cli.js')

// This suite spawns the actual built CLI binary rather than the TS source,
// so `dist/cli.js` has to exist first. It's gitignored build output, not
// something the repo ships checked in, so CI's fresh checkout (which never
// runs a full `pnpm run build` before the test job) won't have it — only a
// locally-built dev environment happens to. Rebuild here so this suite is
// self-contained regardless of what already ran before it.
beforeAll(() => {
  execFileSync('pnpm', ['run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' })
  if (!existsSync(CLI)) {
    throw new Error(`Expected ${CLI} to exist after 'pnpm run build'`)
  }
}, 60_000)

const SIMPLE_FLOWCHART = `graph LR
  A[Start] --> B[Middle] --> C[End]`

// ============================================================================
// Helpers
// ============================================================================

interface CliResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Run the CLI as a subprocess and collect stdout, stderr, and exit code.
 *
 * Bun.spawn() (upstream) is replaced with Node's child_process.spawn() —
 * this fork runs on Node, not Bun.
 */
async function runCli(args: string[], stdin?: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [CLI, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
    proc.stdout.on('data', (chunk: string) => (stdout += chunk))
    proc.stderr.on('data', (chunk: string) => (stderr += chunk))

    proc.on('error', reject)
    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    if (stdin !== undefined) {
      proc.stdin.write(stdin)
    }
    proc.stdin.end()
  })
}

// ============================================================================
// Temp directory lifecycle
// ============================================================================

let tmpDir: string

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cli-e2e-test-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// help and metadata
// ============================================================================

describe('CLI e2e – help and metadata', () => {
  it('--help prints usage containing "zombie-mermaid" and "render"', async () => {
    const { stdout, exitCode } = await runCli(['--help'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('zombie-mermaid')
    expect(stdout).toContain('render')
  })

  it('--version prints version string and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['--version'])

    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/zombie-mermaid \d+\.\d+\.\d+/)
  })

  it('themes command lists available themes including tokyo-night and dracula', async () => {
    const { stdout, exitCode } = await runCli(['themes'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('tokyo-night')
    expect(stdout).toContain('dracula')
  })
})

// ============================================================================
// render
// ============================================================================

describe('CLI e2e – render', () => {
  it('renders ASCII diagram from file to stdout containing node labels', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { stdout, exitCode } = await runCli(['render', inputPath, '--ascii'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('Middle')
    expect(stdout).toContain('End')
  })

  it('renders ASCII diagram piped via stdin', async () => {
    const { stdout, exitCode } = await runCli(
      ['render', '--ascii'],
      SIMPLE_FLOWCHART,
    )

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('End')
  })

  it('renders SVG and writes output file containing <svg', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'output.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { exitCode } = await runCli([
      'render',
      inputPath,
      '--svg',
      '-o',
      outputPath,
    ])

    expect(exitCode).toBe(0)

    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })

  it('prints ASCII to stdout AND writes SVG to file', async () => {
    const inputPath = join(tmpDir, 'diagram.mmd')
    const outputPath = join(tmpDir, 'both.svg')
    await writeFile(inputPath, SIMPLE_FLOWCHART)

    const { stdout, exitCode } = await runCli([
      'render',
      inputPath,
      '--ascii',
      '--svg',
      '-o',
      outputPath,
    ])

    // ASCII in stdout
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Start')
    expect(stdout).toContain('End')

    // SVG in file
    const svg = await readFile(outputPath, 'utf-8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  })
})

// ============================================================================
// error handling
// ============================================================================

describe('CLI e2e – error handling', () => {
  it('exits 1 and prints "Error" to stderr on unknown command', async () => {
    const { exitCode, stderr } = await runCli(['badcommand'])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Error')
  })

  it('exits 1 when given a file with invalid mermaid syntax', async () => {
    const inputPath = join(tmpDir, 'bad.mmd')
    await writeFile(inputPath, 'this is not valid mermaid syntax at all')

    const { exitCode } = await runCli(['render', inputPath, '--ascii'])

    expect(exitCode).toBe(1)
  })
})
