---
---

`scripts/ascii-terminal-capture.sh`: hide the terminal cursor before running the recorded command. Without this, the recording's last frame captures whatever cursor state the PTY was in when it closed, and `agg` renders a still-visible cursor as an opaque block over the character underneath it - visible as a stray solid block in the bottom corner of the exported PNG. This is unrelated to the npx-tsx line-loss fix (`#410`): that one was about a missing trailing line, this one is about the cursor glyph itself. Verified the fix removes the artifact (reproduced it by reverting the change and re-capturing) without altering rendered content (diffed the `.txt` export against calling `renderMermaidASCII` directly).
