'use client'

import { useCallback, useRef } from 'react'

import { type ActionEvent, Renderer } from '@openuidev/react-lang'

import { useOptionalChatContext } from '@/lib/contexts/chat-context'
import { appendOpenUIContext } from '@/lib/openui/context'
import { library } from '@/lib/openui/library'

import { useThrottledStreamValue } from './use-throttled-stream-value'

export function OpenUIResponse({
  response,
  isStreaming
}: {
  response: string
  isStreaming: boolean
}) {
  const chatContext = useOptionalChatContext()
  const stateRef = useRef<Record<string, unknown>>({})

  const handleAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === 'continue_conversation') {
        const request = event.humanFriendlyMessage.trim()
        if (!request) {
          console.error('OpenUI follow-up action did not provide a message.')
          return
        }
        if (!chatContext) {
          console.error('OpenUI follow-up action has no active chat context.')
          return
        }

        const state = {
          ...stateRef.current,
          ...(event.formState ? { submittedForm: event.formState } : {})
        }
        chatContext.sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: appendOpenUIContext(request, state)
            }
          ]
        })
        return
      }

      if (event.type === 'open_url') {
        const value = event.params.url
        if (typeof value !== 'string') {
          console.error('OpenUI open-url action did not provide a URL.')
          return
        }

        try {
          const url = new URL(value)
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            console.error('OpenUI attempted to open an unsupported URL.')
            return
          }
          window.open(url.href, '_blank', 'noopener,noreferrer')
        } catch (error) {
          console.error('OpenUI attempted to open an invalid URL:', error)
        }
        return
      }

      console.warn(`Unsupported OpenUI action: ${event.type}`)
    },
    [chatContext]
  )

  const handleStateUpdate = useCallback((state: Record<string, unknown>) => {
    stateRef.current = state
  }, [])

  // The Renderer re-parses + re-evaluates the whole program on every response
  // change; word-level deltas triggered that work ~30 times per second. The
  // throttled value keeps the streaming render smooth, and the final value
  // always resolves immediately when the stream ends.
  const throttledResponse = useThrottledStreamValue(response, isStreaming)

  return (
    <Renderer
      response={throttledResponse}
      library={library}
      isStreaming={isStreaming}
      onAction={handleAction}
      onStateUpdate={handleStateUpdate}
      onError={errors => {
        console.error('OpenUI response validation errors:', errors)
      }}
    />
  )
}
