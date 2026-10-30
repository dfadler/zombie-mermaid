import type { FacePolicy } from '../../packages/ascii-layout/src/index.ts'

const POLICIES: readonly FacePolicy[] = ['merge-then-grow', 'grow-only']

/** Read `--policy=` from argv; report an unsupported value and exit(1) instead of crashing later. */
export function parsePolicy(
  argv: readonly string[],
  exit: (code: number) => never = process.exit,
): FacePolicy {
  const arg = argv.find((a) => a.startsWith('--policy='))?.slice(9)
  const policy = (arg ?? 'merge-then-grow') as FacePolicy
  if (!POLICIES.includes(policy)) {
    console.error(
      `Invalid --policy=${JSON.stringify(arg)}; supported values: ${POLICIES.join(', ')}`,
    )
    return exit(1)
  }
  return policy
}
