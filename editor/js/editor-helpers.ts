import { cursorPos, editor, lineNumbers } from './elements.ts'
import { scheduleRender } from './rendering.ts'

export function updateLineNumbers(): void {
  const lines = editor.value.split('\n').length
  let html = ''
  for (let i = 1; i <= lines; i++) html += i + '\n'
  lineNumbers.textContent = html
}

export function updateCursorPos(): void {
  const val = editor.value
  const pos = editor.selectionStart ?? 0
  const lines = val.substring(0, pos).split('\n')
  const line = lines.length
  const col = (lines[lines.length - 1]?.length ?? 0) + 1
  cursorPos.textContent = 'Ln ' + line + ', Col ' + col
}

editor.addEventListener('scroll', function () {
  lineNumbers.scrollTop = editor.scrollTop
})

editor.addEventListener('input', function () {
  updateLineNumbers()
  scheduleRender()
})

editor.addEventListener('keydown', function (e) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const start = editor.selectionStart ?? 0
    const end = editor.selectionEnd ?? 0
    editor.value =
      editor.value.substring(0, start) + '  ' + editor.value.substring(end)
    editor.selectionStart = editor.selectionEnd = start + 2
    updateLineNumbers()
    scheduleRender()
    return
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    scheduleRender(0)
    return
  }
})

editor.addEventListener('keyup', updateCursorPos)
editor.addEventListener('click', updateCursorPos)
