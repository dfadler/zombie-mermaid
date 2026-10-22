---
name: provenance-check
description: |
  Re-verify the dated claims in docs/provenance.md and report which have
  drifted. Use when asked to "check provenance", "refresh the provenance
  doc", before a release that touches publishing, or when editing
  docs/provenance.md. Read-only; reports, does not edit.
---

# Provenance check

Each claim in `docs/provenance.md` names its own "Check:" command. Re-run
them and compare with the page. Read-only: report drift, then let the
maintainer decide what to edit.

## Commands

Run from a clean `main` checkout (`git fetch origin` first; use `origin/main`).

| Claim | Check |
| --- | --- |
| First commit is upstream's `3185b9b6`, 2026-01-28 | `git log --reverse --format='%h %ad %an %s' --date=short origin/main \| head -1` |
| Fork's own work starts `be8cbbe9` | `git log -1 --format='%h %ad %s' --date=short be8cbbe9` |
| First npm release 1.1.3, 2026-08-27 | `npm view zombie-mermaid time --json` (key `1.1.3`) |
| Other authors keep authorship | `git log --format=%an origin/main \| sort \| uniq -c \| sort -rn` |
| Claude trailer count | `git log origin/main --grep='Co-Authored-By: Claude' -i --format=%h \| wc -l` vs `git log origin/main --format=%h \| wc -l` |
| Attestations on all six packages | for each package name in `package.json` and `packages/*/package.json`: `npm view <name>@<latest> dist.attestations.url` |
| `publishConfig.provenance: true` in all six | `grep -L '"provenance": true' package.json packages/*/package.json` (should print nothing for publishable packages) |
| Trusted publishing, no `NPM_TOKEN` | `grep -n NPM_TOKEN .github/workflows/publish.yml docs/RELEASING.md` (expect no live use) |
| CODEOWNERS single owner | `grep -v '^#' .github/CODEOWNERS` |
| Handover path still undocumented | `grep -rniE 'handover\|succession' docs SECURITY.md CONTRIBUTING.md` (a hit means the "If the maintainer stops" section is stale) |
| Linked files exist | `pnpm run check:docs` |

## Report

One line per claim: `ok`, or `drift: page says X, now Y`. Counts (trailer
share, version numbers, "checked <date>") are expected to move; flag them and
propose the new value and date. Never tighten or add a claim the table does
not cover; a claim that cannot be re-checked should be removed, not kept.
