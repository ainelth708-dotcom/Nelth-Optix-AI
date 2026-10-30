/**
 * Nelth UI Protocol (NUP) v1.0 — Runtime Schema & Validation
 * Enforces strict discriminated union validation, component allowlists,
 * tree depth limits, component count limits, and payload bounds.
 */

import { z } from 'zod'
import { sanitizeComponentProps } from './sanitizer'
import type { NelthUISpec, NelthUIComponentNode, NUPComponentType } from './types'

export const NUP_LIMITS = {
  MAX_TREE_DEPTH: 8,
  MAX_COMPONENT_COUNT: 60,
  MAX_TABLE_ROWS: 300,
  MAX_CHART_POINTS: 100,
  MAX_TEXT_LENGTH: 10_000,
  MAX_SPEC_SIZE_BYTES: 120_000
} as const

// Component allowlist
export const ALLOWED_COMPONENTS = new Set<NUPComponentType>([
  // Layout
  'stack',
  'row',
  'grid',
  'card',
  'container',
  'divider',
  'section',
  'tabs',
  // Content
  'heading',
  'text',
  'badge',
  'callout',
  'list',
  'code',
  'image',
  'stat',
  // Data
  'table',
  'kpi_grid',
  'bar_chart',
  'line_chart',
  'area_chart',
  'pie_chart',
  'comparison',
  'progress',
  // Interactive
  'button',
  'input',
  'select',
  'slider',
  'checkbox',
  'form',
  'filter_bar',
  // Specialized
  'timeline',
  'itinerary',
  'product_card',
  'task_board'
])

// Primitive Schemas
const TextPropsSchema = z.object({
  text: z.string().max(NUP_LIMITS.MAX_TEXT_LENGTH),
  variant: z.enum(['body', 'muted', 'lead', 'code', 'caption']).optional()
})

const HeadingPropsSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  text: z.string().max(NUP_LIMITS.MAX_TEXT_LENGTH),
  icon: z.string().max(64).optional()
})

const BadgePropsSchema = z.object({
  text: z.string().max(256),
  variant: z.enum(['default', 'success', 'warning', 'destructive', 'outline', 'secondary']).optional()
})

const CalloutPropsSchema = z.object({
  variant: z.enum(['note', 'tip', 'warning', 'error', 'info']).optional(),
  title: z.string().max(512).optional(),
  text: z.string().max(NUP_LIMITS.MAX_TEXT_LENGTH)
})

const ListPropsSchema = z.object({
  items: z.array(z.string().max(NUP_LIMITS.MAX_TEXT_LENGTH)).max(100),
  ordered: z.boolean().optional()
})

const CodePropsSchema = z.object({
  code: z.string().max(30_000),
  language: z.string().max(64).optional(),
  title: z.string().max(256).optional()
})

const ImagePropsSchema = z.object({
  url: z.string().max(2048),
  alt: z.string().max(512).optional(),
  caption: z.string().max(512).optional(),
  aspectRatio: z.enum(['16/9', '4/3', '1/1', 'auto']).optional()
})

const StatPropsSchema = z.object({
  label: z.string().max(256),
  value: z.union([z.string().max(256), z.number()]),
  change: z.string().max(128).optional(),
  trend: z.enum(['up', 'down', 'neutral']).optional(),
  caption: z.string().max(512).optional()
})

const StackPropsSchema = z.object({
  direction: z.enum(['vertical', 'horizontal']).optional(),
  spacing: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'between', 'end']).optional()
})

const RowPropsSchema = z.object({
  wrap: z.boolean().optional(),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justify: z.enum(['start', 'center', 'between', 'end']).optional()
})

const GridPropsSchema = z.object({
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  gap: z.enum(['sm', 'md', 'lg']).optional()
})

const CardPropsSchema = z.object({
  title: z.string().max(512).optional(),
  description: z.string().max(2048).optional(),
  badge: z.string().max(128).optional(),
  variant: z.enum(['default', 'outlined', 'subtle']).optional(),
  collapsible: z.boolean().optional(),
  defaultOpen: z.boolean().optional()
})

const ContainerPropsSchema = z.object({
  maxWidth: z.enum(['sm', 'md', 'lg', 'full']).optional(),
  padding: z.enum(['none', 'sm', 'md', 'lg']).optional()
})

const DividerPropsSchema = z.object({
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  label: z.string().max(128).optional()
})

const SectionPropsSchema = z.object({
  title: z.string().max(512),
  badge: z.string().max(128).optional(),
  defaultOpen: z.boolean().optional()
})

