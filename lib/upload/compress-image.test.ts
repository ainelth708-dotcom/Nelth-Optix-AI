import { beforeEach, describe, expect, it, vi } from 'vitest'

import { compressImageForUpload, computeTargetSize } from './compress-image'

describe('computeTargetSize', () => {
  it('caps the long edge preserving ratio', () => {
    expect(computeTargetSize(4000, 3000, 1600)).toEqual({
      width: 1600,
      height: 1200
    })
    expect(computeTargetSize(3000, 4000, 1600)).toEqual({
      width: 1200,
      height: 1600
    })
  })

  it('leaves small images untouched', () => {
    expect(computeTargetSize(800, 600, 1600)).toEqual({
      width: 800,
      height: 600
    })
  })
})

describe('compressImageForUpload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('passes small files through byte-identical without canvas', async () => {
    const file = new File(['tiny-bytes'], 'petit.png', {
      type: 'image/png'
    })
    const createSpy = vi.spyOn(document, 'createElement')
    const out = await compressImageForUpload(file, { maxBytes: 900_000 })
    expect(out.compressed).toBe(false)
    expect(out.finalBytes).toBe(file.size)
    expect(out.mime).toBe('image/png')
    // No canvas needed for passthrough.
    expect(createSpy.mock.calls.some(args => args[0] === 'canvas')).toBe(false)
  })

  it('falls back to original when canvas 2d is unavailable', async () => {
    // jsdom has no canvas implementation: getContext throws.
    const big = new Uint8Array(2_000_000)
    const file = new File([big], 'grand.jpg', { type: 'image/jpeg' })
    const out = await compressImageForUpload(file, { maxBytes: 900_000 })
    expect(out.compressed).toBe(false)
    expect(out.finalBytes).toBe(file.size)
  })

  it('walks qualities down until the budget fits (mocked canvas)', async () => {
    // Fake 2000x1500 decode.
    const realCreate = document.createElement.bind(document)
    const sizes = [1_500_000, 800_000]
    let calls = 0
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') return realCreate(tag)
      return {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toDataURL: (_type: string, q: number) => {
          const bytes = sizes[Math.min(calls++, sizes.length - 1)]
          void q
          return 'data:image/jpeg;base64,' + 'A'.repeat(bytes)
        }
      }
    }) as unknown as typeof document.createElement)
    class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 2000
      naturalHeight = 1500
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => {}
    })

    const file = new File([new Uint8Array(3_000_000)], 'photo.jpg', {
      type: 'image/jpeg'
    })
    const out = await compressImageForUpload(file, {
      maxBytes: 900_000,
      qualities: [0.85, 0.7]
    })
    expect(out.compressed).toBe(true)
    expect(out.finalBytes).toBeLessThanOrEqual(900_000)
    expect(out.mime).toBe('image/jpeg')
    expect(out.width).toBe(1600)
    expect(out.height).toBe(1200)
    // First quality missed budget, second hit it.
    expect(calls).toBe(2)
  })
})
