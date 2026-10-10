import { describe, expect, it, vi } from 'vitest'

import {
  isAndroidDevice,
  isIOSDevice,
  pickSingleImageViaPhotoPicker
} from './photo-picker'

describe('photo-picker environment detection', () => {
  it('detects Android phones and tablets', () => {
    expect(
      isAndroidDevice(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
      )
    ).toBe(true)
    expect(
      isAndroidDevice(
        'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36'
      )
    ).toBe(true)
  })

  it('does not mistake desktop or iOS for Android', () => {
    expect(
      isAndroidDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      )
    ).toBe(false)
    expect(
      isAndroidDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(false)
    expect(isAndroidDevice('')).toBe(false)
  })

  it('detects iOS including iPad desktop mode', () => {
    expect(
      isIOSDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(true)
    expect(
      isIOSDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        5
      )
    ).toBe(true)
    expect(
      isIOSDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        0
      )
    ).toBe(false)
  })
})

describe('pickSingleImageViaPhotoPicker', () => {
  it('creates a picker-eligible input and resolves the chosen File', async () => {
    const promise = pickSingleImageViaPhotoPicker()
    const input = document.body.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    expect(input).not.toBeNull()
    // Photo-picker-eligible config: image-only, no capture, single file.
    expect(input.accept).toBe('image/*')
    expect(input.hasAttribute('capture')).toBe(false)
    expect(input.multiple).toBe(false)
    // Rendered but invisible (display:none would fall back to Files).
    expect(input.style.display).not.toBe('none')
    expect(input.style.opacity).toBe('0')

    const file = new File(['pixels'], 'galerie.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change'))

    await expect(promise).resolves.toBe(file)
    // Cleaned up after itself.
    expect(document.body.contains(input)).toBe(false)
  })

  it('resolves null when the picker is dismissed without a file', async () => {
    vi.useFakeTimers()
    try {
      const promise = pickSingleImageViaPhotoPicker()
      // Simulate focus returning with no file chosen (dismissal).
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(400)
      await expect(promise).resolves.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets capture="environment" when capture option is true', async () => {
    const promise = pickSingleImageViaPhotoPicker({ capture: true })
    const input = document.body.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.getAttribute('capture')).toBe('environment')
    expect(input.accept).toBe('image/*')

    const file = new File(['photo'], 'camera.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change'))

    await expect(promise).resolves.toBe(file)
  })
})
