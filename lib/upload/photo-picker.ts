/**
 * Android system photo picker routing (web).
 *
 * Chromium on Android routes `<input type="file">` to the system photo
 * picker (gallery) ONLY when the request is image-only with no capture
 * flag (see SelectFileDialog.shouldUsePhotoPicker in Chromium source).
 * Anything else (mixed MIME types, document types, capture) falls back
 * to the generic Files manager. There is no separate JS API — the input
 * element configured this exact way IS the photo-picker path, degrading
 * gracefully to the gallery intent on older Android and working
 * untouched on desktop/iOS. No storage permission is ever required.
 */

export function getUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : ''
}

export function isAndroidDevice(ua?: string): boolean {
  return /android/i.test(ua ?? getUserAgent())
}

export function isIOSDevice(ua?: string, touchPoints?: number): boolean {
  const agent = ua ?? getUserAgent()
  if (/iPad|iPhone|iPod/i.test(agent)) return true
  // iPadOS in desktop mode reports Macintosh — touch points disambiguate.
  const touch =
    touchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)
  return /Macintosh/i.test(agent) && touch > 1
}

/**
 * Opens the system photo picker for a SINGLE image and resolves with the
 * chosen File, or null when the user cancels. Uses a fresh dedicated
 * input on every call (image/* only, no capture, no multiple) so Android
 * always takes the photo-picker path; the returned File flows straight
 * into the existing upload pipeline (preview, downscale, base64, POST).
 */
export function pickSingleImageViaPhotoPicker(): Promise<File | null> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    // Visually hidden but RENDERED (never display:none): on Android
    // Chrome a display:none input opened by code falls back to the Files
    // manager instead of the gallery picker.
    input.style.cssText =
      'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;'
    let settled = false
    const onFocusBack = () => {
      window.setTimeout(() => {
        if ((input.files?.length ?? 0) === 0) done(null)
      }, 300)
    }
    const done = (file: File | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocusBack)
      input.remove()
      resolve(file)
    }
    input.onchange = () => {
      done(input.files?.[0] ?? null)
    }
    // Dismissals that fire no change event surface as window focus return.
    window.addEventListener('focus', onFocusBack)
    document.body.appendChild(input)
    input.click()
    // Safety net: never leave a dangling promise.
    window.setTimeout(() => done(input.files?.[0] ?? null), 120000)
  })
}