const TabsPropsSchema = z.object({
  tabs: z.array(z.object({
    id: z.string().max(128),
    label: z.string().max(128),
    icon: z.string().max(64).optional()
  })).min(1).max(12),
  defaultTab: z.string().max(128).optional()
})

const TableColumnSchema = z.object({
  key: z.string().max(128),
  label: z.string().max(256),
  sortable: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  format: z.enum(['text', 'number', 'currency', 'badge', 'link']).optional()
})

const TablePropsSchema = z.object({
  columns: z.array(TableColumnSchema).min(1).max(20),
  rows: z.array(z.record(z.string(), z.any())).max(NUP_LIMITS.MAX_TABLE_ROWS),
  searchable: z.boolean().optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  caption: z.string().max(512).optional()
})

const KPICardItemSchema = z.object({
  label: z.string().max(256),
  value: z.union([z.string().max(256), z.number()]),
  change: z.string().max(128).optional(),
  trend: z.enum(['up', 'down', 'neutral']).optional(),
  caption: z.string().max(512).optional()
})

const KPIGridPropsSchema = z.object({
  items: z.array(KPICardItemSchema).min(1).max(16),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional()
})

const BarChartPropsSchema = z.object({
  data: z.array(z.record(z.string(), z.any())).min(1).max(NUP_LIMITS.MAX_CHART_POINTS),
  xKey: z.string().max(128),
  yKeys: z.array(z.string().max(128)).min(1).max(8),
  labels: z.record(z.string(), z.string()).optional(),
  colors: z.array(z.string().max(64)).optional(),
  horizontal: z.boolean().optional(),
  stacked: z.boolean().optional(),
  title: z.string().max(256).optional(),
  unit: z.string().max(32).optional()
})

const LineChartPropsSchema = z.object({
  data: z.array(z.record(z.string(), z.any())).min(1).max(NUP_LIMITS.MAX_CHART_POINTS),
  xKey: z.string().max(128),
  yKeys: z.array(z.string().max(128)).min(1).max(8),
  labels: z.record(z.string(), z.string()).optional(),
  colors: z.array(z.string().max(64)).optional(),
  curved: z.boolean().optional(),
  dots: z.boolean().optional(),
  title: z.string().max(256).optional(),
  unit: z.string().max(32).optional()
})

const AreaChartPropsSchema = z.object({
  data: z.array(z.record(z.string(), z.any())).min(1).max(NUP_LIMITS.MAX_CHART_POINTS),
  xKey: z.string().max(128),
  yKeys: z.array(z.string().max(128)).min(1).max(8),
  labels: z.record(z.string(), z.string()).optional(),
  colors: z.array(z.string().max(64)).optional(),
  title: z.string().max(256).optional(),
  unit: z.string().max(32).optional()
})

const PieChartItemSchema = z.object({
  name: z.string().max(128),
  value: z.number().finite(),
  color: z.string().max(64).optional()
})

const PieChartPropsSchema = z.object({
  data: z.array(PieChartItemSchema).min(1).max(20),
  donut: z.boolean().optional(),
  title: z.string().max(256).optional(),
  unit: z.string().max(32).optional()
})

const ComparisonPropsSchema = z.object({
  entities: z.array(z.object({
    id: z.string().max(128),
    name: z.string().max(256),
    badge: z.string().max(128).optional(),
    highlight: z.boolean().optional()
  })).min(1).max(10),
  criteria: z.array(z.object({
    name: z.string().max(256),
    category: z.string().max(128).optional()
  })).min(1).max(25),
  values: z.record(z.string(), z.record(z.string(), z.union([z.string().max(1024), z.boolean(), z.number()]))),
  title: z.string().max(256).optional()
})

const ProgressPropsSchema = z.object({
  value: z.number().finite(),
  max: z.number().finite().optional(),
  label: z.string().max(256).optional(),
  showPercentage: z.boolean().optional(),
  variant: z.enum(['default', 'success', 'warning', 'destructive']).optional()
})

const ButtonPropsSchema = z.object({
  label: z.string().max(128),
  actionId: z.string().max(128),
  variant: z.enum(['default', 'outline', 'secondary', 'ghost']).optional(),
  icon: z.string().max(64).optional(),
  payload: z.record(z.string(), z.any()).optional(),
  disabled: z.boolean().optional()
})

const InputPropsSchema = z.object({
  name: z.string().max(128),
  label: z.string().max(256).optional(),
  placeholder: z.string().max(256).optional(),
  defaultValue: z.string().max(1024).optional(),
  inputType: z.enum(['text', 'number', 'email', 'date']).optional(),
  required: z.boolean().optional()
})

