/**
 * Entry point `__tests__/css-module-loader-hook.test.ts` spawns to confirm
 * an `@import` rule fails loudly instead of silently producing an
 * incomplete stylesheet — see css-module-hooks.mjs's `IMPORT_RULE_PATTERN`
 * doc comment.
 */
import './css-module-import-fixture.module.css'
