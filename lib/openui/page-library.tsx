'use client'

import { defineComponent } from '@openuidev/react-lang'
import { z } from 'zod/v4'

import { useCitation } from '@/components/citation-context'
import { MarkdownMessage } from '@/components/message'

import { library as vendorLibrary } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/library'

/**
 * Renders openui-lang Markdown blocks through the classic /classic pipeline
 * (MarkdownMessage + Citing), so inline [n] citations become the same nexus-ui
 * citation chips and hover cards as the classic chat.
 */
function CitationMarkdown({ text }: { text: string }) {
  const { citationMaps } = useCitation()
  return <MarkdownMessage message={text} citationMaps={citationMaps} />
}

const MarkdownWithCitations = defineComponent({
  name: 'Markdown',
  props: z.object({ text: z.string() }),
  description: 'Prose with headings, lists, quotes, code and tables.',
  component: ({ props }) => <CitationMarkdown text={props.text} />
})

/**
 * The OpenUI page library: the vendored component library with its Markdown
 * component swapped for the citation-aware classic renderer. The base library
 * stays untouched (Libraries are immutable; `extend` derives a new one).
 */
export const pageLibrary = vendorLibrary.extend({
  components: { override: [MarkdownWithCitations] }
})