const SelectPropsSchema = z.object({
  name: z.string().max(128),
  label: z.string().max(256).optional(),
  options: z.array(z.object({
    label: z.string().max(256),
    value: z.string().max(256)
  })).min(1).max(100),
  defaultValue: z.string().max(256).optional(),
  required: z.boolean().optional()
})

const SliderPropsSchema = z.object({
  name: z.string().max(128),
  label: z.string().max(256).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  defaultValue: z.number().optional()
})

const CheckboxPropsSchema = z.object({
  name: z.string().max(128),
  label: z.string().max(256),
  defaultChecked: z.boolean().optional()
})

const FormPropsSchema = z.object({
  title: z.string().max(256).optional(),
  submitLabel: z.string().max(128).optional(),
  actionId: z.string().max(128),
  resetLabel: z.string().max(128).optional()
})

const FilterBarPropsSchema = z.object({
  searchPlaceholder: z.string().max(256).optional(),
  filters: z.array(z.object({
    key: z.string().max(128),
    label: z.string().max(128),
    options: z.array(z.object({
      label: z.string().max(128),
      value: z.string().max(128)
    })).max(20)
  })).max(5).optional()
})

const TimelinePropsSchema = z.object({
  items: z.array(z.object({
    date: z.string().max(128),
    title: z.string().max(256),
    description: z.string().max(2048).optional(),
    status: z.enum(['done', 'active', 'upcoming']).optional()
  })).min(1).max(50),
  title: z.string().max(256).optional()
})

const ItineraryPropsSchema = z.object({
  days: z.array(z.object({
    day: z.union([z.string().max(64), z.number()]),
    title: z.string().max(256),
    events: z.array(z.object({
      time: z.string().max(64).optional(),
      title: z.string().max(256),
      description: z.string().max(2048).optional(),
      location: z.string().max(256).optional(),
      cost: z.string().max(128).optional()
    })).max(20)
  })).min(1).max(30),
  title: z.string().max(256).optional()
})

const ProductCardPropsSchema = z.object({
  name: z.string().max(256),
  price: z.string().max(128).optional(),
  rating: z.number().min(0).max(5).optional(),
  image: z.string().max(2048).optional(),
  badge: z.string().max(128).optional(),
  specs: z.array(z.object({
    label: z.string().max(128),
    value: z.string().max(256)
  })).max(20).optional(),
  pros: z.array(z.string().max(256)).max(10).optional(),
  cons: z.array(z.string().max(256)).max(10).optional(),
  link: z.string().max(2048).optional(),
  actionLabel: z.string().max(128).optional(),
  actionId: z.string().max(128).optional()
})

const TaskBoardPropsSchema = z.object({
  columns: z.array(z.object({
    id: z.string().max(128),
    title: z.string().max(128),
    tasks: z.array(z.object({
      id: z.string().max(128),
      title: z.string().max(256),
      tag: z.string().max(128).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional()
    })).max(30)
  })).min(1).max(6),
  title: z.string().max(256).optional()
})

// Component Props Validator Resolver
const propsValidatorMap: Record<NUPComponentType, z.ZodType<any>> = {
  stack: StackPropsSchema,
  row: RowPropsSchema,
  grid: GridPropsSchema,
  card: CardPropsSchema,
  container: ContainerPropsSchema,
  divider: DividerPropsSchema,
  section: SectionPropsSchema,
  tabs: TabsPropsSchema,
  heading: HeadingPropsSchema,
  text: TextPropsSchema,
  badge: BadgePropsSchema,
  callout: CalloutPropsSchema,
  list: ListPropsSchema,
  code: CodePropsSchema,
  image: ImagePropsSchema,
  stat: StatPropsSchema,
  table: TablePropsSchema,
  kpi_grid: KPIGridPropsSchema,
  bar_chart: BarChartPropsSchema,
  line_chart: LineChartPropsSchema,
  area_chart: AreaChartPropsSchema,
  pie_chart: PieChartPropsSchema,
  comparison: ComparisonPropsSchema,
  progress: ProgressPropsSchema,
  button: ButtonPropsSchema,
  input: InputPropsSchema,
  select: SelectPropsSchema,
  slider: SliderPropsSchema,
  checkbox: CheckboxPropsSchema,
  form: FormPropsSchema,
  filter_bar: FilterBarPropsSchema,
  timeline: TimelinePropsSchema,
  itinerary: ItineraryPropsSchema,
  product_card: ProductCardPropsSchema,
  task_board: TaskBoardPropsSchema
}

