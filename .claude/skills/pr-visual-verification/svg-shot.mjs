// Render a .mmd file to SVG with a renderer entry, then screenshot it to a 2x PNG.
// Usage (run through tsx so the .ts entry imports):
//   pnpm exec tsx .claude/skills/pr-visual-verification/svg-shot.mjs <entry> <in.mmd> <out.png>
// <entry> is ./src/index.ts for "after" or ./tmp-base-ref/src/index.ts for "before".
// SVG output is a browser render, so a browser screenshot is the real thing (unlike ASCII).
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entry, mmd, out] = process.argv.slice(2)
if (!entry || !mmd || !out) {
  console.error('usage: svg-shot.mjs <entry> <in.mmd> <out.png>')
  process.exit(2)
}
const { renderMermaidSVG } = await import(pathToFileURL(resolve(entry)).href)
const svg = await renderMermaidSVG(readFileSync(mmd, 'utf8'))
writeFileSync(out.replace(/\.png$/, '.svg'), svg)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 })
  await page.setContent(
    `<body style="margin:16px;background:#fff">${svg}</body>`,
  )
  await page.locator('svg').first().screenshot({ path: out })
} finally {
  await browser.close()
}
