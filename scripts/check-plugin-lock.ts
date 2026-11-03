// Check plugins/claude: pin agrees with the shrinkwrap, and the shrinkwrap
// installs (#2503). Run: pnpm run check:plugin-lock
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pluginLockProblems } from './lib/plugin-lock.ts'

const dir = 'plugins/claude'
const read = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
const problems = pluginLockProblems(
  read('package.json'),
  read('npm-shrinkwrap.json'),
)
const npm = spawnSync('npm', ['ci', '--dry-run', '--ignore-scripts'], {
  cwd: dir,
  stdio: 'inherit',
})
if (npm.status !== 0) problems.push('npm ci --dry-run failed')
for (const p of problems) console.error(`error: ${dir}: ${p}`)
process.exitCode = problems.length ? 1 : 0