export interface ValidationContext {
  depth: number
  state: {
    componentCount: number
  }
}

/**
 * Validates a single component node and its children recursively.
 * Enforces tree depth limits, component count limits, and schema conformance.
 */
export function validateComponentNode(
  raw: unknown,
  ctx: ValidationContext = { depth: 0, state: { componentCount: 0 } }
): { success: true; node: NelthUIComponentNode } | { success: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Component node must be an object' }
  }

  const obj = raw as Record<string, any>

  if (typeof obj.component !== 'string' || !ALLOWED_COMPONENTS.has(obj.component as NUPComponentType)) {
    return { success: false, error: `Invalid or unapproved component type: "${obj.component}"` }
  }

  const componentType = obj.component as NUPComponentType

  if (ctx.depth > NUP_LIMITS.MAX_TREE_DEPTH) {
    return { success: false, error: `Maximum tree depth exceeded (${NUP_LIMITS.MAX_TREE_DEPTH})` }
  }

  ctx.state.componentCount += 1
  if (ctx.state.componentCount > NUP_LIMITS.MAX_COMPONENT_COUNT) {
    return { success: false, error: `Maximum component count exceeded (${NUP_LIMITS.MAX_COMPONENT_COUNT})` }
  }

  const validator = propsValidatorMap[componentType]
  const parsedProps = validator.safeParse(obj.props ?? {})
  if (!parsedProps.success) {
    return {
      success: false,
      error: `Invalid props for <${componentType}>: ${parsedProps.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`
    }
  }

  const sanitizedProps = sanitizeComponentProps(parsedProps.data)

  const validatedChildren: NelthUIComponentNode[] = []
  if (Array.isArray(obj.children)) {
    for (let i = 0; i < obj.children.length; i++) {
      const childRes = validateComponentNode(obj.children[i], {
        depth: ctx.depth + 1,
        state: ctx.state
      })
      if (!childRes.success) {
        return childRes
      }
      validatedChildren.push(childRes.node)
    }
  }

  const id = typeof obj.id === 'string' && obj.id.trim().length > 0
    ? obj.id.trim()
    : `${componentType}-${Math.random().toString(36).slice(2, 9)}`

  return {
    success: true,
    node: {
      id,
      component: componentType,
      props: sanitizedProps,
      ...(validatedChildren.length > 0 ? { children: validatedChildren } : {})
    }
  }
}

/**
 * Validates a top-level NUP specification.
 */
export function validateNelthUISpec(
  data: unknown
): { success: true; spec: NelthUISpec } | { success: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Specification must be a non-null JSON object' }
  }

  const obj = data as Record<string, any>

  if (obj.version !== '1.0') {
    return { success: false, error: `Unsupported protocol version "${obj.version}". Supported version is "1.0"` }
  }

  if (!obj.root || typeof obj.root !== 'object') {
    return { success: false, error: 'Specification is missing a valid root component node' }
  }

  const ctx: ValidationContext = { depth: 1, state: { componentCount: 0 } }
  const rootRes = validateComponentNode(obj.root, ctx)
  if (!rootRes.success) {
    return rootRes
  }

  const metadata = obj.metadata && typeof obj.metadata === 'object'
    ? {
        title: typeof obj.metadata.title === 'string' ? obj.metadata.title.slice(0, 512) : undefined,
        description: typeof obj.metadata.description === 'string' ? obj.metadata.description.slice(0, 1024) : undefined,
        sourceAttribution: Array.isArray(obj.metadata.sourceAttribution)
          ? obj.metadata.sourceAttribution.filter((s: unknown) => typeof s === 'string').slice(0, 20)
          : undefined,
        theme: ['default', 'neutral', 'compact'].includes(obj.metadata.theme) ? obj.metadata.theme : 'default',
        generatedAt: typeof obj.metadata.generatedAt === 'string' ? obj.metadata.generatedAt : new Date().toISOString()
      }
    : undefined

  return {
    success: true,
    spec: {
      version: '1.0',
      root: rootRes.node,
      ...(metadata ? { metadata } : {})
    }
  }
}

/**
 * Parses and validates a raw JSON string into a NelthUISpec.
 * Returns null if parsing or validation fails.
 */
export function parseNelthUISpec(raw: string): NelthUISpec | null {
  try {
    const parsed = JSON.parse(raw)
    const res = validateNelthUISpec(parsed)
    return res.success ? res.spec : null
  } catch {
    return null
  }
}


