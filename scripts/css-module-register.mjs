/**
 * `--import` entry point for zombie-mermaid#1103's `.module.css` loader
 * hook — see css-module-hooks.mjs for the actual `resolve`/`load` logic and
 * why this is a separate file from it (Node re-imports a hooks module in
 * its own dedicated realm to run resolve/load; keeping the one-time
 * `register()` call out of that file means it never re-registers itself
 * inside that realm).
 */
import { register } from 'node:module'

register('./css-module-hooks.mjs', import.meta.url)
