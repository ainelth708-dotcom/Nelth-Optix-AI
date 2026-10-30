'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import type { ComparisonProps } from '@/lib/nelth-ui/types'

export function ComparisonMatrixComponent({ props }: { props: ComparisonProps }) {
  return (
    <div className="my-3 w-full rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden shadow-xs">
      {props.title && (
        <div className="p-3 border-b border-border/50 bg-muted/30">
          <h4 className="text-sm font-semibold text-foreground tracking-tight">
            {props.title}
          </h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="p-3 text-muted-foreground font-semibold min-w-[140px]">
                Critères / Fonctionnalités
              </th>
              {props.entities.map((entity, idx) => (
                <th
                  key={entity.id || idx}
                  className={cn(
                    'p-3 text-center min-w-[120px] transition-colors',
                    entity.highlight && 'bg-primary/5 border-x border-primary/20'
                  )}
                >
                  <div className="space-y-1">
                    {entity.highlight && (
                      <span className="inline-block rounded-full bg-primary text-primary-foreground px-2 py-0.2 text-[9px] font-semibold uppercase tracking-wider mb-1">
                        Recommandé
                      </span>
                    )}
                    <div className="font-bold text-foreground text-sm">{entity.name}</div>
                    {entity.badge && (
                      <span className="inline-block text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-normal">
                        {entity.badge}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {props.criteria.map((criterion, cIdx) => (
              <tr key={cIdx} className="hover:bg-muted/20 transition-colors">
                <td className="p-3 font-medium text-foreground/90 whitespace-nowrap">
                  {criterion.name}
                </td>
                {props.entities.map((entity, eIdx) => {
                  const val = props.values?.[entity.id]?.[criterion.name]
                  return (
                    <td
                      key={eIdx}
                      className={cn(
                        'p-3 text-center',
                        entity.highlight && 'bg-primary/5 border-x border-primary/20 font-semibold'
                      )}
                    >
                      {renderComparisonValue(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderComparisonValue(val: any) {
  if (val === true) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Check className="w-3.5 h-3.5" />
      </span>
    )
  }
  if (val === false) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-500/70">
        <X className="w-3.5 h-3.5" />
      </span>
    )
  }
  if (val == null || val === '') {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="text-foreground/90">{String(val)}</span>
}
