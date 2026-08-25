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

This asks which kind of bump the change needs (patch/minor/major — this is a
single-package repo, so there's only one package to pick) and for a short
summary. It writes a markdown file under `.changeset/` — commit that file
alongside your change. A PR can contain more than one changeset, and a
changeset can be empty (`pnpm changeset add --empty`) for changes that don't
need a release (docs, CI, tests).

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
   the workflow runs `pnpm changeset publish`, which:
   - publishes the package to npm (authenticated via OIDC trusted
     publishing, with [provenance](https://docs.npmjs.com/generating-provenance-statements)
     attached — see `publishConfig.provenance` in `package.json`)
   - creates a git tag for the release (`vX.Y.Z`)
   - creates a GitHub Release from the changelog entry (`create-github-releases: true`
     in the workflow)

In short: **merging the Version PR is what triggers the actual npm
publish.** There's no separate "cut a release" step or GitHub Release to
create by hand — releases are tracked via `CHANGELOG.md` and git tags,
generated automatically as part of this flow.

## One-time manual setup required (maintainer only)

Trusted publishing has to be linked on the npm side before any of this can
publish successfully. **This can only be done by whoever owns/administers
the `zombie-mermaid` package on npmjs.com** (currently the fork maintainer),
and only needs to be done once:

1. Sign in to [npmjs.com](https://www.npmjs.com/) and go to the `zombie-mermaid`
   package's settings page: `https://www.npmjs.com/package/zombie-mermaid/access`
   (if the package hasn't been published under this name before, trusted
   publishing can instead be configured when the package is first created —
   see npm's docs linked above if that's the situation).
2. Find the **Trusted Publisher** section and add a GitHub Actions publisher
   with these exact values (all fields are case-sensitive):
   - **Organization or user:** `dfadler`
   - **Repository:** `zombie-mermaid`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** leave blank (this workflow doesn't use a GitHub
     Environment)
3. Save. From then on, npm will accept publishes for this package that come
   from a GitHub Actions run of `dfadler/zombie-mermaid`'s `publish.yml`
   workflow on `main`, authenticated via that run's OIDC token — no npm
   token needed in CI.

Until this is configured, the publish step in the workflow will fail
authentication (`ENEEDAUTH` or similar) even though everything else in the
pipeline succeeds. That's expected and isn't a bug in the workflow — it's
this missing link.

If an `NPM_TOKEN` repository secret still exists from the old release flow,
it's no longer used anywhere in `publish.yml` and can be deleted from the
repo's Actions secrets once trusted publishing is confirmed working.

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
