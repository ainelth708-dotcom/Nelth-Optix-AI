import { parseSpecBlock } from '@/lib/render/parse-spec-block'

const SPEC_FENCE = /```spec\s*\n([\s\S]*?)```/g
const OPENUI_FENCE = /```openui(?:-lang)?\s*\n([\s\S]*?)```/gi

export interface GenuiSummary {
  /** Number of spec fences in the message. */
  blockCount: number
  /** Spec blocks that are not the related-questions block. */
  contentBlockCount: number
  imageCount: number
  hasImage: boolean
  hasRelated: boolean
  /** Distinct element types across content blocks. */
  componentTypes: string[]
}

/**
 * Summarize the GenUI rendered in a finished assistant message.
 * A block containing Button elements is treated as the related-questions
 * block (tracked separately via clicks) and excluded from content metrics.
 * Returns null when the message contains no spec blocks.
 */
export function summarizeGenui(text: string): GenuiSummary | null {
  const blocks: Array<{ source: string; format: 'spec' | 'openui' }> = []
  SPEC_FENCE.lastIndex = 0
  OPENUI_FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SPEC_FENCE.exec(text)) !== null) {
    blocks.push({ source: match[1], format: 'spec' })
  }
  while ((match = OPENUI_FENCE.exec(text)) !== null) {
    blocks.push({ source: match[1], format: 'openui' })
  }
  if (blocks.length === 0) return null
  blocks.sort(
    (a, b) =>
      text.indexOf(a.source) - text.indexOf(b.source)
  )

  let contentBlockCount = 0
  let imageCount = 0
  let hasRelated = false
  const componentTypes = new Set<string>()

  for (const { source, format } of blocks) {
    let types: string[]
    if (format === 'openui') {
      types = Array.from(
        source.matchAll(/(?:^|\n)\s*\w+\s*=\s*([A-Z]\w*)\s*\(/g),
        component => component[1]
      )
    } else {
      try {
        types = Object.values(parseSpecBlock(source).elements).map(
          el => el.type
        )
      } catch {
        continue
      }
    }

    if (types.includes('Button') || types.includes('FollowUpBlock')) {
      hasRelated = true
      continue
    }

    contentBlockCount++
    for (const type of types) {
      componentTypes.add(type)
      if (type === 'Image') imageCount++
    }
    if (format === 'openui') {
      imageCount +=
        (source.match(/\bImageGallery\s*\(\s*\[/g) ?? []).length > 0
          ? (source.match(/["']?src["']?\s*:/g) ?? []).length
          : (source.match(/\b(?:Image|ImageBlock|TravelImage)\s*\(/g) ?? [])
              .length
    }
  }

  return {
    blockCount: blocks.length,
    contentBlockCount,
    imageCount,
    hasImage: imageCount > 0,
    hasRelated,
    componentTypes: Array.from(componentTypes)
  }
}
