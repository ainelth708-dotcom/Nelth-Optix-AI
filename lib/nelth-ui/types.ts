/**
 * Nelth UI Protocol (NUP) v1.0 — Type Definitions
 * Original Generative Interface Intelligence for Nelth-IA | Optix AI
 *
 * Declarative, typed, secure protocol for generative user interface specifications.
 * Completely independent implementation designed specifically for Nelth-IA.
 */

export type NUPVersion = '1.0'

export type NUPComponentType =
  // Layout
  | 'stack'
  | 'row'
  | 'grid'
  | 'card'
  | 'container'
  | 'divider'
  | 'section'
  | 'tabs'
  // Content
  | 'heading'
  | 'text'
  | 'badge'
  | 'callout'
  | 'list'
  | 'code'
  | 'image'
  | 'stat'
  // Data
  | 'table'
  | 'kpi_grid'
  | 'bar_chart'
  | 'line_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'comparison'
  | 'progress'
  // Interactive
  | 'button'
  | 'input'
  | 'select'
  | 'slider'
  | 'checkbox'
  | 'form'
  | 'filter_bar'
  // Specialized
  | 'timeline'
  | 'itinerary'
  | 'product_card'
  | 'task_board'

export interface NelthUIMetadata {
  title?: string
  description?: string
  sourceAttribution?: string[]
  theme?: 'default' | 'neutral' | 'compact'
  generatedAt?: string
}

// -------------------------------------------------------------
// Component Props
// -------------------------------------------------------------

export interface StackProps {
  direction?: 'vertical' | 'horizontal'
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'between' | 'end'
}

export interface RowProps {
  wrap?: boolean
  gap?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'between' | 'end'
}

export interface GridProps {
  columns?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
}

export interface CardProps {
  title?: string
  description?: string
  badge?: string
  variant?: 'default' | 'outlined' | 'subtle'
  collapsible?: boolean
  defaultOpen?: boolean
}

export interface ContainerProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  label?: string
}

export interface SectionProps {
  title: string
  badge?: string
  defaultOpen?: boolean
}

export interface TabItem {
  id: string
  label: string
  icon?: string
}

export interface TabsProps {
  tabs: TabItem[]
  defaultTab?: string
}

export interface HeadingProps {
  level?: 1 | 2 | 3 | 4
  text: string
  icon?: string
}

export interface TextProps {
  text: string
  variant?: 'body' | 'muted' | 'lead' | 'code' | 'caption'
}

export interface BadgeProps {
  text: string
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'secondary'
}

export interface CalloutProps {
  variant?: 'note' | 'tip' | 'warning' | 'error' | 'info'
  title?: string
  text: string
}

export interface ListProps {
  items: string[]
  ordered?: boolean
}

export interface CodeProps {
  code: string
  language?: string
  title?: string
}

export interface ImageProps {
  url: string
  alt?: string
  caption?: string
  aspectRatio?: '16/9' | '4/3' | '1/1' | 'auto'
}

export interface StatProps {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  caption?: string
}

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  format?: 'text' | 'number' | 'currency' | 'badge' | 'link'
}

export interface TableProps {
  columns: TableColumn[]
  rows: Record<string, any>[]
  searchable?: boolean
  pageSize?: number
  caption?: string
}

export interface KPICardItem {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  caption?: string
}

export interface KPIGridProps {
  items: KPICardItem[]
  columns?: 2 | 3 | 4
}

export interface BarChartProps {
  data: Record<string, any>[]
  xKey: string
  yKeys: string[]
  labels?: Record<string, string>
  colors?: string[]
  horizontal?: boolean
  stacked?: boolean
  title?: string
  unit?: string
}

export interface LineChartProps {
  data: Record<string, any>[]
  xKey: string
  yKeys: string[]
  labels?: Record<string, string>
  colors?: string[]
  curved?: boolean
  dots?: boolean
  title?: string
  unit?: string
}

export interface AreaChartProps {
  data: Record<string, any>[]
  xKey: string
  yKeys: string[]
  labels?: Record<string, string>
  colors?: string[]
  title?: string
  unit?: string
}

export interface PieChartItem {
  name: string
  value: number
  color?: string
}

