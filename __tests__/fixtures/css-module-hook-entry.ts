/**
 * Entry point `__tests__/css-module-loader-hook.test.ts` runs inside a real
 * `tsx` child process — see that file for why this has to be a spawned
 * process rather than an in-process import. Deliberately imports both a
 * `.module.css` file (exercising the hook under test) and a plain `.tsx`
 * module (exercising that tsx's own TS-stripping still works once our hook
 * is chained in front of it), then prints one JSON line so the test can
 * assert on the result without scraping human-readable output.
 */
import styles, { css } from '../../demo/components/primitives.module.css'
import { COLORS } from '../../demo/components/tokens.tsx'

console.log(
  JSON.stringify({
    classes: styles,
    cssLength: css.length,
    cardRuleIncluded: css.includes(`.${styles.card} {`),
    tokensColorCount: Object.keys(COLORS).length,
  }),
)
