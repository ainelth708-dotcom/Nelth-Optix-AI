'use client'

import { Fragment, type ReactNode } from 'react'

import type { SearchResultItem } from '@/lib/types'

import { useCitation } from '@/components/openui/citation-context'
import { CitationLink } from '@/components/openui/citation-link'

import { webUrl } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/style'

/**
 * Inline Markdown renderer for opui-lang strings, citation-aware.
 *
 * The vendored renderer (`.../src/lib/components/markdown.tsx`, `inline()`)
 * turns `[label](url)` into a bare vendor-styled <a>, so [n] citations inside
 * Text/Title/Caption/List/Quote/Table strings never become the favicon chips
 * that plain-text answers show. This copy keeps the exact same token grammar
 * (code, bold, strike, italic, link) and visual classes — except link tokens,
 * which resolve against the OpenUI citation context: a matching URL renders
 * the same CitationLink chip (favicon + hover card) as the classic pipeline,
 * everything else stays a plain <a className="iui-link">.
 */
const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(~~[^~\n]+?~~)|(\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)|(\[[^\]\n]+\]\([^)\s]+\))/

function InlineCitationLink({ href, label }: { href: string; label: string }) {
  const { citationMaps } = useCitation()

  // Same URL-based lookup as Citing: after processCitations the label is the
  // display domain, so matching against the citation maps by URL is reliable.
  let citationData: SearchResultItem | undefined = undefined
  if (citationMaps) {
    const decodedHref = decodeURI(href)
    for (const toolCallId in citationMaps) {
      const citationMap = citationMaps[toolCallId]
      for (const citationNum in citationMap) {
        if (citationMap[citationNum].url === decodedHref) {
          citationData = citationMap[citationNum]
          break
        }
      }
      if (citationData) break
    }
  }

  // Not a known citation: keep the exact vendor link look (iui-link, new tab).
  if (!citationData) {
    return (
      <a
        className="iui-link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    )
  }

  // Real citation: the same nexus-ui chip the plain-text answers render.
  return (
    <CitationLink href={href} citationData={citationData}>
      {label}
    </CitationLink>
  )
}

export function opuiInline(text: string, key = 'i'): ReactNode {
  const out: ReactNode[] = []
  let rest = text
  let n = 0
  while (rest) {
    const m = INLINE_RE.exec(rest)
    if (!m) {
      out.push(rest)
      break
    }
    if (m.index) out.push(rest.slice(0, m.index))
    const token = m[0]
    const k = `${key}-${n++}`
    if (m[1])
      out.push(
        <code className="iui-code" key={k}>
          {token.slice(1, -1)}
        </code>
      )
    else if (m[2])
      out.push(<strong key={k}>{opuiInline(token.slice(2, -2), k)}</strong>)
    else if (m[3]) out.push(<s key={k}>{opuiInline(token.slice(2, -2), k)}</s>)
    else if (m[4])
      out.push(<em key={k}>{opuiInline(token.slice(1, -1), k)}</em>)
    else {
      const close = token.indexOf('](')
      const label = token.slice(1, close)
      const href = webUrl(token.slice(close + 2, -1))
      out.push(
        href ? (
          <InlineCitationLink href={href} key={k} label={label} />
        ) : (
          <Fragment key={k}>{opuiInline(label, k)}</Fragment>
        )
      )
    }
    rest = rest.slice(m.index + token.length)
  }
  return out.length === 1 ? out[0] : out
}
