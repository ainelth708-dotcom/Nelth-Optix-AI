'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useNelthUI } from '../context'
import type {
  StackProps,
  RowProps,
  GridProps,
  CardProps,
  ContainerProps,
  DividerProps,
  SectionProps,
  TabsProps
} from '@/lib/nelth-ui/types'

export function StackComponent({
  props,
  children
}: {
  props: StackProps
  children?: React.ReactNode
}) {
  const gapClasses: Record<string, string> = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }
  const alignClasses: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }
  const justifyClasses: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between'
  }

  return (
    <div
      className={cn(
        'flex w-full',
        props.direction === 'horizontal' ? 'flex-row' : 'flex-col',
        gapClasses[props.spacing || 'md'],
        alignClasses[props.align || 'stretch'],
        justifyClasses[props.justify || 'start']
      )}
    >
      {children}
    </div>
  )
}

export function RowComponent({
  props,
  children
}: {
  props: RowProps
  children?: React.ReactNode
}) {
  const gapClasses: Record<string, string> = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }
  const alignClasses: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }
  const justifyClasses: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between'
  }

  return (
    <div
      className={cn(
        'flex flex-row',
        props.wrap ? 'flex-wrap' : 'flex-nowrap',
        gapClasses[props.gap || 'md'],
        alignClasses[props.align || 'center'],
        justifyClasses[props.justify || 'start']
      )}
    >
      {children}
    </div>
  )
}

export function GridComponent({
  props,
  children
}: {
  props: GridProps
  children?: React.ReactNode
}) {
  const colClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
  }
  const gapClasses: Record<string, string> = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6'
  }

  return (
    <div
      className={cn(
        'grid w-full',
        colClasses[props.columns || 2],
        gapClasses[props.gap || 'md']
      )}
    >
      {children}
    </div>
  )
}

export function CardComponent({
  id,
  props,
  children
}: {
  id?: string
  props: CardProps
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? true)

  const variantClasses: Record<string, string> = {
    default: 'bg-card/70 border-border/60 hover:border-border text-card-foreground',
    outlined: 'bg-transparent border-border/80 text-foreground',
    subtle: 'bg-muted/30 border-transparent text-foreground'
  }

  return (
    <div
      id={id}
      className={cn(
        'rounded-xl border p-4 sm:p-5 transition-all duration-200 backdrop-blur-sm',
        variantClasses[props.variant || 'default']
      )}
    >
      {(props.title || props.description || props.badge) && (
        <div
          className={cn(
            'mb-3 space-y-1',
            props.collapsible && 'cursor-pointer select-none'
          )}
          onClick={() => props.collapsible && setOpen(!open)}
        >
          <div className="flex items-center justify-between gap-2">
            {props.title && (
              <h4 className="text-base font-semibold tracking-tight text-foreground">
                {props.title}
              </h4>
            )}
            {props.badge && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {props.badge}
              </span>
            )}
          </div>
          {props.description && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {props.description}
            </p>
          )}
        </div>
      )}
      {open && children}
    </div>
  )
}

export function ContainerComponent({
  props,
  children
}: {
  props: ContainerProps
  children?: React.ReactNode
}) {
  const maxWClasses: Record<string, string> = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    full: 'max-w-full'
  }
  const padClasses: Record<string, string> = {
    none: 'p-0',
    sm: 'p-2 sm:p-3',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  }

  return (
    <div
      className={cn(
        'w-full mx-auto',
        maxWClasses[props.maxWidth || 'lg'],
        padClasses[props.padding || 'md']
      )}
    >
      {children}
    </div>
  )
}

export function DividerComponent({ props }: { props: DividerProps }) {
  if (props.orientation === 'vertical') {
    return <div className="inline-block w-px h-full bg-border/60 mx-2 self-stretch" />
  }

  if (props.label) {
    return (
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/60" />
        </div>
        <div className="relative bg-background px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {props.label}
        </div>
      </div>
    )
  }

  return <hr className="my-4 border-t border-border/60 w-full" />
}

export function SectionComponent({
  props,
  children
}: {
  props: SectionProps
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? true)

  return (
    <section className="my-3 w-full rounded-xl border border-border/50 bg-background/50 p-4">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {props.title}
          </h3>
          {props.badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {props.badge}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? '▲ Masquer' : '▼ Afficher'}
        </span>
      </div>
      {open && <div className="mt-3.5 space-y-3">{children}</div>}
    </section>
  )
}

export function TabsComponent({
  id,
  props,
  children
}: {
  id?: string
  props: TabsProps
  children?: React.ReactNode
}) {
  const { activeTabs, setActiveTab } = useNelthUI()
  const tabComponentId = id || 'tabs-default'
  const activeKey = activeTabs[tabComponentId] || props.defaultTab || props.tabs[0]?.id || ''

  return (
    <div className="w-full my-2">
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-1 overflow-x-auto no-scrollbar">
        {props.tabs.map(tab => {
          const isActive = tab.id === activeKey
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tabComponentId, tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="pt-3">{children}</div>
    </div>
  )
}
