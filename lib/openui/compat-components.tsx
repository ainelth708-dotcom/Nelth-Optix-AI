'use client'

import { Fragment } from 'react'
import { defineComponent, useTriggerAction } from '@openuidev/react-lang'
import { z } from 'zod/v4'
import { opuiInline } from '@/lib/openui/citation-inline'
import {
  children,
  color,
  cx,
  fg
} from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/style'
import { str } from '@/open-intelligent-ui-main/open-intelligent-ui-main/src/lib/components/text'

/**
 * Fallback & Compatibility Components for OpenUI Lang.
 *
 * When models (or legacy completions) emit components from older spec signatures
 * (such as CardHeader, TextContent, FollowUpBlock, Callout, etc.), these shims
 * map them to modern Open Intelligent UI primitives so they ALWAYS render
 * properly instead of being dropped by the renderer and leaving an empty card.
 */

export const CardHeader = defineComponent({
  name: 'CardHeader',
  props: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional()
  }),
  description: 'Header with title and optional subtitle.',
  component: ({ props }) => (
    <div className="iui-col" style={{ gap: 2, marginBottom: 8 }}>
      {props.title && (
        <div className="iui-title iui-title-md" role="heading" aria-level={3}>
          {opuiInline(str(props.title))}
        </div>
      )}
      {props.subtitle && (
        <div className="iui-caption">{opuiInline(str(props.subtitle))}</div>
      )}
    </div>
  )
})

export const TextContent = defineComponent({
  name: 'TextContent',
  props: z.object({
    text: z.string(),
    size: z
      .enum(['small', 'default', 'large', 'small-heavy', 'large-heavy'])
      .optional()
  }),
  description: 'Text block with markdown support.',
  component: ({ props }) => (
    <p className="iui-text iui-text-sm" style={{ margin: '4px 0' }}>
      {opuiInline(str(props.text))}
    </p>
  )
})

export const MarkDownRenderer = defineComponent({
  name: 'MarkDownRenderer',
  props: z.object({
    textMarkdown: z.string(),
    variant: z.enum(['clear', 'card', 'sunk']).optional()
  }),
  description: 'Renders markdown text.',
  component: ({ props }) => (
    <div className={cx('iui-text', props.variant === 'sunk' && 'iui-card-soft')}>
      {opuiInline(str(props.textMarkdown))}
    </div>
  )
})

export const FollowUpItem = defineComponent({
  name: 'FollowUpItem',
  props: z.object({
    text: z.string().optional(),
    label: z.string().optional()
  }),
  description: 'A follow-up suggestion button.',
  component: ({ props }) => {
    const trigger = useTriggerAction()
    const label = str(props.text || props.label || '')
    if (!label) return null
    return (
      <button
        type="button"
        className="iui-button iui-button-soft"
        style={{
          fontSize: 13,
          padding: '6px 14px',
          borderRadius: 999,
          cursor: 'pointer'
        }}
        onClick={() => {
          void trigger(label)
        }}
      >
        {label}
      </button>
    )
  }
})

export const FollowUpBlock = defineComponent({
  name: 'FollowUpBlock',
  props: z.object({
    children: children.optional(),
    items: z.array(z.any()).optional()
  }),
  description: 'Container for follow-up suggestions.',
  component: ({ props, renderNode }) => {
    const content = props.children || props.items
    if (!content) return null
    return (
      <div
        className="iui-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 12
        }}
      >
        {renderNode(content)}
      </div>
    )
  }
})

export const Callout = defineComponent({
  name: 'Callout',
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    variant: z.string().optional()
  }),
  description: 'Callout notification banner.',
  component: ({ props }) => (
    <div
      className="iui-card iui-card-soft"
      style={{ padding: 14, margin: '6px 0' }}
    >
      {props.title && (
        <div className="iui-title iui-title-sm">{str(props.title)}</div>
      )}
      {props.description && (
        <p className="iui-text iui-text-sm" style={{ marginTop: 2 }}>
          {opuiInline(str(props.description))}
        </p>
      )}
    </div>
  )
})

