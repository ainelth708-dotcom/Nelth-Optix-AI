'use client'

import { defineComponent } from '@openuidev/react-lang'
import { z } from 'zod/v4'

import {
  getOpenUISources,
  useOpenUICitationPanel,
  useOpenUISources
} from '@/components/openui-citation-context'

function SearchCitationNode({
  number,
  toolCallId
}: {
  number: number
  toolCallId: string
}) {
  const metadata = useOpenUISources()
  const { openCitationPanel } = useOpenUICitationPanel()
  const sources = getOpenUISources(metadata)
  const source = sources.find(item => item.id === `${toolCallId}:web:${number}`)

  if (!source) return null

  return (
    <button
      type="button"
      aria-label={`Open source ${number}: ${source.title}`}
      onClick={() => openCitationPanel(sources, source.id)}
      className="mx-0.5 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-full border border-border/70 bg-muted px-1.5 align-middle text-[10px] font-medium leading-none text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
    >
      {number}
    </button>
  )
}

export const SearchCitation = defineComponent({
  name: 'SearchCitation',
  props: z.object({
    number: z.number().int().positive(),
    toolCallId: z.string()
  }),
  description:
    'Inline citation for a web search result. Place SearchCitation(resultNumber, toolCallId) after each factual claim from web_search, using the exact result number and toolCallId from that search result.',
  component: ({ props }) => (
    <SearchCitationNode number={props.number} toolCallId={props.toolCallId} />
  )
})
