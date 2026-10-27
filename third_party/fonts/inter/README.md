# Inter (vendored source)

`InterVariable.woff2` is the unmodified variable build (`wght` 100-900, `opsz`
14-32) from the [`inter-ui`](https://www.npmjs.com/package/inter-ui) 4.1.1 npm
package, which packages [Inter](https://github.com/rsms/inter) 4.1. Licensed
under the [SIL Open Font License 1.1](./OFL.txt) (no Reserved Font Name is
declared), which permits embedding and subsetting.

It is a **build input**: `scripts/lib/inter-font-subset.ts` subsets it to Basic
Latin, `wght` 400-700, `opsz` 14 for `embedFont: 'subset'` (#1867), written to
`packages/svg-renderer/src/generated/inter-font-subset.ts` by
`pnpm run build:inter-font`.
