/**
 * Entry point `__tests__/css-module-loader-hook.test.ts` spawns to confirm
 * a `composes:` reference fails loudly instead of silently dropping the
 * composed class from the exported classes map — see
 * css-module-hooks.mjs's `hasComposition` doc comment.
 */
import './css-module-composes-fixture.module.css'
