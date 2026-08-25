# Contributing to zombie-mermaid

`zombie-mermaid` is a maintained fork of [`beautiful-mermaid`](https://github.com/lukilabs/beautiful-mermaid). It exists because upstream development has stalled — this repo pulls in upstream fixes, gives stuck upstream PRs a home, and actually ships releases. Contributions of both kinds (new fixes, and ports of things stuck upstream) are welcome.

## Getting set up

```bash
git clone https://github.com/dfadler/zombie-mermaid.git
cd zombie-mermaid
pnpm install
```

Requires Node 22+ and pnpm (the repo pins `packageManager` in `package.json`; `corepack enable` will pick that up automatically).

Useful scripts while developing (see `package.json` for the full list):

- `pnpm test` — run the test suite once (Vitest)
- `pnpm run test:watch` — Vitest in watch mode
- `pnpm run test:coverage` — Vitest with coverage
- `pnpm run lint` — ESLint
- `pnpm run build` — build the publishable package with tsup
- `pnpm run samples` — render the sample gallery (`index.ts`) to `index.html`
- `pnpm run editor` — build the live editor page (`editor.ts`) to `editor.html`
- `pnpm run dev` — local dev script (`dev.ts`)
- `pnpm run bench` — render benchmarks
- `pnpm run format` — format the codebase with Prettier
- `pnpm run format:check` — check formatting without writing changes

Type-check with:

```bash
pnpm exec tsc --noEmit
```

## Before opening a PR

CI (`.github/workflows/ci.yml`) runs on every push and PR against `main` and must pass:

1. `pnpm install --frozen-lockfile`
2. `pnpm test`
3. `pnpm exec tsc --noEmit`

Run those locally first, along with `pnpm run lint` and `pnpm run format:check`, since lint and formatting aren't currently wired into CI but are still expected to be clean. Please also add or update tests under `src/**` for any behavioral change — this is a parser/renderer library, and regressions are easy to introduce silently in layout or parsing code.

Keep PRs focused: one fix or feature per PR is much easier to review and, if needed, to revert.

## Porting fixes from upstream

This is the part that makes this fork different from a typical project. Two situations come up:

**Pulling upstream wholesale.** When upstream (`lukilabs/beautiful-mermaid`) has commits worth taking as-is, merge `upstream/main` into a branch and open a PR against `main` from that branch, keeping the original commits (and their authorship) intact rather than squashing. You can see this pattern already in the history — e.g. PRs [#103–#106](https://github.com/lukilabs/beautiful-mermaid/pulls?q=is%3Apr+103..106) were merged upstream and then merged into this fork's `main` with their original commits and merge messages preserved, so `git log` still shows exactly who wrote what and links back to the upstream PR number. Prefer this when you're bringing over a self-contained upstream branch or PR.

**Cherry-picking or re-implementing a single upstream fix.** If you're porting just one commit, or re-writing a stuck upstream PR to get it in a mergeable state, reference the upstream source explicitly:

- In the commit message or PR description, link the upstream PR and/or commit SHA (e.g. `Ports lukilabs/beautiful-mermaid#123` or `Cherry-picked from lukilabs/beautiful-mermaid@<sha>`).
- Keep the original author's name in the commit (`git cherry-pick -x` preserves the source SHA in the message; `--signoff` or a `Co-authored-by:` trailer preserves credit if you had to rewrite the patch).
- If the upstream PR was abandoned or blocked upstream, say so briefly — it helps reviewers understand why the fix is landing here instead of there.

Either way, add an entry under `[Unreleased]` in `CHANGELOG.md` describing what changed and, where relevant, that it originated upstream.

## Releasing

Releases are tagged (`vX.Y.Z`) and publishing to npm is automated via `.github/workflows/publish.yml`, which runs on a published GitHub Release. Only the maintainer cuts releases; as a contributor you don't need to do anything beyond keeping `CHANGELOG.md`'s `[Unreleased]` section up to date.

## Code of conduct

Be respectful and constructive in issues, PRs, and reviews. There's no separate CODE_OF_CONDUCT.md yet — until there is, the short version is: assume good faith, keep feedback about the code rather than the person, and expect the same in return.

## License

By contributing, you agree your contributions are licensed under this project's [MIT license](LICENSE).
