/**
 * Human-readable metadata for the built-in themes in `src/theme.ts`.
 *
 * Consumed by theme-picker.ts's `renderThemePill` (pill labels, and each
 * pill's `title` tooltip) — shared by both index.ts's interactive gallery
 * and pages.ts's per-diagram-type pages — so labels/descriptions never
 * drift out of sync with each other or with `THEMES` itself.
 */

/** Human-readable labels for theme keys, shown in the theme picker's pills. */
export const THEME_LABELS: Record<string, string> = {
  'zinc-light': 'Zinc Light',
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  nord: 'Nord',
  'nord-light': 'Nord Light',
  dracula: 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
}

/**
 * One-sentence description of each theme's look, grounded in its actual
 * `THEMES` colors rather than generic marketing copy — shown as each theme
 * pill's `title` tooltip.
 */
export const THEME_DESCRIPTIONS: Record<string, string> = {
  'zinc-light':
    'The default look: a plain off-white background with near-black zinc text and no color accent.',
  'zinc-dark':
    'The dark counterpart to the default theme — near-black zinc background, off-white text.',
  'tokyo-night':
    'Deep navy background with soft lavender-blue text and a saturated blue accent, from the Tokyo Night VS Code theme.',
  'tokyo-night-storm':
    'A slightly lighter slate-navy variant of Tokyo Night, with the same lavender-blue text and blue accent.',
  'tokyo-night-light':
    "Tokyo Night's light counterpart: a cool grey background with dark blue-grey text.",
  'catppuccin-mocha':
    'A warm dark background with lavender text and a violet accent, from the Catppuccin Mocha palette.',
  'catppuccin-latte':
    "Catppuccin's light palette: a soft off-white background with slate-blue text and a purple accent.",
  nord: 'Arctic-inspired dark theme with a slate-blue background, frost-white text, and a cyan accent.',
  'nord-light':
    "Nord's light variant: pale blue-grey background with dark slate text.",
  dracula:
    'High-contrast dark theme with a purple-black background, near-white text, and a lavender-purple accent.',
  'github-light':
    "GitHub's default light UI: white background, near-black text, and GitHub's blue accent.",
  'github-dark':
    "GitHub's dark mode: near-black background, light grey text, and the same blue accent lightened for contrast.",
  'solarized-light':
    "Ethan Schoonover's Solarized palette on a warm cream background with muted grey-green text.",
  'solarized-dark':
    "Solarized's dark variant: a deep teal background with the same muted text and blue accent as the light version.",
  'one-dark':
    "Atom's One Dark theme: charcoal background, cool grey text, and a magenta-purple accent.",
}

/** Whether a theme reads as light or dark — matches docs/guides/theming.md's 6-light/9-dark split. */
export const LIGHT_THEMES = new Set([
  'zinc-light',
  'github-light',
  'solarized-light',
  'tokyo-night-light',
  'nord-light',
  'catppuccin-latte',
])
