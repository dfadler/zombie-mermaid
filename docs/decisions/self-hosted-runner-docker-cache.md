# Self-hosted GitHub Actions runner for a warm Docker cache: no-go

[#738](https://github.com/dfadler/zombie-mermaid/issues/738) asked whether
moving `visual-regression` to a **self-hosted** runner would eliminate the
job's repeated container-pull cost, since only a self-hosted runner can
carry a persistent Docker layer cache across separate job runs.

The full analysis — the real measured cost (~92 seconds of extra aggregate
runner time per run, not "billed Actions-minutes," which self-hosted
runners don't consume at all), what a self-hosted runner actually requires
per GitHub's own docs, and the decisive security fact (GitHub's own
guidance: self-hosted runners "should almost never be used for public
repositories," and `zombie-mermaid` is public) — is written up as a comment
on [#738](https://github.com/dfadler/zombie-mermaid/issues/738#issuecomment-5606391898)
rather than duplicated here.

## Summary

- **No-go.** Not "not yet" — the public-repo security model makes this a
  structural blocker, not a scheduling one. `visual-regression` runs on
  every PR, including from untrusted first-time contributors; a self-hosted
  runner (which must be **persistent** to hold a warm cache, not GitHub's
  ephemeral/JIT option) would give arbitrary PR-submitted code execution
  access to a machine the maintainer owns and must secure.
- The benefit (~92s/run) is small relative to the new risk and ongoing
  operational burden (no existing always-on infrastructure or owner for
  this solo-maintainer repo), and a scoped `push`-only workaround was
  considered and rejected as not worth the added complexity.
- `.github/workflows/ci.yml` is unchanged by this decision.

See the [#738 comment](https://github.com/dfadler/zombie-mermaid/issues/738#issuecomment-5606391898)
for the full writeup, including what would change this calculus later.
