---
'zombie-mermaid': patch
'@zombie-mermaid/svg-renderer': patch
---

SVG xychart charts now draw lines the way mermaid does: straight segments (the monotone smoothing is gone, mermaid has no option for curves), no dot grid in any mode, point markers only on hover in interactive charts (none otherwise), and an axis line with tick marks on each axis. `pnpm run xychart:oracle` scores these as `style`. `smoothCurvePath` is still exported but no longer used by the renderer.
