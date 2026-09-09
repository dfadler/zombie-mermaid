import { requireElement } from './dom.ts'
import { updateLineNumbers } from './editor-helpers.ts'
import { editor, previewInner, renderTime, statusText } from './elements.ts'
import { showToast } from './toast.ts'

requireElement('copy-source-btn', HTMLElement).addEventListener(
  'click',
  function () {
    navigator.clipboard.writeText(editor.value).then(function () {
      showToast('Source copied!')
    })
  },
)

requireElement('clear-btn', HTMLElement).addEventListener('click', function () {
  editor.value = ''
  updateLineNumbers()
  previewInner.innerHTML =
    '<div class="preview-placeholder">Start typing to render your diagram</div>'
  statusText.textContent = 'Ready'
  statusText.className = ''
  renderTime.textContent = ''
  window.history.replaceState(null, '', window.location.pathname)
})
