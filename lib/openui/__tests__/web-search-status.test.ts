import { describe, expect, it } from 'vitest'

import { createSearchStatusWatcher } from '../web-search-status'

function setup() {
  const states: boolean[] = []
  const push = createSearchStatusWatcher(searching => states.push(searching))
  return { states, push }
}

const statusEvent = (status: string) =>
  `data: ${JSON.stringify({ type: 'nelth.search.status', status })}\n\n`

describe('createSearchStatusWatcher', () => {
  it('reports searching then done', () => {
    const { states, push } = setup()

    push(statusEvent('searching'))
    push(statusEvent('done'))

    expect(states).toEqual([true, false])
  })

  it('survives chunks that split events mid-line', () => {
    const { states, push } = setup()
    const searching = statusEvent('searching')
    const done = statusEvent('done')

    push(searching.slice(0, 10))
    push(searching.slice(10, 30))
    push(searching.slice(30) + done.slice(0, 12))
    push(done.slice(12))

    expect(states).toEqual([true, false])
  })

  it('coalesces repeated statuses', () => {
    const { states, push } = setup()

    push(statusEvent('searching') + statusEvent('searching'))
    push(statusEvent('done') + statusEvent('done'))

    expect(states).toEqual([true, false])
  })

  it('ignores keep-alive comments and other responses events', () => {
    const { states, push } = setup()

    push(': keep-alive\n\n')
    push(
      'data: {"type":"response.output_item.added","item":{"id":"m1","type":"message","role":"assistant"}}\n\n'
    )
    push('data: {"type":"response.output_text.delta","delta":"salut"}\n\n')
    push('data: [DONE]\n\n')

    expect(states).toEqual([])
  })

  it('ignores payloads that merely contain the event name', () => {
    const { states, push } = setup()

    push(
      'data: {"type":"response.output_text.delta","delta":"nelth.search.status"}\n\n'
    )

    expect(states).toEqual([])
  })

  it('ignores unknown statuses and malformed JSON', () => {
    const { states, push } = setup()

    push(statusEvent('pending'))
    push('data: {"type":"nelth.search.status","status":\n\n')

    expect(states).toEqual([])
  })

  it('handles several events arriving in one chunk', () => {
    const { states, push } = setup()

    push(
      [
        ': keep-alive',
        '',
        statusEvent('searching').trimEnd(),
        '',
        'data: {"type":"response.output_text.delta","delta":"a"}',
        '',
        statusEvent('done').trimEnd(),
        ''
      ].join('\n')
    )

    expect(states).toEqual([true, false])
  })
})
