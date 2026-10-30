'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

import { createMathPlugin } from '@streamdown/math'
import {
  type AnimateOptions,
  defaultRehypePlugins,
  Streamdown,
  type StreamdownProps
} from 'streamdown'

import { splitOpenUIResponses } from '@/lib/openui/response'
import { parseNelthUISegments } from '@/lib/nelth-ui/streaming-parser'
import { NelthUIView } from './nelth-ui/nelth-ui-view'
import { groupMarkdownImages } from '@/lib/render/group-markdown-images'
import { mergeStreamdownSpecRenderer } from '@/lib/render/streamdown-spec'
import { wrapBareOpenUIBlocks } from '@/lib/render/wrap-bare-openui'
import { wrapBareSpecBlocks } from '@/lib/render/wrap-bare-spec'
import type { SearchResultItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { processCitations } from '@/lib/utils/citation'

import { defaultComponents } from './assistant-ui/markdown-text'
import { CitationProvider } from './citation-context'
import { Citing } from './custom-link'

const OpenUIResponse = dynamic(
  () => import('./openui-response').then(module => module.OpenUIResponse),
  { ssr: false }
)

import 'katex/dist/katex.min.css'
// Keyframes and rules ([data-sd-animate]) for the streaming fadeIn animation.
import 'streamdown/styles.css'

const rehypePlugins = Object.values(defaultRehypePlugins)

// Fade new words in while the answer streams instead of letting them pop in.
// Streamdown only runs this animation while `isAnimating` is true and never
// re-animates characters that were already visible during previous renders.
// Same options as the /agent path (components/openui/message.tsx) so both
// shells fade identically.
const STREAMING_ANIMATION: AnimateOptions = {
  animation: 'fadeIn',
  duration: 260,
  easing: 'ease-out',
  sep: 'word',
  stagger: 24
}

const customComponents = {
  a: Citing
}

export function MarkdownMessage({
  message,
  className,
  citationMaps,
  allowOpenUI = false,
  isStreaming = false
}: {
  message: string
  className?: string
  citationMaps?: Record<string, Record<number, SearchResultItem>>
  allowOpenUI?: boolean
  isStreaming?: boolean
}) {
  const streamdownProps = useMemo<Partial<StreamdownProps>>(
    () => ({
      mode: 'streaming' as const,
      animated: STREAMING_ANIMATION,
      plugins: mergeStreamdownSpecRenderer({
        math: createMathPlugin({ singleDollarTextMath: true })
      })
    }),
    []
  )

  // Process citations to replace [number](#toolCallId) with [number](actual-url).
  // Consecutive Markdown images become OpenUI galleries. Bare OpenUI Lang
  // programs (missing their ```openui fence) are fenced so the renderer runs.
  const processedMessage = allowOpenUI
    ? groupMarkdownImages(
        wrapBareOpenUIBlocks(
          wrapBareSpecBlocks(
            processCitations(message || '', citationMaps || {})
          )
        )
      )
    : wrapBareSpecBlocks(processCitations(message || '', citationMaps || {}))
  const segments = useMemo(() => {
    if (allowOpenUI) {
      return splitOpenUIResponses(processedMessage).map(s => ({
        type: s.type,
        content: s.content,
        raw: s.content,
        spec: null
      }))
    }
    return parseNelthUISegments(processedMessage)
  }, [processedMessage, allowOpenUI])

  return (
    <CitationProvider citationMaps={citationMaps}>
      <div
        className={cn(
          'prose-sm prose-neutral prose-a:text-accent-foreground/50',
          className
        )}
      >
        {segments.map((segment, index) => {
          if (segment.type === 'openui') {
            return (
              <div className="openui-answer" key={`openui-${index}`}>
                <OpenUIResponse
                  response={segment.content}
                  isStreaming={isStreaming}
                />
              </div>
            )
          }

          if (segment.type === 'nelth-ui') {
            return (
              <NelthUIView
                key={`nelth-ui-${index}`}
                spec={(segment as any).spec}
                raw={(segment as any).raw}
                isStreaming={isStreaming}
              />
            )
          }

          return (
            <Streamdown
              key={`markdown-${index}`}
              {...streamdownProps}
              isAnimating={isStreaming}
              rehypePlugins={rehypePlugins}
              components={
                {
                  ...defaultComponents,
                  ...customComponents
                } as unknown as StreamdownProps['components']
              }
            >
              {segment.content}
            </Streamdown>
          )
        })}
      </div>
    </CitationProvider>
  )
}
