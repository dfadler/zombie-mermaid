import { toast } from './elements.ts'

let toastTimer: ReturnType<typeof setTimeout>
export function showToast(msg: string): void {
  toast.textContent = msg
  toast.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(function () {
    toast.classList.remove('show')
  }, 2500)
}
