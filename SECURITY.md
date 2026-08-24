# Security Policy

## Supported versions

Only the latest published version of `zombie-mermaid` on npm is supported with security
fixes. If you're on an older version, please upgrade before reporting — the fix may
already be out.

## Scope

`zombie-mermaid` parses Mermaid diagram text — which may come from untrusted sources
(user input, AI-generated content, third-party data) — and renders it to SVG or ASCII.
Security issues in scope include, but aren't limited to:

- Crashes, hangs, or excessive resource consumption (CPU/memory) triggered by malformed
  or adversarial diagram input
- Output injection — e.g. diagram input that escapes the intended SVG structure and
  injects arbitrary markup, attributes, scripts, or event handlers into the rendered SVG
- Any way untrusted diagram text could lead to code execution or affect the host
  environment when this library is used as documented

General bugs that don't have a security impact (incorrect layout, wrong colors, a
diagram type not rendering as expected) should go through the normal
[issue tracker](https://github.com/dfadler/zombie-mermaid/issues) instead.

## Reporting a vulnerability

Please **do not** open a public issue for a suspected vulnerability.

Preferred: use GitHub's private vulnerability reporting for this repository —
[Security → Report a vulnerability](https://github.com/dfadler/zombie-mermaid/security/advisories/new).
This opens a private advisory visible only to the maintainer until a fix is ready.

If that option isn't available to you (private reporting can be toggled off, or you
don't have a GitHub account), open a regular issue with the minimum detail needed to
flag that it's sensitive (e.g. "Potential security issue — details withheld, please
contact me") and the maintainer will follow up to get details through a private
channel.

When reporting, please include where possible:

- The diagram input (or a minimal reproduction) that triggers the issue
- The rendering mode affected (SVG and/or ASCII)
- The version of `zombie-mermaid` you're using
- What you observed vs. what you'd expect from safe handling of untrusted input

## What to expect

This is a small, single-maintainer fork — there's no formal SLA, but reports are taken
seriously and acknowledged as soon as possible. Once a fix is available it will be
released promptly and, where appropriate, credited to the reporter (with permission).