export const TextCallout = defineComponent({
  name: 'TextCallout',
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    variant: z.string().optional()
  }),
  description: 'Text callout banner.',
  component: ({ props }) => (
    <div
      className="iui-card iui-card-soft"
      style={{ padding: 14, margin: '6px 0' }}
    >
      {props.title && (
        <div className="iui-title iui-title-sm">{str(props.title)}</div>
      )}
      {props.description && (
        <p className="iui-text iui-text-sm" style={{ marginTop: 2 }}>
          {opuiInline(str(props.description))}
        </p>
      )}
    </div>
  )
})

export const TagBlock = defineComponent({
  name: 'TagBlock',
  props: z.object({
    tags: z.array(z.string()).optional(),
    children: children.optional()
  }),
  description: 'A row of badge tags.',
  component: ({ props, renderNode }) => (
    <div
      className="iui-row"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '4px 0' }}
    >
      {props.tags?.map((tag, i) => (
        <span key={i} className="iui-badge">
          {str(tag)}
        </span>
      ))}
      {props.children && renderNode(props.children)}
    </div>
  )
})

export const Separator = defineComponent({
  name: 'Separator',
  props: z.object({
    orientation: z.enum(['horizontal', 'vertical']).optional()
  }),
  description: 'Visual divider line.',
  component: () => <hr className="iui-divider" />
})

export const Buttons = defineComponent({
  name: 'Buttons',
  props: z.object({
    children
  }),
  description: 'A row of buttons.',
  component: ({ props, renderNode }) => (
    <div className="iui-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {renderNode(props.children)}
    </div>
  )
})

export const InlineHeader = defineComponent({
  name: 'InlineHeader',
  props: z.object({
    title: z.string(),
    subtitle: z.string().optional()
  }),
  description: 'Section header.',
  component: ({ props }) => (
    <div style={{ marginBottom: 6 }}>
      <div className="iui-title iui-title-md">{opuiInline(str(props.title))}</div>
      {props.subtitle && (
        <div className="iui-caption">{opuiInline(str(props.subtitle))}</div>
      )}
    </div>
  )
})

export const ImageBlock = defineComponent({
  name: 'ImageBlock',
  props: z.object({
    src: z.string(),
    alt: z.string().optional()
  }),
  description: 'Image display.',
  component: ({ props }) => (
    <div style={{ borderRadius: 12, overflow: 'hidden', margin: '8px 0' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.src}
        alt={props.alt || ''}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        loading="lazy"
      />
    </div>
  )
})

export const ImageGallery = defineComponent({
  name: 'ImageGallery',
  props: z.object({
    images: z.array(
      z.object({
        src: z.string(),
        alt: z.string().optional(),
        details: z.string().optional()
      })
    )
  }),
  description: 'Image gallery grid.',
  component: ({ props }) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        margin: '8px 0'
      }}
    >
      {props.images.map((img, i) => (
        <div
          key={i}
          style={{ borderRadius: 10, overflow: 'hidden', background: 'var(--iui-surface)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.src}
            alt={img.alt || ''}
            style={{ width: '100%', height: 140, objectFit: 'cover' }}
            loading="lazy"
          />
          {img.details && (
            <div style={{ padding: '6px 8px', fontSize: 12 }} className="iui-caption">
              {img.details}
            </div>
          )}
        </div>
      ))}
    </div>
  )
})

export const TravelHeading = defineComponent({
  name: 'TravelHeading',
  props: z.object({
    title: z.string(),
    variant: z.string().optional()
  }),
  description: 'Travel section heading.',
  component: ({ props }) => (
    <div className="iui-title iui-title-lg" style={{ margin: '8px 0 4px' }}>
      {opuiInline(str(props.title))}
    </div>
  )
})

export const TravelProse = defineComponent({
  name: 'TravelProse',
  props: z.object({
    text: z.string()
  }),
  description: 'Travel description text.',
  component: ({ props }) => (
    <p className="iui-text iui-text-sm" style={{ margin: '4px 0' }}>
      {opuiInline(str(props.text))}
    </p>
  )
})

