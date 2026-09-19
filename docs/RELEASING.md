# Releasing

This project publishes to npm using [Changesets](https://github.com/changesets/changesets)
for versioning/changelog generation, and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC) for authentication — there is no long-lived `NPM_TOKEN` secret. The
whole flow is automated by `.github/workflows/publish.yml`
(`changesets/action`); this document explains what happens at each step and
the one-time manual setup the maintainer needs to do before it can publish
anything.

## Adding a changeset (contributors)

If your PR changes anything that should be reflected in `CHANGELOG.md` /
bump the package version, run:

```bash
pnpm changeset
```

This asks which package(s) to bump and which kind of bump the change needs
(patch/minor/major), then for a short summary. As of #622, the workspace has
six packages — `zombie-mermaid` and the five internal `@zombie-mermaid/*`
packages it depends on (`core`, `mermaid-parser`, `svg-renderer`,
`ascii-renderer`, `mcp`) — but `.changeset/config.json`'s `fixed` group
locks all six to the same version, so picking any one of them (`zombie-mermaid`
is simplest) bumps them all together at release time; you don't need to
select all six by hand. It writes a markdown file under `.changeset/` —
commit that file alongside your change. A PR can contain more than one
changeset, and a changeset can be empty (`pnpm changeset add --empty`) for
changes that don't need a release (docs, CI, tests).

Not every change needs one — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## What happens on merge to `main`

`.github/workflows/publish.yml` runs on every push to `main` (i.e. whenever
a PR merges) and does one of two things:

1. **Pending changesets exist** — it opens (or updates) a `chore: version
packages` pull request. That PR contains the version bump in
   `package.json` and the generated `CHANGELOG.md` entries, computed from
   all pending `.changeset/*.md` files, which it deletes.
