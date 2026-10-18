'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

import { createMathPlugin } from '@streamdown/math'
import {
  defaultRehypePlugins,
  Streamdown,
  type StreamdownProps
} from 'streamdown'

import { splitOpenUIResponses } from '@/lib/openui/response'
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

const rehypePlugins = Object.values(defaultRehypePlugins)

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
  const segments = allowOpenUI
    ? splitOpenUIResponses(processedMessage)
    : [{ type: 'markdown' as const, content: processedMessage }]

  return (
    <CitationProvider citationMaps={citationMaps}>
      <div
        className={cn(
          'prose-sm prose-neutral prose-a:text-accent-foreground/50',
          className
        )}
      >
        {segments.map((segment, index) =>
          segment.type === 'openui' ? (
            <div className="openui-answer" key={`openui-${index}`}>
              <OpenUIResponse
                response={segment.content}
                isStreaming={isStreaming}
              />
            </div>
          ) : (
            <Streamdown
              key={`markdown-${index}`}
              {...streamdownProps}
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
        )}
      </div>
    </CitationProvider>
  )
}
