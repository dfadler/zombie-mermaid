// ============================================================================
// Corner character lookup table for shape rendering
// ============================================================================
//
// All shapes are rendered as rectangles with distinctive corner characters
// to indicate shape type. This eliminates diagonal characters while keeping
// shapes visually distinguishable.

import type { AsciiNodeShape } from '../types.ts'

/**
 * Corner characters for a shape in both Unicode and ASCII modes.
 */
export interface CornerChars {
  /** Top-left corner */
  tl: string
  /** Top-right corner */
  tr: string
  /** Bottom-left corner */
  bl: string
  /** Bottom-right corner */
  br: string
}

/**
 * Shape corner configuration with both Unicode and ASCII variants.
 */
export interface ShapeCorners {
  unicode: CornerChars
  ascii: CornerChars
}

/**
 * Corner character lookup table for all shape types.
 *
 * Design principles:
 * - All shapes use orthogonal box structure (no diagonals)
 * - Corner characters indicate shape semantics
 * - ASCII fallbacks use available punctuation
 */
export const SHAPE_CORNERS: Record<AsciiNodeShape, ShapeCorners> = {
  // Standard rectangular shapes
  rectangle: {
    unicode: { tl: '┌', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '+', tr: '+', bl: '+', br: '+' },
  },
  rounded: {
    unicode: { tl: '╭', tr: '╮', bl: '╰', br: '╯' },
    ascii: { tl: '.', tr: '.', bl: "'", br: "'" },
  },

  // Circular shapes - use circle markers at corners
  circle: {
    unicode: { tl: '◯', tr: '◯', bl: '◯', br: '◯' },
    ascii: { tl: 'o', tr: 'o', bl: 'o', br: 'o' },
  },
  doublecircle: {
    unicode: { tl: '◎', tr: '◎', bl: '◎', br: '◎' },
    ascii: { tl: '@', tr: '@', bl: '@', br: '@' },
  },

  // Diamond - decision nodes
  diamond: {
    unicode: { tl: '◇', tr: '◇', bl: '◇', br: '◇' },
    ascii: { tl: '<', tr: '>', bl: '<', br: '>' },
  },

  // Hexagon - process nodes (crop corners — monospace-safe, distinct from rectangle)
  hexagon: {
    unicode: { tl: '⌜', tr: '⌝', bl: '⌞', br: '⌟' },
    ascii: { tl: '*', tr: '*', bl: '*', br: '*' },
  },

  // Stadium/pill shape
  stadium: {
    unicode: { tl: '(', tr: ')', bl: '(', br: ')' },
    ascii: { tl: '(', tr: ')', bl: '(', br: ')' },
  },

  // Subroutine - double vertical bars
  subroutine: {
    unicode: { tl: '╟', tr: '╢', bl: '╟', br: '╢' },
    ascii: { tl: '|', tr: '|', bl: '|', br: '|' },
  },

  // Cylinder/database
  cylinder: {
    unicode: { tl: '╭', tr: '╮', bl: '╰', br: '╯' },
    ascii: { tl: '.', tr: '.', bl: "'", br: "'" },
  },

  // Asymmetric/flag - pointer on left side
  asymmetric: {
    unicode: { tl: '▷', tr: '┐', bl: '▷', br: '┘' },
    ascii: { tl: '>', tr: '+', bl: '>', br: '+' },
  },

  // Trapezoid - wider at bottom (top corners slope inward)
  trapezoid: {
    unicode: { tl: '/', tr: '\\', bl: '└', br: '┘' },
    ascii: { tl: '/', tr: '\\', bl: '+', br: '+' },
  },

  // Trapezoid-alt - wider at top (bottom corners slope inward)
  'trapezoid-alt': {
    unicode: { tl: '┌', tr: '┐', bl: '\\', br: '/' },
    ascii: { tl: '+', tr: '+', bl: '\\', br: '/' },
  },

  // Parallelogram - leans right (both sides slope the same way)
  parallelogram: {
    unicode: { tl: '/', tr: '/', bl: '/', br: '/' },
    ascii: { tl: '/', tr: '/', bl: '/', br: '/' },
  },

  // Parallelogram-alt - leans left
  'parallelogram-alt': {
    unicode: { tl: '\\', tr: '\\', bl: '\\', br: '\\' },
    ascii: { tl: '\\', tr: '\\', bl: '\\', br: '\\' },
  },

  // State diagram pseudostates (special handling, not corner-based)
  'state-start': {
    unicode: { tl: '●', tr: '●', bl: '●', br: '●' },
    ascii: { tl: '*', tr: '*', bl: '*', br: '*' },
  },
  'state-end': {
    unicode: { tl: '◉', tr: '◉', bl: '◉', br: '◉' },
    ascii: { tl: '@', tr: '@', bl: '@', br: '@' },
  },

  // --------------------------------------------------------------------
  // Expanded-syntax shapes (`A@{ shape: ... }`).
  //
  // The ASCII grid has no diagonals and one glyph per corner, so these are
  // distinguished by corner character alone. Shapes whose defining feature
  // is interior (a rule, a cross, a notch) or whose outline the grid cannot
  // express keep box corners and rely on their label — the alternative is a
  // misleading outline, and docs/diagrams.md records which shapes render
  // distinctly in ASCII.
  // --------------------------------------------------------------------

  // Document family — wavy bottom edge suggested by curve glyphs
  document: {
    unicode: { tl: '┌', tr: '┐', bl: '╰', br: '╮' },
    ascii: { tl: '+', tr: '+', bl: "'", br: '~' },
  },
  'stacked-document': {
    unicode: { tl: '┌', tr: '╗', bl: '╰', br: '╮' },
    ascii: { tl: '+', tr: '#', bl: "'", br: '~' },
  },
  'stacked-process': {
    unicode: { tl: '┌', tr: '╗', bl: '└', br: '╝' },
    ascii: { tl: '+', tr: '#', bl: '+', br: '#' },
  },

  // Card — notched top-left corner
  card: {
    unicode: { tl: '╱', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '/', tr: '+', bl: '+', br: '+' },
  },

  // Interior-feature rectangles — box corners, feature not expressible
  'lined-process': {
    unicode: { tl: '┌', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '+', tr: '+', bl: '+', br: '+' },
  },
  'divided-process': {
    unicode: { tl: '┌', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '+', tr: '+', bl: '+', br: '+' },
  },
  'window-pane': {
    unicode: { tl: '┌', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '+', tr: '+', bl: '+', br: '+' },
  },

  // Triangles
  triangle: {
    unicode: { tl: '╱', tr: '╲', bl: '└', br: '┘' },
    ascii: { tl: '/', tr: '\\', bl: '+', br: '+' },
  },
  'flipped-triangle': {
    unicode: { tl: '┌', tr: '┐', bl: '╲', br: '╱' },
    ascii: { tl: '+', tr: '+', bl: '\\', br: '/' },
  },

  // Circles
  'filled-circle': {
    unicode: { tl: '●', tr: '●', bl: '●', br: '●' },
    ascii: { tl: '*', tr: '*', bl: '*', br: '*' },
  },
  'crossed-circle': {
    unicode: { tl: '╳', tr: '╳', bl: '╳', br: '╳' },
    ascii: { tl: 'X', tr: 'X', bl: 'X', br: 'X' },
  },

  // Fork/join bar
  'fork-join': {
    unicode: { tl: '━', tr: '━', bl: '━', br: '━' },
    ascii: { tl: '=', tr: '=', bl: '=', br: '=' },
  },

  // Notched pentagon — clipped top corners
  'notched-pentagon': {
    unicode: { tl: '╱', tr: '╲', bl: '└', br: '┘' },
    ascii: { tl: '/', tr: '\\', bl: '+', br: '+' },
  },

  // Sloped rectangle (manual input) — sloped top edge
  'sloped-rectangle': {
    unicode: { tl: '╱', tr: '┐', bl: '└', br: '┘' },
    ascii: { tl: '/', tr: '+', bl: '+', br: '+' },
  },

  // Flag / paper tape — wavy top and bottom
  flag: {
    unicode: { tl: '╭', tr: '╮', bl: '╰', br: '╯' },
    ascii: { tl: '~', tr: '~', bl: '~', br: '~' },
  },

  // Bow-tie rectangle (stored data) — concave sides
  'bow-tie-rectangle': {
    unicode: { tl: '╲', tr: '╱', bl: '╱', br: '╲' },
    ascii: { tl: '\\', tr: '/', bl: '/', br: '\\' },
  },

  // Delay — one rounded end
  'half-rounded-rectangle': {
    unicode: { tl: '┌', tr: '╮', bl: '└', br: '╯' },
    ascii: { tl: '+', tr: '.', bl: '+', br: "'" },
  },

  // Braces
  brace: {
    unicode: { tl: '╭', tr: '┐', bl: '╰', br: '┘' },
    ascii: { tl: '{', tr: '+', bl: '{', br: '+' },
  },
  'brace-right': {
    unicode: { tl: '┌', tr: '╮', bl: '└', br: '╯' },
    ascii: { tl: '+', tr: '}', bl: '+', br: '}' },
  },
  braces: {
    unicode: { tl: '╭', tr: '╮', bl: '╰', br: '╯' },
    ascii: { tl: '{', tr: '}', bl: '{', br: '}' },
  },

  // Lightning bolt (communication link)
  bolt: {
    unicode: { tl: '╱', tr: '╲', bl: '╲', br: '╱' },
    ascii: { tl: '/', tr: '\\', bl: '\\', br: '/' },
  },

  // Bare text and anchor — no visible outline
  text: {
    unicode: { tl: ' ', tr: ' ', bl: ' ', br: ' ' },
    ascii: { tl: ' ', tr: ' ', bl: ' ', br: ' ' },
  },
  anchor: {
    unicode: { tl: ' ', tr: ' ', bl: ' ', br: ' ' },
    ascii: { tl: ' ', tr: ' ', bl: ' ', br: ' ' },
  },
}

/**
 * Get corner characters for a shape type.
 */
export function getCorners(
  shape: AsciiNodeShape,
  useAscii: boolean,
): CornerChars {
  const corners = SHAPE_CORNERS[shape] ?? SHAPE_CORNERS.rectangle
  return useAscii ? corners.ascii : corners.unicode
}
