import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { OpenUIResponse } from './openui-response'

describe('OpenUIResponse', () => {
  test('renders streamed OpenUI Lang with the original component library', async () => {
    const { rerender } = render(
      <OpenUIResponse
        response={
          'root = Card([heading])\nheading = CardHeader("Original OpenUI renderer")'
        }
        isStreaming
      />
    )

    expect(await screen.findByText('Original OpenUI renderer')).toBeVisible()

    rerender(
      <OpenUIResponse
        response={
          'root = Card([heading, body])\nheading = CardHeader("Original OpenUI renderer")\nbody = TextContent("Vercel AI SDK stream")'
        }
        isStreaming={false}
      />
    )

    expect(await screen.findByText('Vercel AI SDK stream')).toBeVisible()
  })
})
