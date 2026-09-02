---
'zombie-mermaid': minor
---

Add a `-w`/`--max-width <n|auto>` CLI flag for `render --ascii`. When rendered ASCII output exceeds the target width, a warning is printed to stderr naming the actual vs. target width (`auto` detects the live terminal's column count); stdout still receives the full, unmodified diagram — no truncation or reflow. Full auto-fit reflow (compact spacing, label wrapping, direction flipping) is not implemented — see issue #335.
