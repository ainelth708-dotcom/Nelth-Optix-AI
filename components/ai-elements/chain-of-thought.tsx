'use client'

import type { ComponentProps, ReactNode } from 'react'
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import Image from 'next/image'

import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  ChevronDownIcon,
  DotIcon,
  ExternalLinkIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
  SearchIcon,
  type LucideIcon
} from 'lucide-react'

import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible'

interface ChainOfThoughtContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  isStreaming?: boolean
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null
)

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext)
  if (!context) {
    throw new Error(
      'ChainOfThought components must be used within ChainOfThought'
    )
  }
  return context
}

export type ChainOfThoughtProps = ComponentProps<'div'> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isStreaming?: boolean
  autoCloseDelay?: number
}

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    isStreaming = false,
    autoCloseDelay = 1000,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange
    })

    const hasEverStreamedRef = useRef(isStreaming)
    const [hasAutoClosed, setHasAutoClosed] = useState(false)
    const userManuallyChangedRef = useRef(false)

    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true
      }
    }, [isStreaming])

    // Auto-close when streaming finishes (once only, and only if user didn't manually toggle)
    useEffect(() => {
      if (
        hasEverStreamedRef.current &&
        !isStreaming &&
        isOpen &&
        !hasAutoClosed &&
        !userManuallyChangedRef.current
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false)
          setHasAutoClosed(true)
        }, autoCloseDelay)

        return () => clearTimeout(timer)
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed, autoCloseDelay])

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        userManuallyChangedRef.current = true
        setIsOpen(newOpen)
      },
      [setIsOpen]
    )

    const chainOfThoughtContext = useMemo(
      () => ({ isOpen, setIsOpen: handleOpenChange, isStreaming }),
      [isOpen, handleOpenChange, isStreaming]
    )

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div
          className={cn('not-prose max-w-prose space-y-2', className)}
          {...props}
        >
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    )
  }
)

export const ShimmerText = memo(
  ({
    children,
    className
  }: {
    children: ReactNode
    className?: string
  }) => (
    <span
      className={cn('inline-block font-medium select-none', className)}
      style={{
        background:
          'linear-gradient(110deg, var(--muted-foreground) 25%, var(--foreground) 50%, var(--muted-foreground) 75%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'shimmer 1.8s linear infinite'
      }}
    >
      {children}
    </span>
  )
)
ShimmerText.displayName = 'ShimmerText'

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  leftIcon?: ReactNode
  count?: number
  badgeText?: string
  status?: 'active' | 'complete' | 'pending'
  isStreaming?: boolean
}

export const ChainOfThoughtHeader = memo(
  ({
    className,
    children,
    leftIcon,
    count,
    badgeText,
    status: statusProp,
    isStreaming: isStreamingProp,
    ...props
  }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen, isStreaming: contextIsStreaming } =
      useChainOfThought()
    const isStreaming = isStreamingProp ?? contextIsStreaming
    const isActive = statusProp === 'active' || isStreaming

    const defaultIcon = isActive ? (
      <GlobeIcon className="size-3.5 text-primary animate-spin [animation-duration:3s]" />
    ) : (
      <GlobeIcon className="size-3.5 text-muted-foreground group-hover/cot:text-foreground transition-colors" />
    )

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 hover:bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer shadow-xs select-none group/cot max-w-full',
            isActive && 'border-primary/30 bg-primary/5 text-foreground',
            className
          )}
          {...props}
        >
          <span className="shrink-0">{leftIcon ?? defaultIcon}</span>
          <span className="truncate text-left font-medium">
            {children ??
              (isActive ? (
                <ShimmerText>Recherche sur le web…</ShimmerText>
              ) : (
                'Recherche sur le web'
              ))}
          </span>
          {count !== undefined && count > 0 && !isActive && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {badgeText ?? `${count} ${count > 1 ? 'sources' : 'source'}`}
            </span>
          )}
          {isActive && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen ? 'rotate-180' : 'rotate-0'
            )}
          />
        </CollapsibleTrigger>
      </Collapsible>
    )
  }
)

export type ChainOfThoughtStepProps = ComponentProps<'div'> & {
  icon?: LucideIcon
  label: ReactNode
  description?: ReactNode
  status?: 'complete' | 'active' | 'pending'
}

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = 'complete',
    children,
    ...props
  }: ChainOfThoughtStepProps) => {
    const statusStyles = {
      complete: 'text-muted-foreground',
      active: 'text-foreground',
      pending: 'text-muted-foreground/50'
    }

    return (
      <div
        className={cn(
          'flex gap-2.5 text-xs',
          statusStyles[status],
          'fade-in-0 slide-in-from-top-1 animate-in',
          className
        )}
        {...props}
      >
        <div className="relative mt-0.5 shrink-0">
          <Icon className="size-3.5" />
          <div className="-mx-px absolute top-5 bottom-0 left-1/2 w-px bg-border/60" />
        </div>
        <div className="flex-1 space-y-1.5 overflow-hidden min-w-0">
          <div className="font-medium text-foreground">{label}</div>
          {description && (
            <div className="text-muted-foreground text-[11px]">{description}</div>
          )}
          {children}
        </div>
      </div>
    )
  }
)

export type ChainOfThoughtSearchResultsProps = ComponentProps<'div'>

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div
      className={cn('flex flex-wrap items-center gap-1.5 pt-1', className)}
      {...props}
    />
  )
)

export type ChainOfThoughtSearchResultProps = ComponentProps<'div'> & {
  domain?: string
  href?: string
  favicon?: string
}

export const ChainOfThoughtSearchResult = memo(
  ({
    className,
    children,
    domain,
    href,
    favicon,
    ...props
  }: ChainOfThoughtSearchResultProps) => {
    const displayDomain =
      domain || (typeof children === 'string' ? children : '')
    const faviconUrl =
      favicon ||
      (displayDomain
        ? `https://www.google.com/s2/favicons?domain=${displayDomain}&sz=32`
        : null)

    const content = (
      <>
        {faviconUrl && (
          <span className="flex size-3.5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
            <Image
              src={faviconUrl}
              alt={displayDomain || 'Source'}
              width={14}
              height={14}
              className="size-3.5 object-cover"
              unoptimized
            />
          </span>
        )}
        <span className="truncate max-w-[170px] font-medium">
          {children ?? displayDomain}
        </span>
        {href && (
          <ExternalLinkIcon className="size-2.5 text-muted-foreground/60 opacity-0 group-hover/cot-link:opacity-100 transition-opacity" />
        )}
      </>
    )

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'group/cot-link inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/90 hover:bg-muted/80 px-2.5 py-1 text-[11px] text-foreground/80 hover:text-foreground transition-all duration-150 shadow-2xs',
            className
          )}
        >
          {content}
        </a>
      )
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-2.5 py-1 text-[11px] font-normal text-muted-foreground',
          className
        )}
        {...props}
      >
        {content}
      </span>
    )
  }
)

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought()

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            'mt-2 space-y-2.5 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground backdrop-blur-xs',
            'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in duration-200',
            className
          )}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    )
  }
)

export type ChainOfThoughtImageProps = ComponentProps<'div'> & {
  caption?: string
}

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn('mt-2 space-y-2', className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
    </div>
  )
)

ChainOfThought.displayName = 'ChainOfThought'
ChainOfThoughtHeader.displayName = 'ChainOfThoughtHeader'
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep'
ChainOfThoughtSearchResults.displayName = 'ChainOfThoughtSearchResults'
ChainOfThoughtSearchResult.displayName = 'ChainOfThoughtSearchResult'
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent'
ChainOfThoughtImage.displayName = 'ChainOfThoughtImage'
