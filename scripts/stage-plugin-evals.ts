// Stage `.claude` without worktrees for `claude plugin eval` (#3170).
// Run: dest=$(pnpm -s run stage:plugin-evals) && claude plugin eval "$dest" ...
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stagePluginEvals } from './lib/stage-plugin-evals.ts'

const dest = join(mkdtempSync(join(tmpdir(), 'plugin-evals-')), '.claude')
stagePluginEvals('.claude', dest)
console.log(dest)
