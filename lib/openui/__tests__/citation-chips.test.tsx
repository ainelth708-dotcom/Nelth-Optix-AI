import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownMessage } from '@/components/openui/message'

const RESULTS = [
  {
    title: 'Elon Musk',
    url: 'https://de.wikipedia.org/wiki/Elon_Musk',
    content: 'c'
  },
  {
    title: 'T-online',
    url: 'https://www.t-online.de/themen/elon-musk/',
    content: 'c'
  }
]

const citationMaps = {
  'preloaded-search': Object.fromEntries(
    RESULTS.map((result, index) => [index + 1, result])
  )
}

const TEXT = 'Musk est un entrepreneur [1][2]. SpaceX [1].'

describe('inline citation chips', () => {
  it('renders a favicon chip for every citation once the answer is complete', () => {
    const { container } = render(
      <MarkdownMessage message={TEXT} citationMaps={citationMaps} />
    )
    const html = container.innerHTML
    expect(html.match(/data-slot="citation-trigger"/g) || []).toHaveLength(3)
    expect(html.match(/s2\/favicons/g) || []).toHaveLength(3)
  })

  it('keeps the favicon chips while the answer is still streaming', () => {
    // While streaming, Streamdown wraps every word in an animated span, so
    // the link children are elements: the citation label must still be
    // extracted from the React tree, otherwise the chip falls back to a
    // plain link without its favicon.
    const { container } = render(
      <MarkdownMessage message={TEXT} citationMaps={citationMaps} isStreaming />
    )
    const html = container.innerHTML
    expect(html.match(/data-slot="citation-trigger"/g) || []).toHaveLength(3)
    expect(html.match(/s2\/favicons/g) || []).toHaveLength(3)
    // No plain link should remain: every anchor is a citation chip.
    expect(html.match(/<a /g) || []).toHaveLength(3)
  })
})
