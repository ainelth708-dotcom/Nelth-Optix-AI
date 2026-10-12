import { describe, expect, it } from 'vitest'

import { groupMarkdownImages } from '@/lib/render/group-markdown-images'

describe('groupMarkdownImages', () => {
  it('leaves text without images untouched', () => {
    const text = 'Hello **world**\n\nNo images here.'
    expect(groupMarkdownImages(text)).toBe(text)
  })

  it('leaves a single image as Markdown', () => {
    const text = 'Look:\n\n![solo](https://a.test/1.jpg)\n\nDone.'
    expect(groupMarkdownImages(text)).toBe(text)
  })

  it('groups consecutive images into an OpenUI gallery in order', () => {
    const text = [
      'Voici :',
      '',
      '![First](https://a.test/1.jpg)',
      '![Second](https://a.test/2.jpg)',
      '![Third](https://a.test/3.jpg)',
      '',
      'Sources :',
      'https://a.test/1.jpg'
    ].join('\n')
    const out = groupMarkdownImages(text)
    expect(out).toContain('```openui')
    expect(out).toContain('ImageGallery([')
    expect(out).not.toContain('![First]')
    // Order is preserved from the original Markdown lines.
    const i1 = out.indexOf('https://a.test/1.jpg')
    const i2 = out.indexOf('https://a.test/2.jpg')
    const i3 = out.indexOf('https://a.test/3.jpg')
    expect(i1).toBeGreaterThan(-1)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
    // Surrounding text untouched.
    expect(out).toContain('Voici :')
    expect(out).toContain('Sources :')
  })

  it('does not touch images inside fenced code blocks', () => {
    const text = '```\n![code](https://a.test/1.jpg)\n```'
    expect(groupMarkdownImages(text)).toBe(text)
  })

  it('ignores incomplete (streaming) image lines', () => {
    const text = '![done](https://a.test/1.jpg)\n![partial](https://a.test/2'
    const out = groupMarkdownImages(text)
    expect(out).toBe(text)
  })

  it('dedupes consecutive repeats of the same image', () => {
    const text = [
      '![Same](https://a.test/1.jpg)',
      '![Same](https://a.test/1.jpg)',
      '![Other](https://a.test/2.jpg)'
    ].join('\n')
    const out = groupMarkdownImages(text)
    expect(out).toContain('```openui')
    // URL 1 appears once as a src (plus once in the children id list check below).
    const srcCount = (out.match(/"src":"https:\/\/a\.test\/1\.jpg"/g) || [])
      .length
    expect(srcCount).toBe(1)
    expect(out).toContain('"alt":"Other"')
  })

  it('caps a run at 3 images, keeping the first ones in order', () => {
    const text = [
      '![One](https://a.test/1.jpg)',
      '![Two](https://a.test/2.jpg)',
      '![Three](https://a.test/3.jpg)',
      '![Four](https://a.test/4.jpg)',
      '![Five](https://a.test/5.jpg)'
    ].join('\n')
    const out = groupMarkdownImages(text)
    expect(out).toContain('ImageGallery([')
    expect(out).not.toContain('a.test/4.jpg')
    expect(out).not.toContain('a.test/5.jpg')
  })

  it('generated gallery is a fenced OpenUI Lang component tree', () => {
    const text = [
      '![First](https://a.test/1.jpg)',
      '![Second](https://a.test/2.jpg)',
      '![Third](https://a.test/3.jpg)'
    ].join('\n')
    const out = groupMarkdownImages(text)
    expect(out).toMatch(
      /^```openui\nroot = Card\(\[gallery\]\)\ngallery = ImageGallery\(/
    )
    expect(out.match(/"src":"https:\/\/a\.test\/\d\.jpg"/g)).toHaveLength(3)
  })
})