2. **No pending changesets, and the previous push was that Version PR being
   merged** — versions are already bumped, so instead of opening another PR,
   the workflow runs `pnpm changeset publish`, which, for each package with
   a pending version bump:
   - publishes that package to npm (authenticated via OIDC trusted
     publishing, with [provenance](https://docs.npmjs.com/generating-provenance-statements)
     attached — see `publishConfig.provenance` in `package.json`)
   - creates a git tag for that package's release, named `<package
name>@<version>` (e.g. `zombie-mermaid@2.2.5`,
     `@zombie-mermaid/core@2.2.5`) — not a single shared `vX.Y.Z` tag
   - creates a GitHub Release from that package's changelog entry
     (`create-github-releases: true` in the workflow)

With `.changeset/config.json`'s `fixed` group locking all six packages to
one version, a single release cuts six tags and six GitHub Releases in the
same run — one per package, all sharing the same version number.

In short: **merging the Version PR is what triggers the actual npm
publish.** There's no separate "cut a release" step or GitHub Release to
create by hand — releases are tracked via `CHANGELOG.md` and git tags,
generated automatically as part of this flow.

## One-time manual setup required (maintainer only)

Trusted publishing has to be linked on the npm side before any of this can
publish successfully. **This can only be done by whoever owns/administers
each package on npmjs.com** (currently the fork maintainer), and only needs
to be done once **per package name** — as of #622 that means **six separate
packages**, not just `zombie-mermaid`:

- `zombie-mermaid`
- `@zombie-mermaid/core`
- `@zombie-mermaid/mermaid-parser`
- `@zombie-mermaid/svg-renderer`
- `@zombie-mermaid/ascii-renderer`
- `@zombie-mermaid/mcp`

npm trusted publishing is configured per package name individually — there
is no "cover the whole `@zombie-mermaid` scope at once" option — so this
setup has to be repeated six times. All six are configured as of #622. For
a package that ever needs reconfiguring, or a new package added later:

1. Sign in to [npmjs.com](https://www.npmjs.com/) and go to that package's
   settings page: `https://www.npmjs.com/package/<name>/access` (URL-encode
   the `@`/`/` in a scoped name, e.g.
   `https://www.npmjs.com/package/@zombie-mermaid/core/access` — or navigate
   there from the package's own page). If the package hasn't been published
   under this name before, it needs one manual bootstrap publish first (a
   plain, human-authenticated `npm publish` from a maintainer's machine) —
   npm only exposes the Trusted Publisher UI on a package that already
   exists.
2. Find the **Trusted Publisher** section and add a GitHub Actions publisher
   with these exact values (all fields are case-sensitive, and identical
   across all six packages — only the package being configured changes):
   - **Organization or user:** `dfadler`
   - **Repository:** `zombie-mermaid`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** leave blank (this workflow doesn't use a GitHub
     Environment)
3. Save. From then on, npm will accept publishes for that package that come
   from a GitHub Actions run of `dfadler/zombie-mermaid`'s `publish.yml`
   workflow on `main`, authenticated via that run's OIDC token — no npm
   token needed in CI.

Until this is configured **for a given package**, `pnpm changeset publish`
will fail to publish _that_ package specifically (`ENEEDAUTH` or similar)
even if the others succeed — `changesets/action` continues on to the next
package rather than aborting the whole step, but the run as a whole will
report the failure. That's expected and isn't a bug in the workflow — it's
this missing link, and it's fine to configure multiple packages at different
times (each unblocks itself independently).

If an `NPM_TOKEN` repository secret still exists from the old release flow,
it's no longer used anywhere in `publish.yml` and can be deleted from the
repo's Actions secrets once trusted publishing is confirmed working.

When configuring trusted publishing for any package (including a new one
added in the future), double-check the **Allowed actions** setting: make
sure a direct **`npm publish`** is permitted, not only a staged one. npm's
trusted-publisher UI has, at various points, defaulted a _new_
configuration to allow staged publishing only (`npm stage publish` — which
then waits on a maintainer's separate, manual 2FA-backed approval before
anything actually goes live) unless direct publish is explicitly also
selected. This workflow's `pnpm changeset publish` step does a direct
publish, not a staged one — if a newly-created config defaults to
staged-only, that step fails outright (npm rejects the direct `npm publish`
call for that package) rather than silently succeeding, so the failure is
visible in the workflow run. Double-check this setting against npm's current
[trusted publishers docs](https://docs.npmjs.com/trusted-publishers/) rather
than assuming the option is where this note describes it — npm has changed
the default here before and may again.

## Publishing `ascii-renderer` and `svg-renderer` standalone

`@zombie-mermaid/ascii-renderer` and `@zombie-mermaid/svg-renderer` are
documented, standalone-usable packages — see their own `packages/*/README.md`
— for anyone who wants just one renderer without the full `zombie-mermaid`
umbrella. `core`, `mermaid-parser`, and `mcp` stay internal-only: published
under the scope (so the names can't be squatted) and version-locked with the
rest, but with no standalone support commitment beyond backing the umbrella
and the two public renderer packages.

## Requirements this depends on

- npm CLI `11.5.1+` and Node.js `22.14.0+` for trusted publishing support.
  The workflow runs `npm install -g npm@latest` before publishing to make
  sure the runner's npm is new enough regardless of what ships with the
  pinned Node version.
- The `id-token: write` and `contents: write` / `pull-requests: write`
  permissions on the `release` job in `publish.yml` (already configured) —
  `id-token` is what lets npm mint the OIDC credential, the other two are
  what `changesets/action` needs to open/update the Version PR and push
  tags.

## Verifying a release manually, if something looks wrong

- `pnpm changeset status` shows what changesets are pending and what the
  next version bump would be.
- `pnpm changeset version` applies that bump locally without publishing, so
  you can review the diff before it happens in CI.
- The actual publish step (`pnpm changeset publish`) should generally not be
  run locally — it's meant to run in CI, immediately after the Version PR
  merges, using the OIDC credential minted for that run.
