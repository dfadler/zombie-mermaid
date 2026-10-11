/** @jsxRuntime automatic */
/**
 * Re-export barrel for the icon set (#596, part of the #591 component
 * library and the #590 site redesign) — the implementation now lives under
 * `./icons/` (#934 split this file's 43 icon exports into one module per
 * icon family; see `./icons/index.ts` for the full set overview and the
 * file-by-file breakdown).
 *
 * Kept at this exact path and filename, re-exporting the same names with
 * the same props signatures, so none of this module's many import sites
 * (nav.tsx, the editor toolbar, feature-pillars.tsx, and others) need to
 * change.
 *
 * The `@jsxRuntime` pragma on line 1 is required in every .tsx file here —
 * see the `jsx` comment in demo/tsconfig.json. This file has no JSX of its
 * own, but the pragma-coverage test (`__tests__/demo-jsx-pragma.test.ts`)
 * checks every .tsx file under demo/ regardless.
 */

export * from './icons/index.ts'
