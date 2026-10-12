import { describe, expect, it } from 'vitest'
import { dropInvalidColors, isValidCssColor } from '../css-color.ts'

// Every value below was checked against `CSS.supports('fill' | 'color', v)` in
// Chromium 151 when this file was written (#1918).
const VALID = [
  '#fff',
  '#FFF',
  '#ffff',
  '#ffffff',
  '#FFFFFFAA',
  'red',
  'RED',
  'rebeccapurple',
  'lightgoldenrodyellow',
  'transparent',
  'currentColor',
  'currentcolor',
  'none',
  'inherit',
  'initial',
  'unset',
  'revert',
  'rgb(255,0,0)',
  'rgb(255, 0, 0)',
  'rgb(255 0 0)',
  'rgb(255 0 0 / 50%)',
  'rgba(255,0,0,0.5)',
  'rgb(100%,0%,0%)',
  'rgb(1.5, 2.5, 3.5)',
  'rgb(none 0 0)',
  'rgb(1e2 0 0)',
  'rgb(+1 0 0)',
  'rgb(.5 0 0)',
  'hsl(120, 100%, 50%)',
  'hsl(120deg 100% 50%)',
  'hsla(120, 100%, 50%, 0.5)',
  'hsl(0.5turn 50% 50%)',
  'hsl(1rad 50% 50%)',
  'hwb(120 0% 0% / 0.5)',
  'lab(50% 40 59.5)',
  'lch(50% 40 59.5 / 0.5)',
  'oklab(0.5 0.1 0.1)',
  'oklch(0.5 0.2 120)',
  'oklch(50% 0.2 120deg / 50%)',
  'oklch(none none none)',
  'color(srgb 1 0 0)',
  'color(display-p3 1 0 0 / 0.5)',
  'color(xyz-d65 0.5 0.5 0.5)',
  'color(a98-rgb 1 0 0)',
  'color(prophoto-rgb 1 0 0)',
  'color(rec2020 1 0 0)',
  'color(srgb-linear 1 0 0)',
  'var(--x)',
  'var(--x, red)',
  'color-mix(in srgb, red 50%, blue)',
  'color-mix(in srgb, var(--a), var(--b))',
  'light-dark(#fff, #000)',
  'rgb(from red r g b)',
  'rgb(from var(--c) r g b / 50%)',
  'hsl(from #f00 h s l)',
  'rgb(var(--r) 0 0)',
  'rgb(calc(255 / 2) 0 0)',
  'url(#grad)',
  'url(#grad) red',
  'url(#grad) none',
  'url("#grad")',
  'context-fill',
  'context-stroke',
  'Canvas',
  'CanvasText',
  'Highlight',
  'LinkText',
  'ButtonFace',
  'GrayText',
  'AccentColor',
  '  red  ',
  // Parentheses left open are closed by CSS at the end of the value.
  'rgb(1 2 3',
  'var(--x',
  'url(#grad',
  // What the library itself emits for theme tokens.
  'var(--_node-fill)',
  'var(--bg)',
  'color-mix(in srgb, var(--fg) 20%, var(--bg))',
]

const INVALID = [
  'notacolor',
  'redd',
  'fff',
  '#',
  '#12345',
  '#1234567',
  '#ggg',
  'rgb(x)',
  'rgb()',
  'rgb(1,2)',
  'rgb(1,2,3,4,5)',
  'rgb(a,b,c)',
  'rgb 1 2 3',
  'rgb(5. 0 0)',
  'hsl(x)',
  'oklch(a b c)',
  'color(foo 1 0 0)',
  'color(1 0 0)',
  'color(srgb 1 0)',
  'url(#grad) notacolor',
  'calc(1)',
  'red blue',
  '1',
  '10px',
  '',
  ')',
  'rgb(1 2 3))',
]

describe('isValidCssColor', () => {
  it.each(VALID)('accepts %j', (v) => {
    expect(isValidCssColor(v)).toBe(true)
  })

  it.each(INVALID)('rejects %j', (v) => {
    expect(isValidCssColor(v)).toBe(false)
  })

  it('accepts all 148 CSS named colours', () => {
    const names =
      'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(
        ' ',
      )
    expect(names).toHaveLength(148)
    expect(names.filter((n) => !isValidCssColor(n))).toEqual([])
  })
})

describe('dropInvalidColors', () => {
  it('drops only the invalid colour declarations', () => {
    expect(
      dropInvalidColors({
        fill: '#ff0',
        stroke: 'notacolor',
        color: 'rgb(x)',
        'stroke-width': '4px',
        'font-family': 'notacolor',
      }),
    ).toEqual({
      fill: '#ff0',
      'stroke-width': '4px',
      'font-family': 'notacolor',
    })
  })

  it('keeps a style whose colours are all valid, without mutating the input', () => {
    const input = { fill: 'var(--x)', stroke: 'none', color: 'red' }
    expect(dropInvalidColors(input)).toEqual(input)
    const bad = { fill: 'x' }
    dropInvalidColors(bad)
    expect(bad).toEqual({ fill: 'x' })
  })
})
