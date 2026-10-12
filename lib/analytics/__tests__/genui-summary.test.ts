import { describe, expect, it } from 'vitest'

import { summarizeGenui } from '@/lib/analytics/genui-summary'

const imageBlock = [
  '```openui',
  'root = Card([gallery])',
  'gallery = ImageGallery([{"src":"https://example.com/a.jpg"}, {"src":"https://example.com/b.jpg"}])',
  '```'
].join('\n')

const relatedBlock = [
  '```openui',
  'root = Card([followUps])',
  'followUps = FollowUpBlock([q1])',
  'q1 = FollowUpItem("Q1")',
  '```'
].join('\n')

describe('summarizeGenui', () => {
  it('returns null when there are no generated UI blocks', () => {
    expect(summarizeGenui('just some markdown text')).toBeNull()
  })

  it('counts images in content blocks and excludes the related block', () => {
    const text = `Here are some photos.\n\n${imageBlock}\n\nMore text.\n\n${relatedBlock}`
    const summary = summarizeGenui(text)

    expect(summary).toEqual({
      blockCount: 2,
      contentBlockCount: 1,
      imageCount: 2,
      hasImage: true,
      hasRelated: true,
      componentTypes: ['Card', 'ImageGallery']
    })
  })

  it('reports no image when only a related block is present', () => {
    const summary = summarizeGenui(`Answer.\n\n${relatedBlock}`)

    expect(summary).toMatchObject({
      blockCount: 1,
      contentBlockCount: 0,
      imageCount: 0,
      hasImage: false,
      hasRelated: true
    })
  })
})