export const TravelStop = defineComponent({
  name: 'TravelStop',
  props: z.object({
    id: z.string().optional(),
    title: z.string(),
    time: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    icon: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    wikiTitle: z.string().optional()
  }),
  description: 'An itinerary stop.',
  component: ({ props }) => (
    <div
      className="iui-card iui-card-soft"
      style={{ padding: 12, margin: '6px 0' }}
    >
      <div className="iui-row" style={{ justifyContent: 'space-between' }}>
        <div className="iui-title iui-title-sm">
          {props.icon ? `${props.icon} ` : ''}
          {str(props.title)}
        </div>
        {props.time && <span className="iui-badge">{props.time}</span>}
      </div>
      {props.description && (
        <p className="iui-text iui-text-sm" style={{ marginTop: 4 }}>
          {opuiInline(str(props.description))}
        </p>
      )}
    </div>
  )
})

export const TravelItinerary = defineComponent({
  name: 'TravelItinerary',
  props: z.object({
    title: z.string().optional(),
    stops: children
  }),
  description: 'A travel itinerary list.',
  component: ({ props, renderNode }) => (
    <div style={{ margin: '8px 0' }}>
      {props.title && (
        <div className="iui-title iui-title-md" style={{ marginBottom: 6 }}>
          {str(props.title)}
        </div>
      )}
      <div className="iui-col" style={{ gap: 6 }}>
        {renderNode(props.stops)}
      </div>
    </div>
  )
})

export const TravelSuggestions = defineComponent({
  name: 'TravelSuggestions',
  props: z.object({
    title: z.string().optional(),
    stops: children
  }),
  description: 'Suggested stops.',
  component: ({ props, renderNode }) => (
    <div style={{ margin: '8px 0' }}>
      {props.title && (
        <div className="iui-title iui-title-sm" style={{ marginBottom: 4 }}>
          {str(props.title)}
        </div>
      )}
      <div className="iui-col" style={{ gap: 6 }}>
        {renderNode(props.stops)}
      </div>
    </div>
  )
})

export const TravelGallery = defineComponent({
  name: 'TravelGallery',
  props: z.object({
    children
  }),
  description: 'Travel photos carousel.',
  component: ({ props, renderNode }) => (
    <div
      className="iui-row"
      style={{ display: 'flex', overflowX: 'auto', gap: 8, padding: '4px 0' }}
    >
      {renderNode(props.children)}
    </div>
  )
})

export const TravelImage = defineComponent({
  name: 'TravelImage',
  props: z.object({
    src: z.string().optional(),
    caption: z.string().optional(),
    credits: z.string().optional(),
    query: z.string().optional()
  }),
  description: 'Travel photo.',
  component: ({ props }) => (
    <div
      style={{
        flexShrink: 0,
        width: 180,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--iui-surface)'
      }}
    >
      {props.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.src}
          alt={props.caption || ''}
          style={{ width: '100%', height: 110, objectFit: 'cover' }}
          loading="lazy"
        />
      )}
      {props.caption && (
        <div style={{ padding: '4px 6px', fontSize: 11 }} className="iui-caption">
          {props.caption}
        </div>
      )}
    </div>
  )
})

export const TravelMap = defineComponent({
  name: 'TravelMap',
  props: z.object({
    stops: z.any().optional()
  }),
  description: 'Map view of stops.',
  component: () => (
    <div
      className="iui-card iui-card-soft"
      style={{ padding: 14, textAlign: 'center', margin: '6px 0' }}
    >
      <div className="iui-caption">📍 Carte des étapes de voyage</div>
    </div>
  )
})

/** Array of all compatibility components to register in libraries. */
export const compatComponents = [
  CardHeader,
  TextContent,
  MarkDownRenderer,
  FollowUpItem,
  FollowUpBlock,
  Callout,
  TextCallout,
  TagBlock,
  Separator,
  Buttons,
  InlineHeader,
  ImageBlock,
  ImageGallery,
  TravelHeading,
  TravelProse,
  TravelStop,
  TravelItinerary,
  TravelSuggestions,
  TravelGallery,
  TravelImage,
  TravelMap
]