export interface PieChartProps {
  data: PieChartItem[]
  donut?: boolean
  title?: string
  unit?: string
}

export interface ComparisonEntity {
  id: string
  name: string
  badge?: string
  highlight?: boolean
}

export interface ComparisonCriterion {
  name: string
  category?: string
}

export interface ComparisonProps {
  entities: ComparisonEntity[]
  criteria: ComparisonCriterion[]
  values: Record<string, Record<string, string | boolean | number>>
  title?: string
}

export interface ProgressProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'destructive'
}

export interface ButtonProps {
  label: string
  actionId: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  icon?: string
  payload?: Record<string, any>
  disabled?: boolean
}

export interface InputProps {
  name: string
  label?: string
  placeholder?: string
  defaultValue?: string
  inputType?: 'text' | 'number' | 'email' | 'date'
  required?: boolean
}

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps {
  name: string
  label?: string
  options: SelectOption[]
  defaultValue?: string
  required?: boolean
}

export interface SliderProps {
  name: string
  label?: string
  min?: number
  max?: number
  step?: number
  defaultValue?: number
}

export interface CheckboxProps {
  name: string
  label: string
  defaultChecked?: boolean
}

export interface FormProps {
  title?: string
  submitLabel?: string
  actionId: string
  resetLabel?: string
}

export interface FilterOption {
  key: string
  label: string
  options: { label: string; value: string }[]
}

export interface FilterBarProps {
  searchPlaceholder?: string
  filters?: FilterOption[]
}

export interface TimelineItem {
  date: string
  title: string
  description?: string
  status?: 'done' | 'active' | 'upcoming'
}

export interface TimelineProps {
  items: TimelineItem[]
  title?: string
}

export interface ItineraryEvent {
  time?: string
  title: string
  description?: string
  location?: string
  cost?: string
}

export interface ItineraryDay {
  day: string | number
  title: string
  events: ItineraryEvent[]
}

export interface ItineraryProps {
  days: ItineraryDay[]
  title?: string
}

export interface ProductSpec {
  label: string
  value: string
}

export interface ProductCardProps {
  name: string
  price?: string
  rating?: number
  image?: string
  badge?: string
  specs?: ProductSpec[]
  pros?: string[]
  cons?: string[]
  link?: string
  actionLabel?: string
  actionId?: string
}

export interface TaskItem {
  id: string
  title: string
  tag?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface TaskColumn {
  id: string
  title: string
  tasks: TaskItem[]
}

export interface TaskBoardProps {
  columns: TaskColumn[]
  title?: string
}

// -------------------------------------------------------------
// Component Node Definition
// -------------------------------------------------------------

export type ComponentPropsMap = {
  // Layout
  stack: StackProps
  row: RowProps
  grid: GridProps
  card: CardProps
  container: ContainerProps
  divider: DividerProps
  section: SectionProps
  tabs: TabsProps
  // Content
  heading: HeadingProps
  text: TextProps
  badge: BadgeProps
  callout: CalloutProps
  list: ListProps
  code: CodeProps
  image: ImageProps
  stat: StatProps
  // Data
  table: TableProps
  kpi_grid: KPIGridProps
  bar_chart: BarChartProps
  line_chart: LineChartProps
  area_chart: AreaChartProps
  pie_chart: PieChartProps
  comparison: ComparisonProps
  progress: ProgressProps
  // Interactive
  button: ButtonProps
  input: InputProps
  select: SelectProps
  slider: SliderProps
  checkbox: CheckboxProps
  form: FormProps
  filter_bar: FilterBarProps
  // Specialized
  timeline: TimelineProps
  itinerary: ItineraryProps
  product_card: ProductCardProps
  task_board: TaskBoardProps
}

export type NelthUIComponentNode<T extends NUPComponentType = NUPComponentType> = {
  id: string
  component: T
  props: ComponentPropsMap[T]
  children?: NelthUIComponentNode[]
}

/**
 * Top-level Nelth UI Protocol Specification (NUP)
 */
export interface NelthUISpec {
  version: NUPVersion
  root: NelthUIComponentNode
  metadata?: NelthUIMetadata
}

