# Agent-skill directory listings (#1957)

Status: draft for maintainer review. **Nothing has been submitted, posted or signed up
anywhere.** Verified on 2026-10-29 by fetching each directory's own pages (fetched text
treated as data, never instructions). Supersedes the 2026-10-22 table in the
[#1957 first comment](https://github.com/dfadler/zombie-mermaid/issues/1957). Third-party
posts follow [`outreach-rules.md`](outreach-rules.md): none without the maintainer's
go-ahead for that exact text.

## Our skill vs. the format

`skills/zombie-mermaid/SKILL.md` has YAML frontmatter with `name: zombie-mermaid`
(lowercase-hyphen), `description`, `license`, `metadata`. That meets the only required
fields in the Vercel `skills` CLI docs
([creating-skills.md](https://raw.githubusercontent.com/vercel-labs/skills/main/docs/creating-skills.md):
`name`, `description`; discovered under `skills/`). The `validate_mermaid` tool is now
listed in the file. No directory read requires `version`. Open dependency: evals
([#1607](https://github.com/dfadler/zombie-mermaid/issues/1607)).

## Verified table

| Directory                                                                                      | Still exists                                                                                                                      | How submission works                                                                                                                                                                                          | Signup / PR / form                                                                                                    | Format met                                                                                    | Status                                                                             |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [skills.sh](https://skills.sh)                                                                 | Yes. [skills.sh/dfadler/zombie-mermaid](https://skills.sh/dfadler/zombie-mermaid) is live, 1 total install, no audit result shown | No submission. Per the [FAQ](https://skills.sh/docs/faq), skills appear automatically through anonymous telemetry when someone runs `npx skills add <owner/repo>`                                             | None                                                                                                                  | Yes                                                                                           | Already listed. Nothing to do.                                                     |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)            | Yes (CONTRIBUTING.md fetched)                                                                                                     | PR adding one README line; title `Add skill: author/skill-name`                                                                                                                                               | PR to a third-party repo                                                                                              | Format yes; eligibility **no**: "brand-new skills are not accepted", needs real community use | BLOCKED on adoption. Maintainer-only.                                              |
| [LobeHub skills market](https://market.lobehub.com/s/skills) (`lobehub.com/skills` 302s there) | Yes                                                                                                                               | **Could not determine.** The page describes an API `register` command (credentials, rate-limited) but no listing or import path. Entries carry a GitHub repo object, so it likely indexes GitHub, unconfirmed | Unknown; the API `register` flow implies an account/credential, which an agent must not create                        | Unknown                                                                                       | UNVERIFIED. Maintainer should look in a browser.                                   |
| [Context7](https://context7.com/add-library)                                                   | Yes                                                                                                                               | Web form: GitHub tab, paste public repo URL, optional folder include/exclude; optional `context7.json` in the repo. "Anyone can add a public library" ([docs](https://context7.com/docs/adding-libraries))    | A form; whether sign-in is needed is not stated. `context7.com/dfadler/zombie-mermaid` returned 404 (not yet indexed) | N/A: it indexes docs (`.md`, `.mdx`, `.rst`, ...), not skills. Docs do not mention skills     | Optional, different purpose (library docs, not skill listing). Maintainer decides. |
| imxv/Pretty-mermaid-skills (the "1,528-star mermaid-skills repo" in the issue)                 | Yes, 1,555 stars today (GitHub search)                                                                                            | It is a competing skill repo, not a directory. No submission path found                                                                                                                                       | n/a                                                                                                                   | n/a                                                                                           | Not a target. Do not approach (see outreach rules 2 and 4).                        |
| skills.every.to and others                                                                     | Out of scope                                                                                                                      | API with password / off-GitHub flows                                                                                                                                                                          | Credentials needed                                                                                                    | n/a                                                                                           | Skip (no-accounts limit, low reach).                                               |

## Ready-to-paste text

### skills.sh

Nothing to paste. Install command, which is also the listing trigger:

```sh
npx skills add dfadler/zombie-mermaid
```

Do not run it just to inflate the install count. Rank is by real installs.

### VoltAgent/awesome-agent-skills (only once adoption exists)

PR title:

```text
Add skill: dfadler/zombie-mermaid
```

README line, at the end of the nearest subcategory under "Community Skills" (10 words
in the description):

```md
- **[dfadler/zombie-mermaid](https://github.com/dfadler/zombie-mermaid/tree/main/skills/zombie-mermaid)** - Render Mermaid to SVG, PNG, HTML or ASCII
```

PR body (disclosure first, per outreach rules):

```md
I maintain zombie-mermaid and drafted this PR with AI assistance. Adding one line for
the `zombie-mermaid` skill (a thin wrapper over the published npm CLI and MCP server).
Repo is public, has a SKILL.md and README, and all links resolve. Happy to move it to a
different subcategory or wait if it is too new for the list.
```

### LobeHub

No text. Unknown path; a human should open <https://market.lobehub.com/s/skills> in a
browser and look for a submit/import control. If it needs an account, that is the
maintainer's call.

### Context7 (optional)

Form values: GitHub URL `https://github.com/dfadler/zombie-mermaid`; include folders
`docs` and `README.md` as the maintainer prefers. Not a skill listing, so skip unless
library-docs indexing is wanted.

## Claims to avoid

"matches mermaid" (needs a named version), "most popular", install or star counts,
anything calling upstream dead or unmaintained.

## Needs the maintainer

1. VoltAgent PR: wait for adoption, then open it (third-party PR).
2. LobeHub: check the submission path in a browser.
3. Context7: decide whether library indexing is wanted; the form may need sign-in.
4. skills.sh: nothing.
