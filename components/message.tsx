'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

import { createMathPlugin } from '@streamdown/math'
import {
  defaultRehypePlugins,
  Streamdown,
  type StreamdownProps
} from 'streamdown'

import { extractOpenUIResponse } from '@/lib/openui/response'
import { groupMarkdownImages } from '@/lib/render/group-markdown-images'
import { mergeStreamdownSpecRenderer } from '@/lib/render/streamdown-spec'
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

  const openUIResponse = allowOpenUI
    ? extractOpenUIResponse(message || '')
    : null

  if (openUIResponse !== null) {
    return (
      <div className={cn('openui-answer', className)}>
        <OpenUIResponse response={openUIResponse} isStreaming={isStreaming} />
      </div>
    )
  }

  // Process citations to replace [number](#toolCallId) with [number](actual-url).
  // Consecutive Markdown images become a modern gallery grid (spec fence).
  const processedMessage = groupMarkdownImages(
    wrapBareSpecBlocks(processCitations(message || '', citationMaps || {}))
  )

  return (
    <CitationProvider citationMaps={citationMaps}>
      <div
        className={cn(
          'prose-sm prose-neutral prose-a:text-accent-foreground/50',
          className
        )}
      >
        <Streamdown
          {...streamdownProps}
          rehypePlugins={rehypePlugins}
          components={
            {
              ...defaultComponents,
              ...customComponents
            } as unknown as StreamdownProps['components']
          }
        >
          {processedMessage}
        </Streamdown>
      </div>
    </CitationProvider>
  )
}
