'use client'

import React, { useMemo } from 'react'
import type { NelthUISpec } from '@/lib/nelth-ui/types'
import { parseNelthUISpec } from '@/lib/nelth-ui/schema'
import { NelthUIContextProvider } from './context'
import { NelthUINodeRenderer } from './renderer'

export interface NelthUIViewProps {
  spec?: NelthUISpec | null
  raw?: string
  isStreaming?: boolean
  onAction?: (actionName: string, payload?: Record<string, any>) => void
  className?: string
}

export function NelthUIView({
  spec,
  raw,
  isStreaming = false,
  onAction,
  className
}: NelthUIViewProps) {
  const parsedSpec = useMemo<NelthUISpec | null>(() => {
    if (spec) return spec
    if (!raw) return null
    return parseNelthUISpec(raw)
  }, [spec, raw])

  // Case 1: Currently streaming and partial JSON is not yet complete
  if (!parsedSpec && isStreaming) {
    return (
      <div className="my-3 w-full rounded-xl border border-primary/20 bg-primary/5 p-4 animate-pulse">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span>Génération de l'interface interactive Nelth...</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-4 bg-primary/10 rounded w-1/3" />
          <div className="h-16 bg-primary/10 rounded w-full" />
        </div>
      </div>
    )
  }

  // Case 2: Streaming ended or invalid spec
  if (!parsedSpec) {
    if (raw && !isStreaming) {
      // Safe fallback: render raw text in a subtle code box
      return (
        <div className="my-2 p-3 rounded-xl border border-muted bg-muted/20 text-xs font-mono text-muted-foreground overflow-x-auto">
          {raw}
        </div>
      )
    }
    return null
  }

  // Case 3: Valid specification rendered through Nelth UI
  return (
    <NelthUIContextProvider onAction={onAction}>
      <div className={`nelth-ui-root w-full my-2.5 ${className || ''}`}>
        <NelthUINodeRenderer node={parsedSpec.root} />
      </div>
    </NelthUIContextProvider>
  )
}

