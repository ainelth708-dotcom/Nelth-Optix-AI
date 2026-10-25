'use client'

import { Fragment } from 'react'

import { defineComponent } from '@openuidev/react-lang'
import { z } from 'zod/v4'

import { opuiInline } from '@/lib/openui/citation-inline'

import { useCitation } from '@/components/openui/citation-context'
import { MarkdownMessage } from '@/components/openui/message'

import {
  children,
  color,
  cx,
  fg
} from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/style'
import { str } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/text'
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
 * Citation-aware overrides of the vendored prose components.
 *
 * In opui-lang pages, prose (and therefore inline [n] citations) lives in the
 * `text` strings of Text/Title/Caption/ListItem/List/Quote/Table — NOT in the
 * Markdown component. Every one of those components renders its strings with
 * the vendored `inline()` renderer, which emits a bare <a> for [label](url):
 * citations ended up as plain links without favicon or hover card, unlike
 * plain-text answers.
 *
 * Each override below copies the vendored component definition verbatim
 * (same zod props, class names and styles — the base library stays untouched
 * and the vendor CSS applies) and only swaps the string renderer for
 * `opuiInline`, which routes citation URLs through the chip pipeline.
 */

const HEADING_LEVEL: Record<string, number> = {
  '3xl': 1,
  '2xl': 2,
  xl: 2,
  lg: 2,
  md: 3,
  sm: 4
}

const TitleWithCitations = defineComponent({
  name: 'Title',
  props: z.object({
    text: z.string(),
    size: z.enum(['sm', 'md', 'lg', 'xl', '2xl', '3xl']).optional(),
    color: color.optional()
  }),
  description:
    'Heading; md for a card title, lg for a section, 2xl for a big number.',
  component: ({ props }) => {
    const sizeName = props.size ?? 'md'
    return (
      <div
        aria-level={HEADING_LEVEL[sizeName] ?? 3}
        className={`iui-title iui-title-${sizeName}`}
        role="heading"
        style={{ color: fg(props.color) }}
      >
        {opuiInline(str(props.text))}
      </div>
    )
  }
})

/** Text, or a run of strings and inline components such as Icon, Badge, Link or Math. */
const richText = z.union([z.string(), children])
const isElementNode = (value: unknown): value is { type: 'element' } =>
  !!value &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'element'

const TextWithCitations = defineComponent({
  name: 'Text',
  props: z.object({
    text: richText,
    size: z.enum(['xs', 'sm', 'md', 'lg']).optional(),
    color: color.optional(),
    weight: z.enum(['normal', 'medium', 'semibold']).optional(),
    italic: z.boolean().optional(),
    lineThrough: z.boolean().optional(),
    tabularNums: z.boolean().optional(),
    maxLines: z.number().optional()
  }),
  description:
    'Paragraph; supports **bold**, *italic*, `code` and [links](https://…). text may be a list mixing strings and inline components: [Icon("clock", "sm"), " 25 min · ", Badge("Easy")].',
  component: ({ props, renderNode }) => {
    const lines =
      props.maxLines && props.maxLines > 0
        ? Math.round(props.maxLines)
        : undefined
    return (
      <p
        className={cx(
          'iui-text',
          props.size && `iui-text-${props.size}`,
          props.weight && `iui-weight-${props.weight}`,
          lines ? 'iui-clamp' : undefined
        )}
        style={{
          color: fg(props.color),
          fontStyle: props.italic ? 'italic' : undefined,
          textDecoration: props.lineThrough ? 'line-through' : undefined,
          fontVariantNumeric: props.tabularNums ? 'tabular-nums' : undefined,
          WebkitLineClamp: lines
        }}
      >
        {Array.isArray(props.text)
          ? (props.text as unknown[]).flat().map((part, i) =>
              isElementNode(part) ? (
                <span className="iui-inline" key={i}>
                  {renderNode(part)}
                </span>
              ) : (
                <Fragment key={i}>{opuiInline(str(part), `t${i}`)}</Fragment>
              )
            )
          : opuiInline(str(props.text))}
      </p>
    )
  }
})

const CaptionWithCitations = defineComponent({
  name: 'Caption',
  props: z.object({ text: z.string(), color: color.optional() }),
  description: 'Small secondary text.',
  component: ({ props }) => (
    <p className="iui-caption" style={{ color: fg(props.color) }}>
      {opuiInline(str(props.text))}
    </p>
  )
})

type ItemElement = {
  type: 'element'
  typeName: string
  props: Record<string, unknown>
}
const isListItem = (value: unknown): value is ItemElement =>
  !!value &&
  typeof value === 'object' &&
  (value as ItemElement).type === 'element' &&
  (value as ItemElement).typeName === 'ListItem'

const ListItemWithCitations = defineComponent({
  name: 'ListItem',
  props: z.object({
    title: z.string(),
    description: z.string().optional(),
    marker: z.string().optional(),
    children: children.optional()
  }),
  description: 'marker replaces the bullet or number, e.g. a time or an emoji.',
  // Rendered by List; on its own it shows its content.
  component: ({ props, renderNode }) => (
    <div className="iui-list-body">
      <div className="iui-list-title">{opuiInline(str(props.title))}</div>
      {props.description ? (
        <div className="iui-list-description">
          {opuiInline(str(props.description))}
        </div>
      ) : null}
      {props.children ? (
        <div className="iui-list-children">{renderNode(props.children)}</div>
      ) : null}
    </div>
  )
})

