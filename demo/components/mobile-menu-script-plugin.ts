import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { minifySync, transformWithOxc, type Plugin } from 'vite'

const ID = 'virtual:mobile-menu-script'
const SOURCE = fileURLToPath(
  new URL('./mobile-menu.client.ts', import.meta.url),
)

/**
 * Serves `virtual:mobile-menu-script`: `initMobileMenu` from
 * mobile-menu.client.ts, type-stripped and minified at build time, as a
 * parenthesised function expression (#2256). Replaces the hand-pasted literal
 * and, unlike `Function.prototype.toString()`, prints the same whichever
 * bundler ran the page code (#1844).
 */
export function mobileMenuScript(): Plugin {
  return {
    name: 'site:mobile-menu-script',
    resolveId: (id) => (id === ID ? `\0${ID}` : null),
    async load(id) {
      if (id !== `\0${ID}`) return null
      this.addWatchFile(SOURCE)
      const src = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n')
      const start = src.indexOf('export function initMobileMenu')
      const end = src.indexOf('\n}\n', start)
      if (start < 0 || end < 0) {
        throw new Error('initMobileMenu not found in mobile-menu.client.ts')
      }
      const fn = src.slice(start + 'export '.length, end + 2)
      const { code } = await transformWithOxc(
        `const f = ${fn}\nexport default f`,
        'mobile-menu.ts',
        {
          lang: 'ts',
        },
      )
      // Bound to a const so the minifier cannot drop an unused declaration.
      const min = minifySync('mobile-menu.js', code).code
      const expr = min
        .replace(/^const \w+=/, '')
        .replace(/;export default \w+;?\s*$/, '')
      return `export default ${JSON.stringify(`(${expr})`)}`
    },
  }
}
