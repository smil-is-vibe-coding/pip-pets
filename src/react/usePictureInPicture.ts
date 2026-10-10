import { useCallback, useEffect, useState } from 'react'

// Document Picture-in-Picture isn't in TypeScript's DOM lib yet.
interface DocumentPictureInPictureOptions {
  width?: number
  height?: number
  disallowReturnToOpener?: boolean
  preferInitialWindowPlacement?: boolean
}
interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>
  readonly window: Window | null
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

export const pipSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window

/** Stylesheets aren't shared with the PiP document, so copy them over once. */
function copyStyles(target: Document) {
  for (const sheet of document.styleSheets) {
    try {
      const style = target.createElement('style')
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join('\n')
      target.head.appendChild(style)
    } catch {
      // Cross-origin sheet (e.g. Google Fonts): link it instead.
      if (!sheet.href) continue
      const link = target.createElement('link')
      link.rel = 'stylesheet'
      link.href = sheet.href
      target.head.appendChild(link)
    }
  }
}

/**
 * Opens/closes a Document Picture-in-Picture window. Render into it with
 * `createPortal(..., pipWindow.document.body)`. `open` must run from a click.
 */
export function usePictureInPicture() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  const open = useCallback(async (options: DocumentPictureInPictureOptions = {}) => {
    const api = window.documentPictureInPicture
    if (!api) return null
    if (api.window) return api.window
    const win = await api.requestWindow({ width: 300, height: 300, ...options })
    copyStyles(win.document)
    win.document.title = document.title
    win.document.body.classList.add('pip-body')
    win.addEventListener('pagehide', () => setPipWindow(null), { once: true })
    setPipWindow(win)
    return win
  }, [])

  const close = useCallback(() => pipWindow?.close(), [pipWindow])

  // Close the PiP window if the component that owns it goes away.
  useEffect(() => () => pipWindow?.close(), [pipWindow])

  return { supported: pipSupported(), pipWindow, open, close }
}