const ListWithCitations = defineComponent({
  name: 'List',
  props: z.object({
    items: z.array(z.union([z.string(), ListItemWithCitations.ref])),
    marker: z.enum(['bullet', 'number', 'none']).optional(),
    timeline: z.boolean().optional()
  }),
  description: 'timeline joins the markers with a line.',
  component: ({ props, renderNode }) => {
    const items = (
      Array.isArray(props.items) ? props.items.flat() : []
    ) as unknown[]
    const marker = props.marker ?? 'bullet'
    const textMarkers = items.some(
      item =>
        isListItem(item) &&
        typeof item.props.marker === 'string' &&
        item.props.marker.length > 2
    )
    const Tag = marker === 'number' ? 'ol' : 'ul'
    return (
      <Tag
        className={cx(
          'iui-list',
          `iui-list-${marker}`,
          props.timeline && 'iui-timeline',
          textMarkers && 'iui-list-wide'
        )}
      >
        {items.map((item, i) => {
          if (item == null) return null
          const custom =
            isListItem(item) &&
            typeof item.props.marker === 'string' &&
            (item.props.marker as string).length > 0
              ? (item.props.marker as string)
              : null
          const step = !!custom && /^[0-9A-Za-z]{1,2}$/.test(custom)
          const rich =
            isListItem(item) &&
            (!!item.props.description || !!item.props.children)
          return (
            <li className={cx(rich && 'iui-list-rich')} key={i}>
              <span
                aria-hidden={!custom}
                className={cx(
                  'iui-list-marker',
                  custom &&
                    (step ? 'iui-list-marker-chip' : 'iui-list-marker-text')
                )}
              >
                {step ? (
                  <span>{custom}</span>
                ) : (
                  (custom ?? (marker === 'number' ? i + 1 : null))
                )}
              </span>
              {isListItem(item) ? (
                renderNode(item)
              ) : isElementNode(item) ? (
                renderNode(item)
              ) : (
                <div className="iui-list-body">{opuiInline(str(item))}</div>
              )}
            </li>
          )
        })}
      </Tag>
    )
  }
})

const QuoteWithCitations = defineComponent({
  name: 'Quote',
  props: z.object({ text: z.string(), cite: z.string().optional() }),
  description:
    'A quotation or a callout with a side rule; cite names the source.',
  component: ({ props }) => (
    <blockquote className="iui-quote">
      <p>{opuiInline(str(props.text))}</p>
      {props.cite ? <cite>{opuiInline(str(props.cite))}</cite> : null}
    </blockquote>
  )
})

const NUMERIC_RE = /^[-+−]?[$€£¥₹]?\s?\d[\d,]*(\.\d+)?\s?(%|[kKmMbB]|bn)?$/

const TableWithCitations = defineComponent({
  name: 'Table',
  props: z.object({
    columns: z.array(z.string()),
    rows: z.array(z.array(z.any()))
  }),
  description:
    'Each row lists its cells in column order; a cell may be a component. Number columns align right.',
  component: ({ props, renderNode }) => {
    const columns = Array.isArray(props.columns)
      ? props.columns.map(c => str(c))
      : []
    const rows = (Array.isArray(props.rows) ? props.rows : []).filter(
      Array.isArray
    ) as unknown[][]
    // A column of numbers (or amounts like "$1.2k" and "45%") aligns right.
    const numeric = columns.map((_, c) => {
      const cells = rows
        .map(r => r[c])
        .filter(
          v =>
            v != null &&
            v !== '' &&
            !(
              typeof v === 'string' &&
              /^(n\/a|\u2014|\u2013|-)$/i.test(v.trim())
            )
        )
      return (
        cells.length > 0 &&
        cells.every(
          v =>
            typeof v === 'number' ||
            (typeof v === 'string' && NUMERIC_RE.test(v.trim()))
        )
      )
    })
    const cell = (value: unknown) =>
      isElementNode(value)
        ? renderNode(value)
        : typeof value === 'number'
          ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : opuiInline(str(value))
    return (
      <div className="iui-table-scroll">
        <table className="iui-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th className={cx(numeric[i] && 'is-numeric')} key={i}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {columns.map((_, c) => (
                  <td className={cx(numeric[c] && 'is-numeric')} key={c}>
                    {cell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
})

/**
 * The OpenUI page library: the vendored component library with the prose
 * components swapped for citation-aware copies. The base library stays
 * untouched (Libraries are immutable; `extend` derives a new one).
 */
export const pageLibrary = vendorLibrary.extend({
  components: {
    override: [
      MarkdownWithCitations,
      TitleWithCitations,
      TextWithCitations,
      CaptionWithCitations,
      ListItemWithCitations,
      ListWithCitations,
      QuoteWithCitations,
      TableWithCitations
    ]
  }
})
