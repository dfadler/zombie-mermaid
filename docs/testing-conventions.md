# Testing conventions for demo/editor components

This doc covers how to test React components under `demo/**` and `editor/**`
— the site chrome and the in-repo editor, as distinct from `src/**`'s
parser/renderer unit tests (see "Test coverage" in
[CONTRIBUTING.md](../CONTRIBUTING.md)). It exists because, once [React
Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
(RTL) became the standard for these components ([#798](https://github.com/dfadler/zombie-mermaid/issues/798),
part of the [#797](https://github.com/dfadler/zombie-mermaid/issues/797)
hydration epic), nothing stopped a later PR from adding a new whole-tree
snapshot or a raw `.toContain()` string-pin instead — the pattern this epic
retired could creep back in one unreviewed file at a time. This doc states
the expected pattern, names the deliberate exceptions to it, and
[a CI check](#the-ci-guardrail) backs it so a new snapshot test needs an
explicit opt-in rather than sneaking in silently.

## The pattern: render, query by role, interact

For a component with any client-side behavior — state, event handlers,
keyboard support — write the test three ways, in order:

1. **Render** it into a real DOM with `@testing-library/react`'s `render()`.
2. **Query** it the way a user (or assistive tech) would:
   `screen.getByRole(...)`, `screen.getByText(...)`, `screen.getByLabelText(...)`
   — not a raw `querySelector` or a CSS class lookup. A query keyed to the
   accessible role/name breaks when the element actually stops being
   reachable that way, not just when an unrelated class name changes.
3. **Interact** with `@testing-library/user-event`, then assert the
   resulting state. This is the thing a static-markup string comparison
   (`renderToStaticMarkup` + `.toContain()`/`.toEqual()`) fundamentally
   cannot express, since nothing in that output is ever alive.

The worked example is
[`__tests__/dom/rtl-example.test.ts`](../__tests__/dom/rtl-example.test.ts) —
copy its shape for a new component test:

```ts
// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

function Counter() {
  const [count, setCount] = useState(0)
  return createElement(
    'button',
    { type: 'button', onClick: () => setCount((c) => c + 1) },
    `Clicked ${count} times`,
  )
}

describe('React Testing Library pattern (example)', () => {
  it('renders, queries by role, and reacts to a click', async () => {
    const user = userEvent.setup()
    render(createElement(Counter))

    const button = screen.getByRole('button', { name: 'Clicked 0 times' })
    expect(button).toBeInTheDocument()

    await user.click(button)

    expect(
      screen.getByRole('button', { name: 'Clicked 1 times' }),
    ).toBeInTheDocument()
  })
})
```

A few mechanical notes that aren't obvious from the example alone:

- The `// @vitest-environment jsdom` docblock must be the file's first line.
  `config/vitest.config.ts`'s default test environment is `node` (most of
  `__tests__/**` are plain string/attribute assertions against
  `renderToStaticMarkup` output with no reason to pay jsdom's setup cost);
  omitting the docblock fails loudly (`document is not defined`) rather than
  silently running under the wrong environment.
- By convention, jsdom-backed tests live under `__tests__/dom/` for
  discoverability — that's a grep-able convention, not something enforced
  mechanically.
- `@testing-library/jest-dom` matchers (`toBeInTheDocument()`, etc.) are
  registered globally via `config/vitest.setup.ts`; no per-file import needed.

### Testing a hydrated component

A component that's server-rendered and then hydrated client-side (most of
`demo/components/`) needs a second kind of test alongside the behavioral one
above: proof it hydrates cleanly — no console warning or error — against the
exact markup its own server-render path produces. See
[`__tests__/dom/nav-hydration.test.ts`](../__tests__/dom/nav-hydration.test.ts)
or
[`__tests__/dom/dashboard-hydration.test.ts`](../__tests__/dom/dashboard-hydration.test.ts)
for the `renderToString` → `hydrateRoot` → assert-no-console-noise shape.
Keep this as a separate `describe` block (or file) from the plain
`render()`-based behavioral tests — hydration is a distinct concern
(does the client tree match the server tree) from behavior (does the
component work once mounted), and conflating them makes a failure harder to
diagnose.

## When a literal-value assertion is still correct

The pattern above is the default, not an absolute rule. This repo has two
categories of test that deliberately assert on literal values — colors,
markup strings, whole normalized documents — instead of querying
semantically, and both are justified exceptions rather than a lapse:

**Design-canvas fidelity checks.**
[`__tests__/demo-design-tokens.test.ts`](../__tests__/demo-design-tokens.test.ts),
[`demo-footer.test.ts`](../__tests__/demo-footer.test.ts),
[`demo-icons.test.ts`](../__tests__/demo-icons.test.ts),
[`demo-primitives.test.ts`](../__tests__/demo-primitives.test.ts), and
[`demo-nav.test.ts`](../__tests__/demo-nav.test.ts) pin `demo/components/*`
against the design canvas (`.dc.html` artboards) each was extracted from.
The canvas is the source of truth for exact hex values, spacing, and markup
shape, and it lives outside the repo — nothing mechanical can re-derive it.
A semantic RTL query (`getByRole('button')`) can't express "this button's
`stroke` is exactly `var(--cyan)`, matching sixteen artboards byte-for-byte"
— only a literal comparison can. Each file's header comment names the canvas
source and says to update the expectations only alongside a canvas change.
The exception is to the _query_, not the _mechanism_: [`demo-icons.test.ts`](../__tests__/demo-icons.test.ts)
(#825) renders each icon with RTL's `render()` into jsdom and reads the pinned
values off the resulting `<svg>`/`<path>` nodes via the DOM API
(`getAttribute`/`toHaveAttribute`); the other four files still use
`renderToStaticMarkup` plus direct string/attribute assertions against the
markup string. Neither is a snapshot matcher (see below) — pick whichever
reads more clearly for a given file; nothing here requires migrating the
rest to match.

**Golden-DOM regression tests.**
[`__tests__/site-equivalence.test.ts`](../__tests__/site-equivalence.test.ts)
guards the five site-generator pages (`index.ts`, `editor.ts`,
`fork-fixes.ts`, `pages.ts`, `blog.ts`) with `toMatchFileSnapshot` against
checked-in, DOM-normalized fixtures under `__tests__/__fixtures__/`. This is
the one case in this repo where a real snapshot matcher (not just a literal
string assertion) is the right tool: the real generator output is
enormous (each page embeds a ~1.6 MB minified bundle or freshly rendered
SVG), so a whole-page fixture isn't practical, and the equivalence proof
this file guards was a one-time full comparison recorded in
[`docs/decisions/react-site-migration-plan.md`](decisions/react-site-migration-plan.md).
An intentional markup change updates the goldens with `pnpm exec vitest -u`;
reviewing that diff is exactly the point — a snapshot test earns its keep
here because the full rendered output really is the thing under test, not a
substitute for querying it semantically.

The line between "should be a semantic RTL query" and "is legitimately a
literal/snapshot pin" is whether the value under test has a source of truth
outside what the component's own logic can be asked to prove: a design
canvas, or a full-page render too large to assert on piece by piece. If a
test is pinning a string purely because writing `getByRole`/`getByText`
felt harder, that's the sign to rewrite it, not to reach for
`toMatchSnapshot`.

## The CI guardrail

[`scripts/check-snapshot-allowlist.sh`](../scripts/check-snapshot-allowlist.sh)
greps every `*.test.ts`/`*.test.tsx` file for a call to `toMatchSnapshot()`,
`toMatchFileSnapshot()`, or `toMatchInlineSnapshot()`, and fails if one turns
up in a file that isn't in the script's `ALLOWLIST` array (currently just
`__tests__/site-equivalence.test.ts`, the golden-DOM case above). It runs in
CI (`.github/workflows/ci.yml`'s `test` job) on every push and PR.

Run it locally with:

```bash
scripts/check-snapshot-allowlist.sh
scripts/check-snapshot-allowlist.sh --help   # usage and exit codes
```

If a new test genuinely needs a snapshot matcher — because it fits the
golden-DOM case above, not because a semantic query felt like more work —
add the file to the `ALLOWLIST` array in that script, with a comment
explaining why, in the same PR that adds the test. That keeps the exception
list a deliberate, reviewed decision instead of something that accretes
silently. The design-canvas fidelity checks don't need an entry: they assert
on literal strings/attributes directly, not through one of the three
matchers this check looks for.

Note the check is a grep, not a parser — it can't tell a real call from one
mentioned only in a comment or string literal. That's an accepted trade-off
for a check this cheap, the same one this repo's `// nosemgrep` comments
make (reviewed by eye, not mechanically verified).
