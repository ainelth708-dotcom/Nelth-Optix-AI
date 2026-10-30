'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import type {
  HeadingProps,
  TextProps,
  BadgeProps,
  CalloutProps,
  ListProps,
  CodeProps,
  StatProps,
  ImageProps
} from '@/lib/nelth-ui/types'

export function HeadingComponent({ props }: { props: HeadingProps }) {
  switch (props.level) {
    case 1:
      return (
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground my-2">
          {props.text}
        </h1>
      )
    case 2:
      return (
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground my-1.5">
          {props.text}
        </h2>
      )
    case 3:
      return (
        <h3 className="text-base sm:text-lg font-medium text-foreground my-1">
          {props.text}
        </h3>
      )
    case 4:
    default:
      return (
        <h4 className="text-sm sm:text-base font-medium text-foreground my-0.5">
          {props.text}
        </h4>
      )
  }
}

export function TextComponent({ props }: { props: TextProps }) {
  const variantClass = {
    body: 'text-sm text-foreground/90 leading-relaxed',
    muted: 'text-xs sm:text-sm text-muted-foreground leading-normal',
    lead: 'text-base font-medium text-foreground leading-relaxed',
    caption: 'text-xs text-muted-foreground/80 tracking-wide',
    code: 'font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded text-foreground'
  }[props.variant || 'body']

  return <p className={cn('my-1', variantClass)}>{props.text}</p>
}

export function BadgeComponent({ props }: { props: BadgeProps }) {
  const variantClass = {
    default: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground border-transparent',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    destructive: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    outline: 'border-border text-foreground bg-transparent'
  }[props.variant || 'default']

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border text-xs px-2.5 py-0.5',
        variantClass
      )}
    >
      {props.text}
    </span>
  )
}

export function CalloutComponent({ props }: { props: CalloutProps }) {
  const config = {
    info: {
      border: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-100',
      icon: <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
    },
    tip: {
      border: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
    },
    note: {
      border: 'border-border/60 bg-muted/30 text-foreground',
      icon: <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
    },
    warning: {
      border: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
    },
    error: {
      border: 'border-rose-500/30 bg-rose-500/5 text-rose-900 dark:text-rose-100',
      icon: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
    }
  }[props.variant || 'info']

  return (
    <div className={cn('flex items-start gap-3 p-3.5 rounded-xl border my-2.5', config.border)}>
      {config.icon}
      <div className="space-y-1">
        {props.title && <h5 className="text-xs font-semibold uppercase tracking-wider">{props.title}</h5>}
        <div className="text-xs sm:text-sm leading-relaxed opacity-95">{props.text}</div>
      </div>
    </div>
  )
}

export function ListComponent({ props }: { props: ListProps }) {
  if (props.ordered) {
    return (
      <ol className="list-decimal list-inside space-y-1 my-2 text-sm text-foreground/90 pl-1">
        {props.items.map((item, index) => (
          <li key={index} className="leading-relaxed">
            {item}
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ul className="list-disc list-inside space-y-1 my-2 text-sm text-foreground/90 pl-1">
      {props.items.map((item, index) => (
        <li key={index} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function CodeComponent({ props }: { props: CodeProps }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(props.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-2.5 rounded-xl border border-border/60 bg-muted/40 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/70 text-muted-foreground text-[11px]">
        <span>{props.title || props.language || 'code'}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          title="Copier le code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copié</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-foreground/90 leading-normal">
        <code>{props.code}</code>
      </pre>
    </div>
  )
}

export function StatComponent({ props }: { props: StatProps }) {
  const isPositive = props.trend === 'up' || (typeof props.change === 'string' && props.change.startsWith('+'))
  const isNegative = props.trend === 'down' || (typeof props.change === 'string' && props.change.startsWith('-'))

  return (
    <div className="p-3.5 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{props.label}</div>
      <div className="text-2xl font-bold tracking-tight text-foreground">{props.value}</div>
      {props.change && (
        <div className="flex items-center gap-1 text-xs font-medium">
          {isPositive && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
          {isNegative && <TrendingDown className="w-3.5 h-3.5 text-rose-500" />}
          <span
            className={cn(
              isPositive && 'text-emerald-600 dark:text-emerald-400',
              isNegative && 'text-rose-600 dark:text-rose-400',
              !isPositive && !isNegative && 'text-muted-foreground'
            )}
          >
            {props.change}
          </span>
          {props.caption && <span className="text-muted-foreground/80 font-normal"> · {props.caption}</span>}
        </div>
      )}
    </div>
  )
}

export function ImageComponent({ props }: { props: ImageProps }) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="w-full h-32 rounded-xl border border-dashed border-border/60 flex items-center justify-center text-xs text-muted-foreground">
        Image indisponible
      </div>
    )
  }

  return (
    <figure className="my-2.5 overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <img
        src={props.url}
        alt={props.alt || 'Nelth UI visual'}
        onError={() => setHasError(true)}
        className="w-full h-auto object-cover max-h-96"
        loading="lazy"
      />
      {props.caption && (
        <figcaption className="p-2 text-center text-xs text-muted-foreground bg-background/50 border-t border-border/40">
          {props.caption}
        </figcaption>
      )}
    </figure>
  )
}
